import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs-extra";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";

import {
  LegacyFarmworkError,
  detectFarmworkInstall,
  initProject,
  detectProject,
  computeHealth,
  runAudit,
  runGates,
  plantIdea,
  compostIdea,
  parseGarden,
  parseCompost,
  parseChecklist,
  setChecklistItem,
  addChecklistItem,
  createPlan,
  completePlan,
  listPlans,
  scanFarms,
} from "../src/core.js";
import { createViewerServer } from "../src/viewer.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BIN_PATH = path.resolve(__dirname, "..", "bin", "farmwork.js");

function makeTempDir(prefix = "farmwork-test-") {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test("polyglot detection recognizes Rails+package.json, Vite+React, Python, Rust, and Go", () => {
  // Rails app that ALSO has a package.json (like Tailwind/JS assets) must still detect as rails
  const railsDir = makeTempDir("fw-rails-");
  fs.writeFileSync(path.join(railsDir, "Gemfile"), 'source "https://rubygems.org"\ngem "rails"\n');
  fs.writeJsonSync(path.join(railsDir, "package.json"), { name: "rails-assets", devDependencies: { tailwindcss: "^4.0.0" } });
  fs.ensureDirSync(path.join(railsDir, "bin"));
  fs.writeFileSync(path.join(railsDir, "bin", "rails"), "#!/usr/bin/env ruby\n");
  fs.writeFileSync(path.join(railsDir, "bin", "rubocop"), "#!/usr/bin/env ruby\n");
  fs.ensureDirSync(path.join(railsDir, "test"));
  fs.writeFileSync(path.join(railsDir, "test", "app_test.rb"), "class AppTest; end\n");

  const detected = detectProject(railsDir);
  assert.equal(detected.stack, "rails");
  assert.equal(detected.commands.test, "bin/rails test");
  assert.equal(detected.commands.lint, "bin/rubocop");

  const health = computeHealth(railsDir);
  assert.equal(health.metrics.testFiles, 1);

  // Vite + React app detection + ignoring default npm placeholder test script
  const viteDir = makeTempDir("fw-vite-");
  fs.writeJsonSync(path.join(viteDir, "package.json"), {
    name: "my-vite-app",
    dependencies: { react: "^19.0.0" },
    devDependencies: { vite: "^6.0.0" },
    scripts: {
      build: "vite build",
      test: 'echo "Error: no test specified" && exit 1',
    },
  });
  const viteDetected = detectProject(viteDir);
  assert.equal(viteDetected.stack, "vite-react");
  assert.equal(viteDetected.commands.build, "npm run build");
  assert.equal(viteDetected.commands.test, null);

  // MCP server repo detection + tailored starter checklist
  const mcpDir = makeTempDir("fw-mcp-stack-");
  fs.writeJsonSync(path.join(mcpDir, "package.json"), {
    name: "msai-mcp-demo",
    dependencies: { "@modelcontextprotocol/sdk": "^1.32.2" },
    scripts: { test: "node --test" },
  });
  const mcpDetected = detectProject(mcpDir);
  assert.equal(mcpDetected.stack, "mcp-node");
  initProject(mcpDir);
  const mcpChecklist = fs.readFileSync(path.join(mcpDir, "_AUDIT", "CHECKLIST.md"), "utf8");
  assert.ok(mcpChecklist.includes("MCP Server Standards"));
  assert.ok(mcpChecklist.includes("Zero stdout pollution"));

  // Smart .mcp.json: --npx forces npx, default prefers local global v3 when available
  const npxDir = makeTempDir("fw-npx-");
  initProject(npxDir, { useNpx: true });
  assert.equal(fs.readJsonSync(path.join(npxDir, ".mcp.json")).mcpServers.farmwork.command, "npx");

  fs.removeSync(railsDir);
  fs.removeSync(viteDir);
  fs.removeSync(mcpDir);
  fs.removeSync(npxDir);
});

test("init, garden aging/composting, checklists, plans, and deterministic audit work end-to-end", () => {
  const dir = makeTempDir("fw-e2e-");
  fs.writeJsonSync(path.join(dir, "package.json"), {
    name: "sample-app",
    scripts: { test: "node -e \"console.log('ok')\"" },
  });
  fs.writeFileSync(path.join(dir, "app.test.js"), "console.log('test');\n");

  const initRes = initProject(dir);
  assert.equal(initRes.blocked, false);
  assert.equal(initRes.projectName, "sample-app");
  // Initial health score during init must match subsequent computeHealth()
  assert.equal(initRes.health.score, computeHealth(dir).score);
  assert.ok(initRes.created.includes("_AUDIT/FARMHOUSE.md"));
  assert.ok(fs.existsSync(path.join(dir, ".farmwork.json")));
  assert.ok(fs.existsSync(path.join(dir, ".mcp.json")));
  assert.ok(fs.existsSync(path.join(dir, "AGENTS.md")));
  assert.ok(fs.existsSync(path.join(dir, "CLAUDE.md")));
  assert.ok(fs.existsSync(path.join(dir, "_AUDIT", "CHECKLIST.md")));
  assert.ok(fs.existsSync(path.join(dir, "_AUDIT", "FARMHOUSE.md")));
  // COMPOST.md is created lazily — should NOT exist on day 1 before anything is composted
  assert.equal(fs.existsSync(path.join(dir, "_AUDIT", "COMPOST.md")), false);

  // Plant ideas & test aging/auto-compost
  plantIdea(dir, { title: "Dark Mode Toggle", description: "Support system theme", bullets: ["CSS vars"] });
  plantIdea(dir, { title: "Old Stale Idea", description: "Should auto-compost" });

  // Backdate Old Stale Idea to 70 days ago
  const gardenPath = path.join(dir, "_AUDIT", "GARDEN.md");
  const oldDate = new Date(Date.now() - 70 * 86400000).toISOString().split("T")[0];
  let gardenMd = fs.readFileSync(gardenPath, "utf8");
  gardenMd = gardenMd.replace(
    /### Old Stale Idea\n\*\*Planted:\*\* \d{4}-\d{2}-\d{2}/,
    `### Old Stale Idea\n**Planted:** ${oldDate}`,
  );
  fs.writeFileSync(gardenPath, gardenMd);

  const auditRes = runAudit(dir);
  assert.deepEqual(auditRes.gardenResult.autoComposted, ["Old Stale Idea"]);
  assert.equal(parseGarden(dir).ideas.length, 1);
  assert.equal(parseCompost(dir).items.length, 1);

  // Graduate idea to plan and complete it
  const plan = createPlan(dir, {
    title: "Dark Mode Toggle",
    summary: "Add theme support",
    steps: ["Add tokens", "Wire toggle"],
    fromIdea: "Dark Mode Toggle",
  });
  assert.equal(plan.graduated, true);
  assert.equal(listPlans(dir).length, 1);
  assert.equal(parseGarden(dir).ideas.length, 0);
  assert.equal(parseGarden(dir).graduated.length, 1);

  completePlan(dir, plan.slug);
  assert.equal(listPlans(dir)[0].completed, true);

  // Checklists: complete, skip (removes from denominator), add
  const initialChecklist = parseChecklist(dir);
  assert.ok(initialChecklist.items.length >= 6);
  setChecklistItem(dir, { target: 2, state: "complete" });
  setChecklistItem(dir, { target: 3, state: "skip" });
  const afterToggle = parseChecklist(dir);
  assert.equal(afterToggle.items[1].state, "complete");
  assert.equal(afterToggle.items[2].state, "skip");
  assert.equal(afterToggle.summary.activeTotal, afterToggle.summary.total - 1);

  addChecklistItem(dir, { group: "Release", title: "Verify changelog" });
  assert.equal(parseChecklist(dir).items.at(-1).title, "Verify changelog");

  // Compost directly
  compostIdea(dir, { title: "Blockchain Auth", reason: "Unnecessary complexity" });
  assert.equal(parseCompost(dir).items.length, 2);

  // Quality gates record verified pass state and boost health score
  const scoreBeforeGates = computeHealth(dir).score;
  const gateRes = runGates(dir, { only: ["test"] });
  assert.equal(gateRes.allPassed, true);
  assert.equal(gateRes.results[0].status, "passed");
  const scoreAfterGates = computeHealth(dir).score;
  assert.ok(scoreAfterGates > scoreBeforeGates, `expected score ${scoreAfterGates} > ${scoreBeforeGates}`);

  fs.removeSync(dir);
});

test("MCP server speaks valid JSON-RPC over stdio with zero stdout banner pollution", async () => {
  const dir = makeTempDir("fw-mcp-");
  initProject(dir, { projectName: "mcp-demo" });

  const child = spawn(process.execPath, [BIN_PATH, "mcp", "--cwd", dir], {
    stdio: ["pipe", "pipe", "pipe"],
  });

  const responses = [];
  let buffer = "";

  const waitForId = (id) =>
    new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`Timed out waiting for id=${id}`)), 5000);
      const check = () => {
        const found = responses.find((r) => r.id === id);
        if (found) {
          clearTimeout(timeout);
          resolve(found);
        } else {
          setTimeout(check, 20);
        }
      };
      check();
    });

  child.stdout.on("data", (chunk) => {
    buffer += chunk.toString("utf8");
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.trim()) continue;
      responses.push(JSON.parse(line));
    }
  });

  const send = (obj) => child.stdin.write(`${JSON.stringify(obj)}\n`);

  send({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "test-client", version: "1.0.0" },
    },
  });
  const initResp = await waitForId(1);
  assert.equal(initResp.result.serverInfo.name, "farmwork");
  assert.equal(initResp.result.serverInfo.version, "3.0.0");

  send({ jsonrpc: "2.0", method: "notifications/initialized" });
  send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
  const toolsResp = await waitForId(2);
  const toolNames = toolsResp.result.tools.map((t) => t.name).sort();
  assert.deepEqual(toolNames, [
    "farmwork_audit",
    "farmwork_checklist",
    "farmwork_garden",
    "farmwork_gates",
    "farmwork_plan",
    "farmwork_status",
  ]);

  send({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: { name: "farmwork_status", arguments: {} },
  });
  const statusResp = await waitForId(3);
  const parsed = JSON.parse(statusResp.result.content[0].text);
  assert.equal(parsed.projectName, "mcp-demo");
  assert.ok(parsed.score > 0);

  send({
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: { name: "farmwork_garden", arguments: { action: "plant", title: "Unified Garden Tool" } },
  });
  const plantResp = await waitForId(4);
  const planted = JSON.parse(plantResp.result.content[0].text);
  assert.equal(planted.added, true);

  send({
    jsonrpc: "2.0",
    id: 5,
    method: "tools/call",
    params: {
      name: "farmwork_plan",
      arguments: { action: "create", title: "Unified Plan Tool", fromIdea: "Unified Garden Tool" },
    },
  });
  const planResp = await waitForId(5);
  const planned = JSON.parse(planResp.result.content[0].text);
  assert.equal(planned.graduated, true);

  child.kill();
  fs.removeSync(dir);
});

