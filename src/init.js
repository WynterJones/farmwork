import inquirer from "inquirer";
import { VERSION, detectFarmworkInstall, detectProject, initProject } from "./core.js";
import { farmTerm, emojis } from "./terminal.js";

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
  farmTerm.section("Detected Project", emojis.seedling);
  farmTerm.kv("Project", detected.projectName);
  farmTerm.kv("Stack", detected.stack);
  farmTerm.kv("Lint", detected.commands.lint || "(none)");
  farmTerm.kv("Test", detected.commands.test || "(none)");
  farmTerm.kv("Build", detected.commands.build || "(none)");

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
    const { ok } = await inquirer.prompt([
      {
        type: "confirm",
        name: "ok",
        message: options.reinstall
          ? "Reinstall Farmwork v3 with these settings?"
          : "Initialize Farmwork v3 with these settings?",
        default: true,
      },
    ]);
    if (!ok) {
      const answer = await inquirer.prompt([
        { type: "input", name: "projectName", message: "Project name:", default: projectName },
      ]);
      projectName = answer.projectName;
    }
  }

  const result = initProject(cwd, {
    force: Boolean(options.force),
    reinstall: Boolean(options.reinstall),
    useNpx: Boolean(options.npx),
    projectName,
    includeMcpConfig: options.mcp !== false,
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
  farmTerm.info("2. Run `farmwork gates` to verify lint/test/build and earn gate points");
  farmTerm.info("3. View all living docs & checklists locally with `farmwork view`\n");
}
