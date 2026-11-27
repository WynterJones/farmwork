import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs-extra";
import os from "os";
import path from "path";

import {
  LegacyFarmworkError,
  detectFarmworkInstall,
  initProject,
  detectProject,
  computeHealth,
  runAudit,
  plantIdea,
  parseGarden,
} from "../src/core.js";
import { createViewerServer } from "../src/viewer.js";

function makeTempDir(prefix = "fw-detect-") {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test("polyglot detection recognizes Rails+package.json, Vite+React, MCP, Python, Rust, and Go", () => {
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
  assert.equal(computeHealth(railsDir).metrics.testFiles, 1);

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

  const mcpDir = makeTempDir("fw-mcp-stack-");
  fs.writeJsonSync(path.join(mcpDir, "package.json"), {
    name: "msai-mcp-demo",
    dependencies: { "@modelcontextprotocol/sdk": "^1.32.2" },
    scripts: { test: "node --test" },
  });
  assert.equal(detectProject(mcpDir).stack, "mcp-node");
  initProject(mcpDir);
  const mcpChecklist = fs.readFileSync(path.join(mcpDir, "_AUDIT", "CHECKLIST.md"), "utf8");
  assert.ok(mcpChecklist.includes("MCP Server Standards"));
  assert.ok(mcpChecklist.includes("Implicit state machines"));

  const rustDir = makeTempDir("fw-rust-");
  fs.writeFileSync(path.join(rustDir, "Cargo.toml"), '[package]\nname = "demo"\n');
  assert.equal(detectProject(rustDir).stack, "rust");
  assert.equal(detectProject(rustDir).commands.test, "cargo test");

  const goDir = makeTempDir("fw-go-");
  fs.writeFileSync(path.join(goDir, "go.mod"), "module example.com/demo\n");
  assert.equal(detectProject(goDir).stack, "go");
  assert.equal(detectProject(goDir).commands.lint, "go vet ./...");

  const npxDir = makeTempDir("fw-npx-");
  initProject(npxDir, { useNpx: true });
  assert.equal(fs.readJsonSync(path.join(npxDir, ".mcp.json")).mcpServers.farmwork.command, "npx");

  for (const d of [railsDir, viteDir, mcpDir, rustDir, goDir, npxDir]) fs.removeSync(d);
});

test("legacy v1/v2 Farmwork repos are never auto-updated and require explicit --reinstall", async () => {
  const workspace = makeTempDir("fw-legacy-");
  const v1Dir = path.join(workspace, "old-v1");
  const v2Dir = path.join(workspace, "old-v2");
  fs.ensureDirSync(path.join(v1Dir, "_AUDIT"));
  fs.ensureDirSync(path.join(v1Dir, "_OFFICE"));
  fs.ensureDirSync(path.join(v2Dir, "_AUDIT"));
  fs.ensureDirSync(path.join(v2Dir, ".claude", "commands"));

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
  fs.writeFileSync(
    path.join(v1Dir, "_AUDIT", "GARDEN.md"),
    "# Idea Garden\n\n## Ideas\n\n_None yet._\n\n<!--\n### [Example Idea]\n**Planted:** 2025-01-01\n-->\n",
  );
  fs.writeFileSync(path.join(v2Dir, "_AUDIT", "FARMHOUSE.md"), "# Legacy v2 Farmhouse\n");
  fs.writeFileSync(path.join(v2Dir, ".claude", "commands", "audit.md"), "# /audit\n");

  assert.equal(detectFarmworkInstall(v1Dir).generation, "v1");
  assert.equal(detectFarmworkInstall(v2Dir).generation, "v2");
  assert.equal(parseGarden(v1Dir).ideas.length, 0);

  const blockedV1 = initProject(v1Dir);
  assert.equal(blockedV1.blocked, true);
  assert.equal(fs.readFileSync(path.join(v1Dir, "_AUDIT", "FARMHOUSE.md"), "utf8"), originalFarmhouse);
  assert.equal(fs.existsSync(path.join(v1Dir, "AGENTS.md")), false);
  assert.equal(initProject(v2Dir).blocked, true);

  assert.throws(() => runAudit(v1Dir), LegacyFarmworkError);
  assert.throws(() => plantIdea(v1Dir, { title: "Nope" }), LegacyFarmworkError);
  assert.throws(() => runAudit(v2Dir), LegacyFarmworkError);

  const server = createViewerServer(workspace);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const conflictRes = await fetch(`http://127.0.0.1:${port}/api/audit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: v1Dir }),
  });
  assert.equal(conflictRes.status, 409);
  assert.equal(fs.readFileSync(path.join(v1Dir, "_AUDIT", "FARMHOUSE.md"), "utf8"), originalFarmhouse);
  server.close();

  const reinstalled = initProject(v1Dir, { reinstall: true });
  assert.equal(reinstalled.blocked, false);
  assert.equal(reinstalled.reinstalledFrom, "v1");
  assert.equal(detectFarmworkInstall(v1Dir).generation, "v3");
  const mergedMcp = fs.readJsonSync(path.join(v1Dir, ".mcp.json"));
  assert.ok(mergedMcp.mcpServers.msai);
  assert.ok(mergedMcp.mcpServers.farmwork);

  fs.removeSync(workspace);
});
