import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "fs-extra";
import path from "path";
import {
  VERSION,
  FARMWORK_STANDARDS_MD,
  resolveProjectPath,
  computeHealth,
  runAudit,
  runGates,
  parseGarden,
  parseCompost,
  plantIdea,
  compostIdea,
  listPlans,
  createPlan,
  completePlan,
  parseChecklist,
  setChecklistItem,
  addChecklistItem,
} from "./core.js";

function jsonResult(data) {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

function errorResult(err) {
  return {
    isError: true,
    content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
  };
}

export function createFarmworkMcpServer(defaultCwd = process.cwd()) {
  const baseCwd = resolveProjectPath(defaultCwd);
  const resolveDir = (projectPath) => resolveProjectPath(projectPath || baseCwd);

  const server = new McpServer({
    name: "farmwork",
    version: VERSION,
  });

  /* ------------------------------------------------------------------------
     TOOLS (6 lean, deterministic agent-first tools — low token footprint)
     ------------------------------------------------------------------------ */

  server.registerTool(
    "farmwork_status",
    {
      description:
        "Get deterministic Farmwork project health score (0-10), breakdown, detected stack/commands, polyglot test count, last quality gate results, checklist %, Idea Garden counts, plans, and git state.",
      inputSchema: {
        projectPath: z.string().optional().describe("Path to the project directory (defaults to server cwd)"),
      },
    },
    async ({ projectPath }) => {
      try {
        return jsonResult(computeHealth(resolveDir(projectPath)));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "farmwork_audit",
    {
      description:
        "Run a deterministic Farmwork audit on a v3 repo: ages the Idea Garden (45-60d wilting, >60d auto-compost) and refreshes _AUDIT/FARMHOUSE.md. Never modifies legacy v1/v2 repos.",
      inputSchema: {
        projectPath: z.string().optional().describe("Path to the project directory (defaults to server cwd)"),
      },
    },
    async ({ projectPath }) => {
      try {
        return jsonResult(runAudit(resolveDir(projectPath)));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "farmwork_gates",
    {
      description:
        "Run the repository's configured quality gates (lint, test, build), record verified results for v3 repos, and return structured pass/fail output.",
      inputSchema: {
        projectPath: z.string().optional().describe("Path to the project directory (defaults to server cwd)"),
        only: z
          .array(z.enum(["lint", "test", "build"]))
          .optional()
          .describe("Optional subset of gates to run (defaults to all configured gates)"),
      },
    },
    async ({ projectPath, only }) => {
      try {
        return jsonResult(runGates(resolveDir(projectPath), { only }));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "farmwork_checklist",
    {
      description:
        "Read or update _AUDIT/CHECKLIST.md. Actions: 'list', 'complete', 'pending', 'skip' (removes from denominator), or 'add'.",
      inputSchema: {
        action: z.enum(["list", "complete", "pending", "skip", "add"]).default("list"),
        target: z
          .union([z.number(), z.string()])
          .optional()
          .describe("Item numeric ID or title match (for complete/pending/skip)"),
        title: z.string().optional().describe("New checklist item text (for action='add')"),
        group: z.string().optional().describe("Section heading for new item (for action='add')"),
        projectPath: z.string().optional().describe("Path to the project directory"),
      },
    },
    async ({ action, target, title, group, projectPath }) => {
      try {
        const dir = resolveDir(projectPath);
        if (action === "list") return jsonResult(parseChecklist(dir));
        if (action === "add") return jsonResult(addChecklistItem(dir, { group: group || "Project Standards", title }));
        return jsonResult(setChecklistItem(dir, { target, state: action }));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "farmwork_garden",
    {
      description:
        "Manage the Idea Garden (_AUDIT/GARDEN.md & lazy _AUDIT/COMPOST.md). Actions: 'list' (with computed ages), 'plant' (add dated idea), or 'compost' (retire with reason).",
      inputSchema: {
        action: z.enum(["list", "plant", "compost"]).default("list"),
        title: z.string().optional().describe("Idea title (required for plant/compost)"),
        description: z.string().optional().describe("Short summary (for plant/compost)"),
        bullets: z.array(z.string()).optional().describe("Key detail bullets (for plant)"),
        reason: z.string().optional().describe("Why this idea is being retired (for compost)"),
        projectPath: z.string().optional().describe("Path to the project directory"),
      },
    },
    async ({ action, title, description, bullets, reason, projectPath }) => {
      try {
        const dir = resolveDir(projectPath);
        if (action === "list") {
          return jsonResult({ garden: parseGarden(dir), compost: parseCompost(dir) });
        }
        if (action === "plant") {
          return jsonResult(plantIdea(dir, { title, description, bullets }));
        }
        return jsonResult(compostIdea(dir, { title, reason: reason || "Retired", description }));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "farmwork_plan",
    {
      description:
        "Manage implementation plans in _PLANS/. Actions: 'list', 'create' (saves _PLANS/<SLUG>.md and graduates matching GARDEN.md idea), or 'complete' (marks Complete and logs in GARDEN.md).",
      inputSchema: {
        action: z.enum(["list", "create", "complete"]).default("list"),
        title: z.string().optional().describe("Plan title (for create)"),
        plan: z.string().optional().describe("Plan slug, filename, or title (for complete)"),
        summary: z.string().optional().describe("Problem statement and goal (for create)"),
        approach: z.string().optional().describe("Technical architecture and tradeoffs (for create)"),
        files: z.array(z.string()).optional().describe("Files expected to be modified (for create)"),
        steps: z.array(z.string()).optional().describe("Ordered implementation steps (for create)"),
        risks: z.array(z.string()).optional().describe("Key risks and verification criteria (for create)"),
        fromIdea: z.string().optional().describe("Optional GARDEN.md idea title being graduated (for create)"),
        projectPath: z.string().optional().describe("Path to the project directory"),
      },
    },
    async ({ action, title, plan, summary, approach, files, steps, risks, fromIdea, projectPath }) => {
      try {
        const dir = resolveDir(projectPath);
        if (action === "list") return jsonResult({ plans: listPlans(dir) });
        if (action === "create") {
          return jsonResult(createPlan(dir, { title, summary, approach, files, steps, risks, fromIdea }));
        }
        return jsonResult(completePlan(dir, plan || title));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  /* ------------------------------------------------------------------------
     RESOURCES (Live read-only Markdown access)
     ------------------------------------------------------------------------ */

  const registerDocResource = (name, uri, description, relPath) => {
    server.registerResource(name, uri, { description, mimeType: "text/markdown" }, async () => {
      const full = path.join(baseCwd, relPath);
      const text = fs.existsSync(full)
        ? fs.readFileSync(full, "utf8")
        : `_${relPath} does not exist yet._`;
      return { contents: [{ uri, mimeType: "text/markdown", text }] };
    });
  };

  server.registerResource(
    "standards",
    "farmwork://standards",
    { description: "Farmwork v3 universal agent engineering standards", mimeType: "text/markdown" },
    async () => ({
      contents: [{ uri: "farmwork://standards", mimeType: "text/markdown", text: FARMWORK_STANDARDS_MD }],
    }),
  );

  registerDocResource("farmhouse", "farmwork://farmhouse", "Living audit health report (_AUDIT/FARMHOUSE.md)", "_AUDIT/FARMHOUSE.md");
  registerDocResource("garden", "farmwork://garden", "Pre-plan Idea Garden (_AUDIT/GARDEN.md)", "_AUDIT/GARDEN.md");
  registerDocResource("compost", "farmwork://compost", "Retired ideas archive (_AUDIT/COMPOST.md)", "_AUDIT/COMPOST.md");
  registerDocResource("checklist", "farmwork://checklist", "Engineering standards checklist (_AUDIT/CHECKLIST.md)", "_AUDIT/CHECKLIST.md");

  /* ------------------------------------------------------------------------
     PROMPTS (Cross-agent slash workflows without duplicated markdown files)
     ------------------------------------------------------------------------ */

  server.registerPrompt(
    "audit",
    { description: "Run a deterministic Farmwork audit, tend the Idea Garden, and summarize project health." },
    () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: "Call `farmwork_audit` on this repository. Summarize the health score breakdown, flag any wilting or auto-composted ideas, and list the top 2–3 highest-leverage checklist or test gaps. Do not commit any changes.",
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "inspect",
    { description: "Deep read-only review: run quality gates plus code, security, performance, and accessibility review." },
    () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: "Run `farmwork_status` and `farmwork_gates`. Then perform a thorough read-only code review covering correctness, security (OWASP), performance, maintainability, and accessibility. Report findings inline by severity (CRITICAL / HIGH / MEDIUM / LOW) with exact file:line references and concrete fixes. Do not edit or commit files.",
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "plan",
    {
      description: "Research the codebase and save a structured plan in _PLANS/ before writing code.",
      argsSchema: { feature: z.string().describe("Feature or idea to plan") },
    },
    ({ feature }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Investigate the codebase for: "${feature}". Check \`farmwork_garden\` (\`action: "list"\`) in case this graduates an existing idea. Save a crisp, actionable plan using \`farmwork_plan\` (\`action: "create"\`) with overview, technical approach, files to modify, ordered steps, and verification risks. Show the saved plan path and ask for explicit confirmation before writing implementation code.`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "new-ideas",
    { description: "Review GARDEN.md and COMPOST.md, brainstorm 8 tailored ideas, and plant the user's picks." },
    () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: "Call `farmwork_garden` (`action: \"list\"`) and inspect the repository structure. Propose 8 concrete, high-leverage ideas tailored to this project while avoiding anything already in COMPOST.md. Present them as a numbered list and ask which numbers the user wants to plant via `farmwork_garden` (`action: \"plant\"`).",
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "ship",
    { description: "Verify quality gates, update checklist & audit metrics, and prepare a clean commit/push." },
    () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: "Run `farmwork_gates` to verify lint, test, and build pass. Review `git diff` for stray debug logs or dead code (while preserving architectural 'why' comments). Check `farmwork_checklist` to see if any items were newly satisfied, run `farmwork_audit` to refresh _AUDIT/FARMHOUSE.md, and prepare a clean commit and push.",
          },
        },
      ],
    }),
  );

  return server;
}

export async function startMcpServer({ cwd } = {}) {
  const server = createFarmworkMcpServer(cwd || process.cwd());
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
