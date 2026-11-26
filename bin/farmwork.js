#!/usr/bin/env node

import { program } from "commander";
import { VERSION } from "../src/core.js";
import { init } from "../src/init.js";
import { status, audit, gates, security } from "../src/status.js";
import { doctor } from "../src/doctor.js";
import { startMcpServer } from "../src/mcp.js";
import { startViewer } from "../src/viewer.js";

program
  .name("farmwork")
  .description("Farmwork v3 — Agent-first standards, MCP server, and local Farm Viewer")
  .version(VERSION);

program
  .command("init")
  .description("Initialize Farmwork v3 (.farmwork.json, AGENTS.md, .mcp.json, _AUDIT/, _PLANS/)")
  .option("-f, --force", "Overwrite existing managed files (including GARDEN/CHECKLIST)")
  .option("--reinstall", "Explicitly reinstall Farmwork v3 on a past v1/v2 Farmwork project")
  .option("--npx", "Write `npx -y farmwork mcp` into .mcp.json even if global `farmwork` v3 is installed")
  .option("-y, --yes", "Accept detected defaults without prompting")
  .option("--no-mcp", "Skip writing .mcp.json")
  .action(init);

program
  .command("mcp")
  .description("Start the Farmwork MCP server over stdio (for Claude, Gemini, Codex, Cursor, Antigravity)")
  .option("--cwd <path>", "Default project path for MCP tools")
  .action(async (opts) => {
    await startMcpServer({ cwd: opts.cwd });
  });

program
  .command("view [path]")
  .description("Open the Local Farm Viewer for a single repo or a folder of local Farmwork repos")
  .option("-p, --port <port>", "Port to serve on", "4174")
  .option("--no-open", "Do not automatically open the browser")
  .action(async (targetPath, opts) => {
    await startViewer(targetPath || ".", { port: opts.port, open: opts.open });
  });

program
  .command("audit")
  .description("Run a deterministic audit, tend the Idea Garden, and update _AUDIT/FARMHOUSE.md")
  .option("--json", "Output JSON")
  .action(audit);

program
  .command("status")
  .description("Show deterministic project health, test count, checklists, and git state")
  .option("--json", "Output JSON")
  .action(status);

program
  .command("gates")
  .description("Run detected lint, test, build, and security quality gates")
  .option("--only <gates>", "Comma-separated subset: lint,test,build,security")
  .option("--json", "Output JSON")
  .action(gates);

program
  .command("security")
  .description("Run deterministic secrets scan and stack dependency vulnerability audit")
  .option("--skip-deps", "Only run fast local secrets & tracked-file scan")
  .option("--json", "Output JSON")
  .action(security);

program
  .command("doctor")
  .description("Diagnose Farmwork v3 configuration and setup health")
  .option("--json", "Output JSON")
  .action(doctor);

program.parse();
