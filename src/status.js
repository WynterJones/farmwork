import {
  VERSION,
  LegacyFarmworkError,
  computeHealth,
  runAudit,
  runGates,
  runSecurityScan,
  getBeadsState,
  initBeads,
  detectJustfile,
  initJustfile,
  runJustRecipe,
} from "./core.js";
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
  farmTerm.kv("Big Plans", `${health.metrics.bigPlansCompleted}/${health.metrics.bigPlans} done`);
  farmTerm.kv("Plans", `${health.metrics.completedPlans}/${health.metrics.totalPlans} complete`);
  farmTerm.kv("Idea Garden", `${health.metrics.activeIdeas} active (${health.metrics.wiltingIdeas} wilting), ${health.metrics.compostedIdeas} composted`);
  farmTerm.kv(
    "Beads",
    health.beads?.initialized
      ? `${health.beads.summary.ready} ready · ${health.beads.summary.open + health.beads.summary.inProgress} open · ${health.beads.summary.closed} closed`
      : health.beads?.installed
        ? "not initialized (run `farmwork beads --init`)"
        : "bd not installed (beads.gascity.com)",
  );
  farmTerm.kv(
    "Justfile",
    health.justfile?.exists
      ? `${health.justfile.file} (${health.justfile.recipes.length} recipes)`
      : "none (run `farmwork just --init`)",
  );

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
  if (result.codeQuality && !result.codeQuality.clean) {
    farmTerm.section("State & Code Hygiene Signals");
    for (const f of result.codeQuality.oversizedFiles) {
      farmTerm.warn(`Oversized file: ${f.file} (${f.lines} lines > ${f.limit})`);
    }
    for (const h of result.codeQuality.stateMachineHotspots) {
      farmTerm.warn(`State machine hotspot [${h.severity}]: ${h.file} — ${h.detail}`);
    }
    for (const d of result.codeQuality.debugNoise) {
      farmTerm.warn(`Debug noise: ${d.file}:${d.line} (${d.type})`);
    }
    if (result.codeQuality.stateMachineHotspots.length > 0) {
      farmTerm.dim(`Tip: ${result.codeQuality.stateRecommendation}`);
    }
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

export async function security(options = {}) {
  const result = runSecurityScan(process.cwd(), { skipDeps: Boolean(options.skipDeps) });

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    if (!result.passed) process.exitCode = 1;
    return;
  }

  farmTerm.banner(VERSION);
  farmTerm.header(`SECURITY SCAN · ${result.projectName}`);

  farmTerm.section("Secrets & Sensitive Files");
  if (result.secretFindings.length === 0) {
    farmTerm.status(`Scanned ${result.filesScanned} files — no leaked secrets or committed .env/key files`, true);
  } else {
    for (const f of result.secretFindings) {
      farmTerm.status(`${f.type}: ${f.file}${f.line ? `:${f.line}` : ""}`, false, f.detail);
    }
  }

  farmTerm.section("Dependency & Static Audit");
  if (result.dependencyAudit.status === "skipped") {
    farmTerm.dim(`• ${result.dependencyAudit.reason}`);
  } else {
    farmTerm.status(
      `${result.dependencyAudit.tool} (${result.dependencyAudit.command})`,
      result.dependencyAudit.status === "passed",
      `${result.dependencyAudit.durationMs}ms`,
    );
    if (result.dependencyAudit.status === "failed" && result.dependencyAudit.output) {
      console.log(`\n${result.dependencyAudit.output}\n`);
    }
  }
  console.log("");
  if (!result.passed) process.exitCode = 1;
}

