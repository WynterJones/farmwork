import readline from "node:readline/promises";
import {
  VERSION,
  detectFarmworkInstall,
  detectProject,
  detectJustfile,
  isJustAvailable,
  isBeadsAvailable,
  initProject,
} from "./core.js";
import { farmTerm, emojis } from "./terminal.js";

async function askConfirm(question, defaultYes = true) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const hint = defaultYes ? "[Y/n]" : "[y/N]";
    const ans = (await rl.question(`  ${question} ${hint} `)).trim().toLowerCase();
    if (!ans) return defaultYes;
    return ans === "y" || ans === "yes";
  } finally {
    rl.close();
  }
}

async function askInput(question, defaultValue) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const ans = (await rl.question(`  ${question} (${defaultValue}): `)).trim();
    return ans || defaultValue;
  } finally {
    rl.close();
  }
}

export async function init(options = {}) {
  const cwd = process.cwd();
  farmTerm.banner(VERSION);
  farmTerm.header("FARMWORK INIT");

  const install = detectFarmworkInstall(cwd);

  if (install.isLegacy && !options.reinstall) {
    farmTerm.warn(`Past Farmwork (${install.generation}) installation detected in this repo.`);
    farmTerm.dim("Farmwork v3 never auto-updates past Farmwork apps so existing setups stay untouched.");
    if (install.legacyFiles.length > 0) {
      farmTerm.dim(`Legacy artifacts found: ${install.legacyFiles.join(", ")}`);
    }
    farmTerm.section("To Move This Repo to v3");
    farmTerm.info("Run `farmwork init --reinstall` to cleanly reinstall Farmwork v3");
    farmTerm.dim("  (Replaces .farmwork.json, AGENTS.md, CLAUDE.md, FARMHOUSE.md; preserves _PLANS/, GARDEN.md, COMPOST.md & existing .mcp.json servers)\n");
    process.exitCode = 1;
    return;
  }

  const detected = detectProject(cwd, { ignoreManifest: Boolean(options.reinstall || options.force) });
  const justInfo = detectJustfile(cwd);
  farmTerm.section("Detected Project", emojis.seedling);
  farmTerm.kv("Project", detected.projectName);
  farmTerm.kv("Stack", detected.stack);
  farmTerm.kv("Lint", detected.commands.lint || "(none)");
  farmTerm.kv("Test", detected.commands.test || "(none)");
  farmTerm.kv("Build", detected.commands.build || "(none)");
  farmTerm.kv(
    "Justfile",
    justInfo.exists
      ? `${justInfo.file} (${justInfo.recipes.length} recipes)`
      : options.justfile === false
        ? "skipped (--no-justfile)"
        : `will generate (${isJustAvailable() ? "just installed" : "install from just.systems"})`,
  );
  farmTerm.kv(
    "Beads (bd)",
    options.beads === false
      ? "skipped (--no-beads)"
      : isBeadsAvailable()
        ? "bd installed (ready to initialize)"
        : "not installed (beads.gascity.com)",
  );

  let projectName = detected.projectName;
  const isInteractive = Boolean(process.stdin.isTTY) && !options.force && !options.yes;

  if (install.generation === "v3" && !options.force && !options.reinstall && isInteractive) {
    console.log("");
    farmTerm.warn("Farmwork v3 is already initialized here. Existing files will be preserved unless --force is passed.");
  }

  if (install.isLegacy && options.reinstall && isInteractive) {
    console.log("");
    farmTerm.warn(`Reinstalling Farmwork v3 over past ${install.generation} setup (preserves _PLANS/ and existing ideas).`);
  }

  if (isInteractive) {
    console.log("");
    const ok = await askConfirm(
      options.reinstall
        ? "Reinstall Farmwork v3 with these settings?"
        : "Initialize Farmwork v3 with these settings?",
      true,
    );
    if (!ok) {
      projectName = await askInput("Project name", projectName);
    }
  }

  const result = initProject(cwd, {
    force: Boolean(options.force),
    reinstall: Boolean(options.reinstall),
    useNpx: Boolean(options.npx),
    projectName,
    includeMcpConfig: options.mcp !== false,
    includeJustfile: options.justfile !== false,
    includeBeads: options.beads !== false,
  });

  if (result.blocked) {
    farmTerm.warn(result.message);
    process.exitCode = 1;
    return;
  }

  farmTerm.section("Files Updated", emojis.wheat);
  for (const f of result.created) farmTerm.status(f, true, "updated");
  for (const f of result.skipped) {
    const hint = f === "AGENTS.md" || f === "CLAUDE.md" ? "kept existing — add Farmwork MCP note or pass --force" : "kept existing";
    farmTerm.dim(`  • ${f} (${hint})`);
  }
  if (result.beadsNote) {
    farmTerm.dim(`  • Beads: ${result.beadsNote}`);
  }

  if (result.reinstalledFrom && result.legacyFiles.length > 0) {
    const leftover = result.legacyFiles.filter((f) => !f.startsWith(".farmwork.json"));
    if (leftover.length > 0) {
      farmTerm.section("Optional Legacy Cleanup");
      farmTerm.dim(`You can remove old ${result.reinstalledFrom} files when ready: ${leftover.join(", ")}`);
    }
  }

  farmTerm.section("Initial Health", emojis.tractor);
  farmTerm.scoreBar("Score", result.health.score, 10);

  farmTerm.section("Next Steps");
  farmTerm.info("1. Connect your AI agent via MCP (.mcp.json already wired)");
  farmTerm.info("2. Run `just` to see all recipes, `just check` to verify gates, and `bd ready` for tasks");
  farmTerm.info("3. View living docs, checklists, Beads & Justfile locally with `farmwork view`\n");
}