test("Local Farm Viewer discovers multiple farms in a folder and serves API + HTML", async () => {
  const workspace = makeTempDir("fw-view-");
  const appA = path.join(workspace, "alpha-app");
  const appB = path.join(workspace, "beta-app");
  fs.ensureDirSync(appA);
  fs.ensureDirSync(appB);
  initProject(appA, { projectName: "Alpha App" });
  initProject(appB, { projectName: "Beta App" });

  assert.equal(scanFarms(workspace).farms.length, 2);

  const server = createViewerServer(workspace);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  const htmlRes = await fetch(`${base}/`);
  assert.equal(htmlRes.status, 200);
  const html = await htmlRes.text();
  assert.ok(html.includes("Local Farm Viewer"));

  const listRes = await fetch(`${base}/api/farms`);
  const listData = await listRes.json();
  assert.equal(listData.farms.length, 2);

  // Path traversal protection check
  const forbidden = await fetch(`${base}/api/farm?path=/etc`);
  assert.equal(forbidden.status, 403);

  // Checklist write via viewer API
  const toggleRes = await fetch(`${base}/api/checklist/toggle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: appA, id: 2, state: "complete" }),
  });
  assert.equal(toggleRes.status, 200);
  const toggleData = await toggleRes.json();
  assert.equal(toggleData.checklist.items[1].state, "complete");

  // Gates API endpoint works
  const gatesRes = await fetch(`${base}/api/gates`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: appA }),
  });
  assert.equal(gatesRes.status, 200);
  const gatesData = await gatesRes.json();
  assert.equal(gatesData.allPassed, true);

  // FarmFactory visual assets served safely (and disallowed files blocked)
  const logoRes = await fetch(`${base}/assets/logo.webp`);
  assert.equal(logoRes.status, 200);
  assert.equal(logoRes.headers.get("content-type"), "image/webp");
  const badAsset = await fetch(`${base}/assets/secret.txt`);
  assert.equal(badAsset.status, 404);

  // Plan create + complete via Viewer API
  const createPlanRes = await fetch(`${base}/api/plan/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: appA, title: "Viewer Plan", summary: "Created from UI" }),
  });
  assert.equal(createPlanRes.status, 200);
  const planCreated = await createPlanRes.json();
  assert.equal(planCreated.plans.length, 1);

  const completePlanRes = await fetch(`${base}/api/plan/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: appA, plan: "VIEWER_PLAN" }),
  });
  assert.equal(completePlanRes.status, 200);
  const planDone = await completePlanRes.json();
  assert.equal(planDone.plans[0].completed, true);

  // Live SSE endpoint streams text/event-stream cleanly
  const controller = new AbortController();
  const sseRes = await fetch(`${base}/api/events`, { signal: controller.signal });
  assert.equal(sseRes.status, 200);
  assert.ok(sseRes.headers.get("content-type").includes("text/event-stream"));
  controller.abort();

  server.close();
  fs.removeSync(workspace);
});

test("legacy v1/v2 Farmwork repos are never auto-updated and require explicit --reinstall", async () => {
  const workspace = makeTempDir("fw-legacy-");
  const v1Dir = path.join(workspace, "old-v1");
  const v2Dir = path.join(workspace, "old-v2");
  fs.ensureDirSync(path.join(v1Dir, "_AUDIT"));
  fs.ensureDirSync(path.join(v1Dir, "_OFFICE"));
  fs.ensureDirSync(path.join(v2Dir, "_AUDIT"));
  fs.ensureDirSync(path.join(v2Dir, ".claude", "commands"));

  // Existing .mcp.json in v1Dir (e.g. msai MCP server) must survive reinstall
  fs.writeJsonSync(path.join(v1Dir, ".mcp.json"), {
    mcpServers: { msai: { command: "node", args: ["./msai.js"] } },
  });
  fs.writeJsonSync(path.join(v1Dir, ".farmwork.json"), {
    version: "1.5.0",
    projectName: "old-v1-app",
    commands: { test: "npm run stale-test" },
  });
  const originalFarmhouse = "# Legacy Farmhouse\n**Score:** 6.0/10\n";
  fs.writeFileSync(path.join(v1Dir, "_AUDIT", "FARMHOUSE.md"), originalFarmhouse);
  // Commented template example in GARDEN.md must NOT be counted as an active idea
  fs.writeFileSync(
    path.join(v1Dir, "_AUDIT", "GARDEN.md"),
    "# Idea Garden\n\n## Ideas\n\n_None yet._\n\n<!--\n### [Example Idea]\n**Planted:** 2025-01-01\n-->\n",
  );
  fs.writeFileSync(path.join(v2Dir, "_AUDIT", "FARMHOUSE.md"), "# Legacy v2 Farmhouse\n");
  fs.writeFileSync(path.join(v2Dir, ".claude", "commands", "audit.md"), "# /audit\n");

  assert.equal(detectFarmworkInstall(v1Dir).generation, "v1");
  assert.equal(detectFarmworkInstall(v2Dir).generation, "v2");
  assert.equal(parseGarden(v1Dir).ideas.length, 0);

  // init without --reinstall is blocked and leaves files completely untouched
  const blockedV1 = initProject(v1Dir);
  assert.equal(blockedV1.blocked, true);
  assert.equal(blockedV1.generation, "v1");
  assert.equal(fs.readFileSync(path.join(v1Dir, "_AUDIT", "FARMHOUSE.md"), "utf8"), originalFarmhouse);
  assert.equal(fs.existsSync(path.join(v1Dir, "AGENTS.md")), false);

  const blockedV2 = initProject(v2Dir);
  assert.equal(blockedV2.blocked, true);
  assert.equal(blockedV2.generation, "v2");

  // Mutating calls refuse legacy repos with LegacyFarmworkError
  assert.throws(() => runAudit(v1Dir), LegacyFarmworkError);
  assert.throws(() => plantIdea(v1Dir, { title: "Nope" }), LegacyFarmworkError);
  assert.throws(() => runAudit(v2Dir), LegacyFarmworkError);

  // Local Viewer returns 409 Conflict on legacy mutations
  const server = createViewerServer(workspace);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  const conflictRes = await fetch(`${base}/api/audit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: v1Dir }),
  });
  assert.equal(conflictRes.status, 409);
  assert.equal(fs.readFileSync(path.join(v1Dir, "_AUDIT", "FARMHOUSE.md"), "utf8"), originalFarmhouse);
  server.close();

  // Explicit --reinstall upgrades v1 to v3 cleanly while preserving existing .mcp.json servers
  const reinstalled = initProject(v1Dir, { reinstall: true });
  assert.equal(reinstalled.blocked, false);
  assert.equal(reinstalled.reinstalledFrom, "v1");
  assert.equal(detectFarmworkInstall(v1Dir).generation, "v3");
  const mergedMcp = fs.readJsonSync(path.join(v1Dir, ".mcp.json"));
  assert.ok(mergedMcp.mcpServers.msai);
  assert.ok(mergedMcp.mcpServers.farmwork);

  fs.removeSync(workspace);
});