export async function beadsCmd(options = {}) {
  const cwd = process.cwd();
  if (options.init) {
    try {
      const res = initBeads(cwd, { prefix: options.prefix });
      if (options.json) {
        console.log(JSON.stringify(res, null, 2));
        return;
      }
      farmTerm.banner(VERSION);
      farmTerm.header("BEADS · INIT");
      farmTerm.status(res.created ? `Initialized .beads/ (prefix: ${res.prefix})` : res.reason, res.initialized);
      console.log("");
      if (!res.initialized) process.exitCode = 1;
      return;
    } catch (err) {
      if (options.json) {
        console.log(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }, null, 2));
      } else {
        farmTerm.warn(err instanceof Error ? err.message : String(err));
      }
      process.exitCode = 1;
      return;
    }
  }

  const state = getBeadsState(cwd, { includeIssues: true });
  if (options.json) {
    console.log(JSON.stringify(state, null, 2));
    return;
  }

  farmTerm.banner(VERSION);
  farmTerm.header("BEADS · PROJECT ISSUES");
  if (!state.initialized) {
    farmTerm.warn("Beads is not initialized in this repository.");
    farmTerm.info(
      state.installed
        ? "Run `farmwork beads --init` (or `bd init`) to enable dependency-graph task tracking.\n"
        : "Install Beads from https://beads.gascity.com/ and run `bd init`.\n",
    );
    return;
  }

  farmTerm.kv("Ready", String(state.summary.ready));
  farmTerm.kv("Open / Active", `${state.summary.open} open · ${state.summary.inProgress} in progress · ${state.summary.blocked} blocked`);
  farmTerm.kv("Closed", String(state.summary.closed));

  farmTerm.section("Ready Work (Unblocked)", emojis.wheat);
  if (state.ready.length === 0) {
    farmTerm.dim("  • No ready issues right now. Create one with `bd create \"...\"`.");
  } else {
    for (const issue of state.ready.slice(0, 12)) {
      const p = issue.priority !== undefined ? `P${issue.priority}` : "";
      const kind = issue.issue_type || "task";
      farmTerm.info(`[${issue.id}] (${p} ${kind}) ${issue.title}`);
    }
  }
  console.log("");
}

export async function justCmd(recipe, options = {}) {
  const cwd = process.cwd();
  if (options.init) {
    try {
      const res = initJustfile(cwd, { force: Boolean(options.force) });
      if (options.json) {
        console.log(JSON.stringify(res, null, 2));
        return;
      }
      farmTerm.banner(VERSION);
      farmTerm.header("JUSTFILE · INIT");
      farmTerm.status(
        res.created ? `Generated ${res.file} (${res.recipes.length} recipes)` : `${res.file} already exists (pass --force to overwrite)`,
        true,
      );
      console.log("");
      return;
    } catch (err) {
      if (options.json) {
        console.log(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }, null, 2));
      } else {
        farmTerm.warn(err instanceof Error ? err.message : String(err));
      }
      process.exitCode = 1;
      return;
    }
  }

  if (recipe) {
    try {
      const res = runJustRecipe(cwd, recipe);
      if (options.json) {
        console.log(JSON.stringify(res, null, 2));
        if (!res.passed) process.exitCode = 1;
        return;
      }
      farmTerm.banner(VERSION);
      farmTerm.header(`JUST · ${res.recipe}`);
      farmTerm.status(res.command, res.passed, `${res.durationMs}ms`);
      if (res.output) console.log(`\n${res.output}\n`);
      if (!res.passed) process.exitCode = 1;
      return;
    } catch (err) {
      if (options.json) {
        console.log(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }, null, 2));
      } else {
        farmTerm.warn(err instanceof Error ? err.message : String(err));
      }
      process.exitCode = 1;
      return;
    }
  }

  const info = detectJustfile(cwd);
  if (options.json) {
    console.log(JSON.stringify(info, null, 2));
    return;
  }

  farmTerm.banner(VERSION);
  farmTerm.header("JUSTFILE · RECIPES");
  if (!info.exists) {
    farmTerm.warn("No justfile found in this repository.");
    farmTerm.info("Run `farmwork just --init` to generate a stack-aware justfile.\n");
    return;
  }

  farmTerm.kv("File", info.file);
  farmTerm.kv("just CLI", info.installed ? "installed" : "not installed (https://just.systems/man/en/)");
  farmTerm.section(`Recipes (${info.recipes.length})`, emojis.tractor);
  for (const r of info.recipes) {
    const sig = r.params.length ? `${r.name} ${r.params.join(" ")}` : r.name;
    farmTerm.kv(sig, r.description || "(no description)");
  }
  console.log("");
}
