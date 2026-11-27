import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs-extra";
import os from "os";
import path from "path";
import { execSync } from "child_process";

import {
  initProject,
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
  linkChecklistItem,
  completeChecklistForBeads,
  createPlan,
  completePlan,
  graduatePlanToBeads,
  listPlans,
  getBeadsState,
  isBeadsAvailable,
} from "../src/core.js";

function makeTempDir(prefix = "fw-md-") {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

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
  assert.equal(initRes.health.score, computeHealth(dir).score);
  assert.ok(initRes.created.includes("_AUDIT/FARMHOUSE.md"));
  assert.equal(fs.existsSync(path.join(dir, "_AUDIT", "COMPOST.md")), false);

  // Thin-index AGENTS.md must stay lean (<50 lines)
  const agentsLines = fs.readFileSync(path.join(dir, "AGENTS.md"), "utf8").split("\n").length;
  assert.ok(agentsLines < 50, `Expected lean AGENTS.md, got ${agentsLines} lines`);

  // Plant ideas & verify aging/auto-compost
  plantIdea(dir, { title: "Dark Mode Toggle", description: "Support system theme", bullets: ["CSS vars"] });
  plantIdea(dir, { title: "Old Stale Idea", description: "Should auto-compost" });

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

  compostIdea(dir, { title: "Blockchain Auth", reason: "Unnecessary complexity" });
  assert.equal(parseCompost(dir).items.length, 2);

  const scoreBeforeGates = computeHealth(dir).score;
  const gateRes = runGates(dir, { only: ["test"] });
  assert.equal(gateRes.allPassed, true);
  assert.ok(computeHealth(dir).score > scoreBeforeGates);

  fs.removeSync(dir);
});

test("graduatePlanToBeads creates an epic and child tasks idempotently", () => {
  if (!isBeadsAvailable()) return;

  const dir = makeTempDir("fw-plan-beads-");
  execSync("git init -q", { cwd: dir });
  initProject(dir, { projectName: "beads-plan-demo" });

  const plan = createPlan(dir, {
    title: "Explicit Order State Machine",
    summary: "Replace boolean flags with a native enum",
    steps: ["Define frozen state transitions", "Guard checkout updates", "Add unit tests"],
  });

  const first = graduatePlanToBeads(dir, plan.slug);
  assert.equal(first.graduated, true);
  assert.equal(first.alreadyGraduated, false);
  assert.ok(first.epicId);
  assert.equal(first.tasks.length, 3);

  // Plan file records the Beads Epic ID and repeat call is idempotent
  const listed = listPlans(dir);
  assert.equal(listed[0].beadsEpic, first.epicId);

  const second = graduatePlanToBeads(dir, plan.slug);
  assert.equal(second.graduated, false);
  assert.equal(second.alreadyGraduated, true);
  assert.equal(second.epicId, first.epicId);

  const beads = getBeadsState(dir, { includeIssues: true });
  assert.ok(beads.issues.length >= 4);

  fs.removeSync(dir);
});

test("checklists stay human & concise: big plans don't cost points, adds are capped, Beads epic close checks off", () => {
  const dir = makeTempDir("fw-split-");
  execSync("git init -q", { cwd: dir });
  fs.writeJsonSync(path.join(dir, "package.json"), { name: "split-app", scripts: { test: "node -e 0" } });
  initProject(dir);

  // Complete every standard, then record a pending big plan: score must not drop
  for (const item of parseChecklist(dir).items) setChecklistItem(dir, { target: item.id, state: "complete" });
  const before = computeHealth(dir);
  const plan = createPlan(dir, { title: "Offline Sync", steps: ["Add queue", "Add retry"] });
  assert.equal(plan.checklistLinked, true);
  const after = computeHealth(dir);
  assert.equal(after.metrics.checklistPercent, 100);
  assert.equal(after.metrics.bigPlans, 1);
  assert.equal(after.score, before.score);

  // Linked Beads epic close -> human big-plan item checked off
  linkChecklistItem(dir, { target: "Offline Sync", beadsId: "bd-42" });
  assert.equal(completeChecklistForBeads(dir, "bd-42").state, "complete");
  assert.equal(completeChecklistForBeads(dir, "bd-unlinked"), null);
  assert.equal(parseChecklist(dir).summary.bigPlans.completed, 1);

  // Hard cap: agents can't grow the checklist past the configured limit
  const manifestPath = path.join(dir, ".farmwork.json");
  const active = parseChecklist(dir).summary.activeTotal;
  fs.writeJsonSync(manifestPath, { ...fs.readJsonSync(manifestPath), limits: { maxChecklistItems: active } });
  assert.throws(() => addChecklistItem(dir, { title: "Granular task 1" }), /cap/);
  const capped = createPlan(dir, { title: "Billing Revamp" });
  assert.equal(capped.checklistLinked, false);
  assert.match(capped.checklistWarning, /Beads/);
  assert.ok(fs.existsSync(path.join(dir, capped.path)));
});
