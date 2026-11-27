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
  runCodeQualityScan,
  savePillarAudit,
  parseGarden,
  parseCompost,
  plantIdea,
  compostIdea,
  listPlans,
  createPlan,
  completePlan,
  graduatePlanToBeads,
  parseChecklist,
  setChecklistItem,
  addChecklistItem,
  linkChecklistItem,
  BIG_PLANS_GROUP,
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
        "Run a deterministic Farmwork audit (default: ages Idea Garden, checks state-machine/monolith hotspots, and refreshes _AUDIT/FARMHOUSE.md). Pass `pillar` ('security' | 'performance' | 'accessibility' | 'code-quality') with `score` to save a lazy pillar report to _AUDIT/<PILLAR>.md, or omit `score` with pillar='security' (secrets/CVE scan) or pillar='code-quality' (oversized files, implicit state machines, debug breakpoints, dead code). Never modifies legacy v1/v2 repos.",
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
            return jsonResult({
              saved,
              securityScan: pillar === "security" ? runSecurityScan(dir) : undefined,
              codeQualityScan: pillar === "code-quality" ? runCodeQualityScan(dir, { skipDeadCode: true }) : undefined,
            });
          }
          if (pillar === "security") return jsonResult(runSecurityScan(dir));
          if (pillar === "code-quality") return jsonResult(runCodeQualityScan(dir, { skipDeadCode: false }));
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
        "Manage the human-facing big-picture checklist (_AUDIT/CHECKLIST.md): engineering standards, 'big plans', and future roadmap items. Concise by design: 'add' is refused once the checklist hits its cap (default 30, `limits.maxChecklistItems`). NEVER add granular task breakdowns here (put agent tasks in `farmwork_beads` and connect them via `beadsId`). When the user says 'big plan' or describes a future plan, add ONE item here. Big plans don't count against the health score. Actions: 'list', 'complete', 'pending', 'skip', 'add' (defaults to 'Big Plans & Future Roadmap'), or 'link' (attach a Beads epic/issue ID or plan path).",
      inputSchema: {
        action: z.enum(["list", "complete", "pending", "skip", "add", "link"]).default("list"),
        target: z
          .union([z.number(), z.string()])
          .optional()
          .describe("Item numeric ID, title match, plan path, or Beads ID (for complete/pending/skip/link)"),
        title: z.string().optional().describe("Concise big-plan or standard text (for action='add')"),
        group: z
          .string()
          .optional()
          .describe("Section heading for new item (defaults to 'Big Plans & Future Roadmap')"),
        beadsId: z
          .string()
          .optional()
          .describe("Optional related Beads epic/issue ID so humans can follow a big plan to agent tasks"),
        planPath: z.string().optional().describe("Optional linked plan path such as '_PLANS/MY_PLAN.md'"),
        projectPath: z.string().optional().describe("Path to the project directory"),
      },
    },
    async ({ action, target, title, group, beadsId, planPath, projectPath }) => {
      try {
        const dir = resolveDir(projectPath);
        if (action === "list") return jsonResult(parseChecklist(dir));
        if (action === "add") {
          return jsonResult(
            addChecklistItem(dir, {
              group: group || BIG_PLANS_GROUP,
              title,
              beadsId: beadsId || null,
              planPath: planPath || null,
            }),
          );
        }
        if (action === "link") {
          return jsonResult(linkChecklistItem(dir, { target, beadsId, planPath }));
        }
        return jsonResult(setChecklistItem(dir, { target, state: action, beadsId, planPath }));
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
        "Manage big-picture implementation plans in _PLANS/. Actions: 'list', 'create' (saves _PLANS/<SLUG>.md, graduates matching GARDEN.md idea, and adds one concise item to _AUDIT/CHECKLIST.md under 'Big Plans & Future Roadmap'), 'to-beads' (idempotently creates a Beads epic + granular child tasks for agents and links the epic ID back to the checklist item), or 'complete' (marks both the plan and its linked checklist item Complete).",
      inputSchema: {
        action: z.enum(["list", "create", "complete", "to-beads"]).default("list"),
        title: z.string().optional().describe("Plan title (for create)"),
        plan: z.string().optional().describe("Plan slug, filename, or title (for complete or to-beads)"),
        summary: z.string().optional().describe("Problem statement and goal (for create)"),
        approach: z.string().optional().describe("Technical architecture and tradeoffs (for create)"),
        files: z.array(z.string()).optional().describe("Files expected to be modified (for create)"),
        steps: z.array(z.string()).optional().describe("Ordered implementation steps (for create)"),
        risks: z.array(z.string()).optional().describe("Key risks and verification criteria (for create)"),
        fromIdea: z.string().optional().describe("Optional GARDEN.md idea title being graduated (for create)"),
        addToChecklist: z
          .boolean()
          .optional()
          .describe("Add a concise big-plan item to _AUDIT/CHECKLIST.md (default: true)"),
        projectPath: z.string().optional().describe("Path to the project directory"),
      },
    },
    async ({ action, title, plan, summary, approach, files, steps, risks, fromIdea, addToChecklist, projectPath }) => {
      try {
        const dir = resolveDir(projectPath);
        if (action === "list") return jsonResult({ plans: listPlans(dir) });
        if (action === "create") {
          return jsonResult(
            createPlan(dir, { title, summary, approach, files, steps, risks, fromIdea, addToChecklist }),
          );
        }
        if (action === "to-beads") {
          return jsonResult(graduatePlanToBeads(dir, plan || title));
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
        "Agent-facing granular task & dependency execution tracker via Beads (`bd`). Use Beads for all detailed task breakdowns, subtasks, blockers, and execution progress (keep _AUDIT/CHECKLIST.md concise for humans and link top-level epics via `farmwork_checklist` action='link'). Closing an epic linked from the checklist (`beads: <id>`) checks off that big-plan item automatically. Actions: 'status', 'ready', 'list', 'create', 'claim', 'update', 'close', 'dep', 'sync', or 'init'.",
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
    { description: "Run a deterministic Farmwork audit, check state-machine/monolith hotspots, checklist conciseness, Beads ready work, and Justfile alignment." },
    () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: "Call `farmwork_audit`, `farmwork_beads` (`action: \"ready\"`), and `farmwork_just` (`action: \"list\"`). Summarize the health score breakdown (flagging stale gates, bloated checklists >30 items that belong in Beads, or context drift), surface oversized files or implicit state-machine hotspots (boolean flag clusters or loose status mutations), list ready Beads tasks, verify `justfile` matches configured scripts, and highlight the top 2–3 highest-leverage improvements. Do not commit any changes.",
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "inspect",
    { description: "Deep review: run quality gates, security scan, and code-quality/state-machine audit across the codebase." },
    () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: "Run `farmwork_status`, `farmwork_gates`, `farmwork_audit` (`pillar: \"security\"`), and `farmwork_audit` (`pillar: \"code-quality\"`). Perform a thorough read-only review covering Security (OWASP), Performance, Accessibility, and Code Quality — specifically auditing explicit and implicit state machines (boolean flag explosions, loose status strings mutated across files, impossible state combinations, missing transition guards). Recommend native language tools first (e.g. TypeScript discriminated unions, Rails enums + guarded methods, Rust/Python/Go enums) rather than requiring a state-machine library. Report findings by severity (CRITICAL / HIGH / MEDIUM / LOW) with file:line references and offer to save pillar reports via `farmwork_audit`.",
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
      description: "Research the codebase, record a big plan in _PLANS/ + concise checklist item, and break granular tasks into Beads.",
      argsSchema: { feature: z.string().describe("Big plan or feature to plan") },
    },
    ({ feature }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Investigate the codebase for: "${feature}". Check \`farmwork_garden\` (\`action: "list"\`), \`farmwork_checklist\` (\`action: "list"\`), and \`farmwork_beads\` (\`action: "ready"\`). Save a crisp plan using \`farmwork_plan\` (\`action: "create"\`) — this automatically adds ONE concise big-plan item to \`_AUDIT/CHECKLIST.md\` (\`Big Plans & Future Roadmap\`) for humans. NEVER add granular subtasks to the checklist; once confirmed, run \`farmwork_plan\` (\`action: "to-beads"\`) so all granular execution tasks live in Beads linked to the checklist item. Ask for explicit confirmation before editing implementation code.`,
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
    { description: "Verify quality gates, close/sync agent Beads tasks, check off human big-plan checklist items, and prepare a clean commit/push." },
    () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: "Run `farmwork_gates` to verify lint, test, build, and secrets security checks pass. Review `git diff` for stray debug logs or dead code (while preserving architectural 'why' comments). Confirm `justfile` recipes still match any added or changed scripts, close finished granular agent tasks in Beads (`farmwork_beads` `close` + `sync`), check off any newly satisfied big-picture items in `_AUDIT/CHECKLIST.md` (`farmwork_checklist`), run `farmwork_audit` to refresh _AUDIT/FARMHOUSE.md, and prepare a clean commit and push.",
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
