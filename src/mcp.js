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
  runSecurityScan,
  savePillarAudit,
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
  findJustfile,
  detectJustfile,
  initJustfile,
  runJustRecipe,
  runBeadsAction,
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
     TOOLS (8 lean, deterministic agent-first tools — low token footprint)
     ------------------------------------------------------------------------ */

  server.registerTool(
    "farmwork_status",
    {
      description:
        "Get deterministic Farmwork project health score (0-10), breakdown, pillar scores, Beads issue summary, Justfile recipes, detected stack/commands, polyglot test count, last quality gate results, checklist %, Idea Garden counts, plans, and git state.",
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
        "Run a deterministic Farmwork audit (default: ages Idea Garden and refreshes _AUDIT/FARMHOUSE.md). Optionally pass `pillar` ('security' | 'performance' | 'accessibility' | 'code-quality') to save a structured lazy pillar report to _AUDIT/<PILLAR>.md (or run a deterministic security scan when pillar='security' without a score). Never modifies legacy v1/v2 repos.",
      inputSchema: {
        projectPath: z.string().optional().describe("Path to the project directory (defaults to server cwd)"),
        pillar: z
          .enum(["security", "performance", "accessibility", "code-quality"])
          .optional()
          .describe("Optional pillar audit to run/save lazily to _AUDIT/<PILLAR>.md"),
        score: z.number().min(0).max(10).optional().describe("Pillar score (0-10) when saving a pillar audit"),
        status: z.string().optional().describe("Short status label for the pillar audit"),
        summary: z.string().optional().describe("Executive summary for the pillar audit"),
        findings: z
          .array(
            z.object({
              severity: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]).optional(),
              title: z.string(),
              location: z.string().optional(),
              detail: z.string().optional(),
              fix: z.string().optional(),
            }),
          )
          .optional()
          .describe("Structured findings list when saving a pillar audit"),
        recommendations: z.array(z.string()).optional().describe("Ordered recommendations when saving a pillar audit"),
      },
    },
    async ({ projectPath, pillar, score, status, summary, findings, recommendations }) => {
      try {
        const dir = resolveDir(projectPath);
        if (pillar) {
          if (typeof score === "number") {
            const saved = savePillarAudit(dir, { pillar, score, status, summary, findings, recommendations });
            return jsonResult({ saved, securityScan: pillar === "security" ? runSecurityScan(dir) : undefined });
          }
          if (pillar === "security") {
            return jsonResult(runSecurityScan(dir));
          }
          return errorResult(`Provide a numeric \`score\` (0-10) to save a "${pillar}" pillar audit.`);
        }
        return jsonResult(runAudit(dir));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "farmwork_gates",
    {
      description:
        "Run the repository's configured quality gates (lint, test, build, and local secrets security check), record verified results for v3 repos, and return structured pass/fail output.",
      inputSchema: {
        projectPath: z.string().optional().describe("Path to the project directory (defaults to server cwd)"),
        only: z
          .array(z.enum(["lint", "test", "build", "security"]))
          .optional()
          .describe("Optional subset of gates to run (defaults to lint, test, build, security)"),
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

  server.registerTool(
    "farmwork_beads",
    {
      description:
        "Track project issues & dependency graphs via Beads (`bd`). Actions: 'status', 'ready' (unblocked next work), 'list', 'create', 'claim' (set in_progress), 'update', 'close', 'dep' (add blocker), 'sync', or 'init'.",
      inputSchema: {
        action: z
          .enum(["status", "ready", "list", "create", "claim", "update", "close", "dep", "sync", "init"])
          .default("ready"),
        id: z.string().optional().describe("Bead issue ID (for claim, update, close, dep)"),
        title: z.string().optional().describe("Issue title (for create)"),
        type: z.enum(["task", "bug", "feature", "epic", "chore"]).optional().describe("Issue type (for create or list filter)"),
        priority: z.number().int().min(0).max(4).optional().describe("Priority 0 (critical) to 4 (backlog)"),
        description: z.string().optional().describe("Issue description (for create)"),
        parent: z.string().optional().describe("Parent epic/issue ID (for create)"),
        status: z.string().optional().describe("Status value (e.g. open, in_progress, blocked, closed)"),
        assignee: z.string().optional().describe("Assignee name (for claim/update)"),
        reason: z.string().optional().describe("Completion reason (for close)"),
        blockerId: z.string().optional().describe("Blocking issue ID (for dep)"),
        prefix: z.string().optional().describe("Custom short ID prefix (for init)"),
        limit: z.number().int().min(1).max(200).optional().describe("Max issues to return (for list)"),
        projectPath: z.string().optional().describe("Path to the project directory"),
      },
    },
    async ({ action, id, title, type, priority, description, parent, status, assignee, reason, blockerId, prefix, limit, projectPath }) => {
      try {
        return jsonResult(
          runBeadsAction(resolveDir(projectPath), {
            action,
            id,
            title,
            type,
            priority,
            description,
            parent,
            status,
            assignee,
            reason,
            blockerId,
            prefix,
            limit,
          }),
        );
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "farmwork_just",
    {
      description:
        "Inspect, run, or initialize the repository's maintained `justfile` (https://just.systems). Actions: 'list' (show all recipes + docs), 'run' (execute a named recipe), or 'init' (generate a stack-aware justfile).",
      inputSchema: {
        action: z.enum(["list", "run", "init"]).default("list"),
        recipe: z.string().optional().describe("Recipe name to run (required for action='run')"),
        args: z.array(z.string()).optional().describe("Optional positional args for the recipe"),
        force: z.boolean().optional().describe("Overwrite existing justfile when action='init'"),
        projectPath: z.string().optional().describe("Path to the project directory"),
      },
    },
    async ({ action, recipe, args, force, projectPath }) => {
      try {
        const dir = resolveDir(projectPath);
        if (action === "list") return jsonResult(detectJustfile(dir));
        if (action === "init") return jsonResult(initJustfile(dir, { force: Boolean(force) }));
        return jsonResult(runJustRecipe(dir, recipe, { args }));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  /* ------------------------------------------------------------------------
     RESOURCES (Live read-only Markdown & Justfile access)
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

  server.registerResource(
    "justfile",
    "farmwork://justfile",
    { description: "Maintained repository justfile recipes", mimeType: "text/plain" },
    async () => {
      const found = findJustfile(baseCwd);
      const text = found ? fs.readFileSync(found.fullPath, "utf8") : "# No justfile yet. Run `farmwork just --init` or `farmwork_just` (action: 'init').\n";
      return { contents: [{ uri: "farmwork://justfile", mimeType: "text/plain", text }] };
    },
  );

  /* ------------------------------------------------------------------------
     PROMPTS (Cross-agent slash workflows without duplicated markdown files)
     ------------------------------------------------------------------------ */

  server.registerPrompt(
    "audit",
    { description: "Run a deterministic Farmwork audit, check Beads ready work & Justfile recipes, and summarize project health." },
    () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: "Call `farmwork_audit` on this repository, plus `farmwork_beads` (`action: \"ready\"`) and `farmwork_just` (`action: \"list\"`). Summarize the health score breakdown, flag any wilting or auto-composted ideas, surface ready Beads tasks, verify `justfile` recipes match the repo's scripts, and list the top 2–3 highest-leverage gaps. Do not commit any changes.",
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "inspect",
    { description: "Deep review: run quality gates + security scan, review security/performance/accessibility, and optionally persist pillar scores." },
    () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: "Run `farmwork_status`, `farmwork_gates`, and `farmwork_audit` with `pillar: \"security\"`. Then perform a thorough read-only code review covering Security (OWASP), Performance, Accessibility, and Code Quality. Report findings by severity (CRITICAL / HIGH / MEDIUM / LOW) with exact file:line references and concrete fixes, and offer to save any pillar report via `farmwork_audit` (`pillar`, `score`, `findings`).",
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "security",
    { description: "Run deterministic secrets/dependency scan + OWASP review and save _AUDIT/SECURITY.md." },
    () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: "Call `farmwork_audit` with `pillar: \"security\"` (no score yet) to run the deterministic secrets and dependency vulnerability scan. Then audit the codebase for OWASP Top 10 risks (auth, injection/XSS, secrets, access control, SSRF, headers). Save the structured findings and honest 0-10 score to `_AUDIT/SECURITY.md` by calling `farmwork_audit` with `pillar: \"security\"`, `score`, `summary`, `findings`, and `recommendations`.",
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "performance",
    { description: "Audit runtime speed, queries, bundle size, and rendering, then save _AUDIT/PERFORMANCE.md." },
    () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: "Inspect this codebase for performance bottlenecks (N+1 queries, missing indexes, heavy bundles, blocking I/O, unnecessary re-renders, memory leaks). Save the structured findings and honest 0-10 score to `_AUDIT/PERFORMANCE.md` using `farmwork_audit` (`pillar: \"performance\"`, `score`, `summary`, `findings`, `recommendations`).",
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "plan",
    {
      description: "Research the codebase, save a structured plan in _PLANS/, and optionally break tasks into Beads.",
      argsSchema: { feature: z.string().describe("Feature or idea to plan") },
    },
    ({ feature }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Investigate the codebase for: "${feature}". Check \`farmwork_garden\` (\`action: "list"\`) in case this graduates an existing idea, and check \`farmwork_beads\` (\`action: "ready"\`) for related open work. Save a crisp, actionable plan using \`farmwork_plan\` (\`action: "create"\`) with overview, technical approach, files to modify, ordered steps, and verification risks. Offer to create linked Beads tasks via \`farmwork_beads\` (\`action: "create"\`) once confirmed, and ask for explicit confirmation before writing implementation code.`,
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
    { description: "Verify quality gates, update justfile/checklist/Beads & audit metrics, and prepare a clean commit/push." },
    () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: "Run `farmwork_gates` to verify lint, test, build, and secrets security checks pass. Review `git diff` for stray debug logs or dead code (while preserving architectural 'why' comments). Confirm `justfile` recipes still match any added or changed scripts, close finished Beads issues (`farmwork_beads` `close` + `sync`), check `farmwork_checklist` for newly satisfied items, run `farmwork_audit` to refresh _AUDIT/FARMHOUSE.md, and prepare a clean commit and push.",
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
