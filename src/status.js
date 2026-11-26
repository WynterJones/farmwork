import { VERSION, LegacyFarmworkError, computeHealth, runAudit, runGates } from "./core.js";
import { farmTerm, emojis } from "./terminal.js";

export async function status(options = {}) {
  const health = computeHealth(process.cwd());

  if (options.json) {
    console.log(JSON.stringify(health, null, 2));
    return;
  }

  farmTerm.banner(VERSION);
  farmTerm.header(`STATUS · ${health.projectName}`);

  if (!health.initialized) {
    farmTerm.warn("Farmwork is not initialized in this directory.");
    farmTerm.info("Run `farmwork init` to set up .farmwork.json, AGENTS.md, .mcp.json, and _AUDIT/.\n");
    return;
  }

  if (health.install?.isLegacy) {
    farmTerm.warn(`Legacy Farmwork (${health.install.generation}) detected — read-only mode.`);
    farmTerm.dim("v3 will not modify past Farmwork apps. Run `farmwork init --reinstall` if you want to reinstall v3.\n");
  }

  farmTerm.section("Overview", emojis.wheat);
  farmTerm.kv("Stack", health.stack);
  farmTerm.kv("Farmwork", health.install?.generation === "v3" ? `v${health.install.version}` : `legacy (${health.install?.generation})`);
  farmTerm.kv("Git", health.git.isGitRepo ? `${health.git.branch} (${health.git.dirtyCount} uncommitted)` : "not a git repo");
  farmTerm.kv("Test Files", String(health.metrics.testFiles));
  farmTerm.kv("Checklist", `${health.metrics.checklistPercent}% (${health.metrics.checklistCompleted}/${health.metrics.checklistActive})`);
  farmTerm.kv("Plans", `${health.metrics.completedPlans}/${health.metrics.totalPlans} complete`);
  farmTerm.kv("Idea Garden", `${health.metrics.activeIdeas} active (${health.metrics.wiltingIdeas} wilting), ${health.metrics.compostedIdeas} composted`);

  farmTerm.section("Health Score");
  farmTerm.scoreBar(health.status, health.score, 10);
  console.log("");
  for (const item of health.breakdown) {
    farmTerm.status(item.label, item.passed, `${item.points}/${item.max}`);
  }
  console.log("");
}

export async function audit(options = {}) {
  let result;
  try {
    result = runAudit(process.cwd());
  } catch (err) {
    if (err instanceof LegacyFarmworkError) {
      if (options.json) {
        console.log(JSON.stringify({ error: err.message, code: err.code, generation: err.generation }, null, 2));
      } else {
        farmTerm.banner(VERSION);
        farmTerm.header("AUDIT · BLOCKED (LEGACY)");
        farmTerm.warn(err.message);
        console.log("");
      }
      process.exitCode = 1;
      return;
    }
    throw err;
  }

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  farmTerm.banner(VERSION);
  farmTerm.header(`AUDIT · ${result.health.projectName}`);
  farmTerm.scoreBar(result.health.status, result.health.score, 10);
  farmTerm.kv("Updated", "_AUDIT/FARMHOUSE.md");
  if (result.gardenResult.wilting.length > 0) {
    farmTerm.warn(`Wilting ideas (45-60d): ${result.gardenResult.wilting.join(", ")}`);
  }
  if (result.gardenResult.autoComposted.length > 0) {
    farmTerm.warn(`Auto-composted (>60d): ${result.gardenResult.autoComposted.join(", ")}`);
  }
  console.log("");
}

export async function gates(options = {}) {
  const only = options.only ? String(options.only).split(",").map((s) => s.trim()).filter(Boolean) : null;
  const result = runGates(process.cwd(), { only });

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    if (!result.allPassed) process.exitCode = 1;
    return;
  }

  farmTerm.banner(VERSION);
  farmTerm.header(`QUALITY GATES · ${result.projectName}`);
  for (const r of result.results) {
    if (r.status === "skipped") {
      farmTerm.dim(`• ${r.gate}: skipped (no command configured)`);
    } else {
      farmTerm.status(`${r.gate} (${r.command})`, r.status === "passed", `${r.durationMs}ms`);
      if (r.status === "failed" && r.output) {
        console.log(`\n${r.output}\n`);
      }
    }
  }
  console.log("");
  if (!result.allPassed) process.exitCode = 1;
}
