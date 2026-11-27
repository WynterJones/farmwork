import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs-extra";
import os from "os";
import path from "path";
import { execSync } from "child_process";

import {
  initProject,
  computeHealth,
  runGates,
  runSecurityScan,
  runCodeQualityScan,
  nativeStateRecommendation,
  checkContextHygiene,
  parsePillarAudits,
  savePillarAudit,
} from "../src/core.js";
import { createViewerServer } from "../src/viewer.js";

function makeTempDir(prefix = "fw-scan-") {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test("deterministic security scan detects leaked secrets and lazy pillar audits persist cleanly", async () => {
  const dir = makeTempDir("fw-sec-");
  fs.writeJsonSync(path.join(dir, "package.json"), { name: "sec-demo" });
  initProject(dir);

  assert.equal(fs.existsSync(path.join(dir, "_AUDIT", "SECURITY.md")), false);
  assert.equal(parsePillarAudits(dir).every((p) => !p.exists), true);

  fs.writeFileSync(path.join(dir, ".env.example"), "API_KEY=replace-me\n");
  const cleanScan = runSecurityScan(dir, { skipDeps: true });
  assert.equal(cleanScan.passed, true);
  assert.equal(cleanScan.secretFindings.length, 0);

  fs.writeFileSync(path.join(dir, ".env"), "SECRET=123\n");
  const syntheticAwsKey = ["AKIA", "1234567890ABCDEF"].join("");
  fs.writeFileSync(path.join(dir, "leak.js"), `const key = '${syntheticAwsKey}';\n`);
  const dirtyScan = runSecurityScan(dir, { skipDeps: true });
  assert.equal(dirtyScan.passed, false);
  assert.ok(dirtyScan.secretFindings.some((f) => f.file === ".env"));
  assert.ok(dirtyScan.secretFindings.some((f) => f.file === "leak.js" && f.type === "AWS Access Key"));

  const saved = savePillarAudit(dir, {
    pillar: "security",
    score: 7.5,
    status: "Hardened",
    summary: "Removed leaked key and added CSP.",
    findings: [{ severity: "HIGH", title: "Missing CSP header", location: "server.js:14", fix: "Add CSP middleware" }],
    recommendations: ["Enable strict CSP in production"],
  });
  assert.equal(saved.path, "_AUDIT/SECURITY.md");
  const secPillar = computeHealth(dir).pillars.find((p) => p.key === "security");
  assert.equal(secPillar.exists, true);
  assert.equal(secPillar.score, 7.5);

  const server = createViewerServer(dir);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const secRes = await fetch(`http://127.0.0.1:${port}/api/security`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: dir, skipDeps: true }),
  });
  assert.equal(secRes.status, 200);
  assert.equal((await secRes.json()).passed, false);

  server.close();
  fs.removeSync(dir);
});

test("code quality scanner detects implicit state machines, oversized files, and debug breakpoints without prose false positives", () => {
  const dir = makeTempDir("fw-sm-");
  fs.writeJsonSync(path.join(dir, "package.json"), {
    name: "state-demo",
    dependencies: { react: "^19.0.0" },
    devDependencies: { vite: "^6.0.0" },
  });
  fs.ensureDirSync(path.join(dir, "src"));

  // 1. Boolean explosion
  fs.writeFileSync(
    path.join(dir, "src", "CheckoutForm.jsx"),
    "export function CheckoutForm() {\n  const isLoading = false;\n  const isSaving = false;\n  const isError = false;\n  const isSubmitted = false;\n  return isLoading || isSaving || isError || isSubmitted;\n}\n",
  );

  // 2. Loose status string mutations without transition validator
  fs.writeFileSync(
    path.join(dir, "src", "orderService.js"),
    "export function start(order) { order.status = 'pending'; }\nexport function finish(order) { order.status = 'shipped'; }\n",
  );

  // 3. Explicit transition validator -> should NOT trigger loose-status-mutations
  fs.writeFileSync(
    path.join(dir, "src", "cleanMachine.js"),
    "const ALLOWED_TRANSITIONS = Object.freeze({ draft: ['paid'], paid: ['shipped'] });\nexport function transitionOrder(o, next) { if (ALLOWED_TRANSITIONS[o.status]?.includes(next)) o.status = next; o.status = 'draft'; }\n",
  );

  // 4. Prose/doc mention of boolean flags inside backticks -> should NOT false positive
  fs.writeFileSync(
    path.join(dir, "src", "docsHelper.js"),
    "export const TIP = 'Avoid `isLoading`/`isSaving`/`isError` flag clusters.';\n// Also ignore comments: isLoading isSaving isError isReady\n",
  );

  // 5. Stray debugger + oversized file (>50 lines override for test)
  fs.writeFileSync(
    path.join(dir, "src", "bigFile.js"),
    `${Array.from({ length: 65 }, (_, i) => `export const x${i} = ${i};`).join("\n")}\ndebugger;\n`,
  );

  const scan = runCodeQualityScan(dir, { maxFileLines: 50, skipDeadCode: true });
  assert.equal(scan.clean, false);
  assert.equal(scan.oversizedFiles.length, 1);
  assert.equal(scan.oversizedFiles[0].file, "src/bigFile.js");

  const boolSpot = scan.stateMachineHotspots.find((h) => h.file === "src/CheckoutForm.jsx");
  assert.ok(boolSpot);
  assert.equal(boolSpot.kind, "boolean-explosion");

  const looseSpot = scan.stateMachineHotspots.find((h) => h.file === "src/orderService.js");
  assert.ok(looseSpot);
  assert.equal(looseSpot.kind, "loose-status-mutations");

  assert.equal(scan.stateMachineHotspots.some((h) => h.file === "src/cleanMachine.js"), false);
  assert.equal(scan.stateMachineHotspots.some((h) => h.file === "src/docsHelper.js"), false);

  assert.equal(scan.debugNoise.length, 1);
  assert.equal(scan.debugNoise[0].file, "src/bigFile.js");

  // Native stack recommendations never mandate a state-machine library
  assert.ok(scan.stateRecommendation.includes("discriminated unions"));
  assert.ok(nativeStateRecommendation("rails").includes("Rails `enum`"));
  assert.ok(nativeStateRecommendation("rust").includes("Rust `enum`"));
  assert.ok(nativeStateRecommendation("python").includes("StrEnum"));
  assert.ok(nativeStateRecommendation("go").includes("switch"));

  fs.removeSync(dir);
});

