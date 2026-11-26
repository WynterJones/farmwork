import { VERSION, computeHealth } from "./core.js";
import { farmTerm } from "./terminal.js";

export async function doctor(options = {}) {
  const cwd = process.cwd();
  const health = computeHealth(cwd);
  const isLegacy = Boolean(health.install?.isLegacy);
  const legacyList = (health.install?.legacyFiles || []).filter((f) => !f.startsWith(".farmwork.json"));
  const repairCmd = isLegacy ? "Run `farmwork init --reinstall`" : "Run `farmwork init`";

  const checks = [
    {
      label: ".farmwork.json v3 manifest",
      passed: health.files.v3Manifest,
      fix: isLegacy ? `Legacy ${health.install.generation} detected — run \`farmwork init --reinstall\`` : "Run `farmwork init`",
    },
    { label: "AGENTS.md universal instructions", passed: health.files.agentsMd, fix: repairCmd },
    { label: "CLAUDE.md pointer", passed: health.files.claudeMd, fix: repairCmd },
    { label: ".mcp.json MCP server config", passed: health.files.mcpConfig, fix: repairCmd },
    { label: "_AUDIT/FARMHOUSE.md", passed: health.files.farmhouse, fix: isLegacy ? repairCmd : "Run `farmwork audit`" },
    { label: "_AUDIT/CHECKLIST.md", passed: health.files.checklist, fix: repairCmd },
    { label: "_AUDIT/GARDEN.md", passed: health.files.garden, fix: repairCmd },
    { label: "_PLANS/ directory", passed: health.files.plansDir, fix: repairCmd },
    {
      label: "Maintained justfile present",
      passed: Boolean(health.justfile?.exists),
      fix: "Run `farmwork just --init` (install `just` from https://just.systems/man/en/)",
    },
    {
      label: "Beads (.beads/) task graph initialized",
      passed: Boolean(health.beads?.initialized),
      fix: health.beads?.installed
        ? "Run `farmwork beads --init` (or `bd init`)"
        : "Install `bd` from https://beads.gascity.com/ then run `bd init`",
    },
    {
      label: "Automated test files detected",
      passed: health.metrics.testFiles > 0,
      fix: `Add tests for stack "${health.stack}"`,
    },
    {
      label: "No legacy v1/v2 artifacts",
      passed: legacyList.length === 0,
      fix: legacyList.length > 0 ? `Optional cleanup: ${legacyList.join(", ")}` : "",
    },
  ];

  const passed = checks.filter((c) => c.passed).length;
  const failed = checks.length - passed;

  if (options.json) {
    console.log(JSON.stringify({ projectName: health.projectName, install: health.install, passed, failed, checks }, null, 2));
    return;
  }

  farmTerm.banner(VERSION);
  farmTerm.header(`DOCTOR · ${health.projectName}`);

  if (isLegacy) {
    farmTerm.warn(`Legacy Farmwork (${health.install.generation}) detected — v3 leaves past projects untouched until you run \`farmwork init --reinstall\`.\n`);
  }

  for (const c of checks) {
    farmTerm.status(c.label, c.passed, c.passed ? "" : c.fix);
  }

  console.log("");
  farmTerm.scoreBar("Doctor Score", passed, checks.length);
  if (failed === 0) {
    farmTerm.success("All Farmwork v3 checks passed.\n");
  } else if (isLegacy) {
    farmTerm.warn(`Past Farmwork (${health.install.generation}) repo. Run \`farmwork init --reinstall\` if you want to move it to v3.\n`);
  } else {
    farmTerm.warn(`${failed} issue(s) found. Run \`farmwork init\` to repair missing files.\n`);
  }
}