test("context hygiene detects AGENTS.md bloat, broken file refs, and justfile drift", () => {
  const dir = makeTempDir("fw-ctx-");
  fs.writeJsonSync(path.join(dir, "package.json"), {
    name: "ctx-demo",
    scripts: { test: "node --test", lint: "echo ok", build: "echo ok" },
  });
  initProject(dir);

  // Fresh init should be completely clean
  assert.equal(checkContextHygiene(dir).clean, true);

  // Introduce bloat, a broken backtick path, and drop `build` from justfile
  const bloated = `${Array.from({ length: 190 }, (_, i) => `Line ${i}`).join("\n")}\nSee \`src/does-not-exist.js\`.\n`;
  fs.writeFileSync(path.join(dir, "AGENTS.md"), bloated);
  fs.writeFileSync(path.join(dir, "justfile"), "test:\n    npm run test\nlint:\n    npm run lint\n");

  const hygiene = checkContextHygiene(dir);
  assert.equal(hygiene.clean, false);
  assert.ok(hygiene.issues.some((i) => i.kind === "agents-bloat"));
  assert.ok(hygiene.issues.some((i) => i.kind === "broken-doc-refs"));
  assert.ok(hygiene.issues.some((i) => i.kind === "justfile-drift"));
  assert.deepEqual(hygiene.brokenRefs, ["src/does-not-exist.js"]);
  assert.deepEqual(hygiene.missingJustRecipes, ["build"]);

  fs.removeSync(dir);
});

test("quality gate staleness stays fresh on metadata commits and decays on new code commits", () => {
  const dir = makeTempDir("fw-stale-");
  const git = (cmd) => execSync(`git ${cmd}`, { cwd: dir, stdio: "ignore" });
  git("init -q");
  git('config user.email "test@farmwork.dev"');
  git('config user.name "Farmwork Test"');

  fs.writeJsonSync(path.join(dir, "package.json"), {
    name: "stale-demo",
    scripts: { test: "node -e \"console.log('ok')\"" },
  });
  fs.writeFileSync(path.join(dir, "index.js"), "export const v = 1;\n");
  initProject(dir, { includeBeads: false });

  git("add -A");
  git('commit -q -m "initial"');

  // Run gates on HEAD -> fresh (2.5/2.5)
  runGates(dir, { only: ["test"] });
  const freshHealth = computeHealth(dir);
  assert.equal(freshHealth.lastGates.stale, false);
  assert.equal(freshHealth.breakdown[3].points, 2.5);

  // Commit ONLY Farmwork metadata (.farmwork.json + _AUDIT/FARMHOUSE.md) -> still fresh!
  git("add .farmwork.json _AUDIT");
  git('commit -q -m "update audit docs"');
  const afterMetaCommit = computeHealth(dir);
  assert.equal(afterMetaCommit.lastGates.stale, false);
  assert.equal(afterMetaCommit.breakdown[3].points, 2.5);

  // Commit actual source code change -> gates become stale (1.5/2.5)
  fs.writeFileSync(path.join(dir, "index.js"), "export const v = 2;\n");
  git("add index.js");
  git('commit -q -m "change code without rerunning gates"');
  const staleHealth = computeHealth(dir);
  assert.equal(staleHealth.lastGates.stale, true);
  assert.equal(staleHealth.lastGates.commitsSince, 1);
  assert.equal(staleHealth.breakdown[3].points, 1.5);

  fs.removeSync(dir);
});
