import fs from "fs-extra";
import path from "path";
import {
  IGNORED_DIRS,
  VERSION,
  detectFarmworkInstall,
  isBeadsAvailable,
  isFarmworkProject,
  isGlobalFarmworkV3Available,
  resolveProjectPath,
  todayISO,
} from "./shared.js";
import { detectProject } from "./detect.js";
import { buildStarterJustfile, findJustfile, initBeads } from "./tooling.js";
import { computeHealth, runAudit } from "./audit.js";

function buildStarterChecklist(name, stack) {
  let stackSection = "";
  if (stack === "mcp-node" || stack === "mcp-python") {
    stackSection = `
## MCP Server Standards
- [ ] Zero stdout pollution on stdio transport (logs go to stderr only)
- [ ] All tool input schemas validated with strict types and clear descriptions
- [ ] Tool failures return structured \`isError\` responses without crashing the server
`;
  } else if (stack === "vite-react" || stack === "next" || stack === "react" || stack === "vite") {
    stackSection = `
## Frontend & UX
- [ ] Client environment variables properly scoped (no secrets exposed to browser bundle)
- [ ] Responsive layout & keyboard accessibility verified
- [ ] Error boundary, loading, and empty states handled cleanly
`;
  } else if (stack === "rails" || stack === "ruby") {
    stackSection = `
## Rails & Backend
- [ ] Database migrations reversible and indexed for key query paths
- [ ] N+1 queries and unpermitted parameters checked on hot endpoints
- [ ] Static analysis (RuboCop / Brakeman) clean
`;
  }

  return `# Project Checklist

> Human-readable big-picture standards, **big plans**, and **future roadmap** for **${name}** (\`${stack}\`). Keep concise (<=30 items) — granular execution tasks belong in Beads (\`.beads/\`). Use \`[x]\` done, \`[ ]\` pending, or \`[-]\` skipped (excluded from completion %).

## Foundation
- [x] Farmwork v3 initialized (\`.farmwork.json\` & \`AGENTS.md\`)
- [ ] \`justfile\` maintained with accurate dev, lint, test, and build recipes
- [ ] Active agent tasks & dependencies tracked in Beads (\`bd ready\` / \`bd sync\`)
- [ ] README documents local setup and architecture
- [ ] Environment variables documented in \`.env.example\`

## Quality & Testing
- [ ] Automated test suite runs cleanly via \`farmwork_gates\`
- [ ] Linter / static analysis passes with zero errors
- [ ] Production build succeeds cleanly
- [ ] Implicit state machines (boolean flag clusters, loose status strings) audited and modeled with native types/enums
${stackSection}
## Security & Shipping
- [ ] Secrets excluded via \`.gitignore\` and never committed
- [ ] Error handling & logging verified for production paths
- [ ] Deployment / release workflow verified

## Big Plans & Future Roadmap
<!-- Concise big plans & future roadmap items for humans. Link Beads epics with \`(beads: <id>)\`; keep granular task breakdowns in Beads. -->
`;
}

export function initProject(
  cwd,
  {
    force = false,
    reinstall = false,
    projectName = null,
    includeMcpConfig = true,
    includeJustfile = true,
    includeBeads = true,
    useNpx = false,
  } = {},
) {
  const dir = resolveProjectPath(cwd);
  const install = detectFarmworkInstall(dir);

  if (install.isLegacy && !reinstall) {
    return {
      blocked: true,
      reason: "legacy",
      generation: install.generation,
      version: install.version,
      legacyFiles: install.legacyFiles,
      message: `Past Farmwork (${install.generation}) installation detected. Farmwork v3 does not auto-update past projects. Run \`farmwork init --reinstall\` to explicitly reinstall v3 here.`,
    };
  }

  const detected = detectProject(dir, { ignoreManifest: reinstall || force });
  const name = projectName || detected.projectName;
  const today = todayISO();

  fs.ensureDirSync(path.join(dir, "_AUDIT"));
  fs.ensureDirSync(path.join(dir, "_PLANS"));

  const created = [];
  const skipped = [];

  const writeManaged = (relPath, content, { overwriteOnReinstall = false } = {}) => {
    const full = path.join(dir, relPath);
    const shouldOverwrite = force || (reinstall && overwriteOnReinstall);
    if (fs.existsSync(full) && !shouldOverwrite) {
      skipped.push(relPath);
      return false;
    }
    fs.writeFileSync(full, content);
    created.push(relPath);
    return true;
  };

  // 1. .farmwork.json manifest
  const manifest = {
    version: VERSION,
    name,
    stack: detected.stack,
    packageManager: detected.packageManager,
    commands: detected.commands,
  };
  writeManaged(".farmwork.json", `${JSON.stringify(manifest, null, 2)}\n`, { overwriteOnReinstall: true });

  const mcpUsesLocalBin = !useNpx && isGlobalFarmworkV3Available();
  const mcpServerEntry = mcpUsesLocalBin
    ? { command: "farmwork", args: ["mcp"] }
    : { command: "npx", args: ["-y", "farmwork", "mcp"] };

  // 2. Lean "thin index" AGENTS.md (<70 lines — high signal, low context tax)
  const agentsMd = `# ${name} — Agent Instructions

Uses **Farmwork v3** (\`.mcp.json\` → \`farmwork mcp\`), **Beads** (\`.beads/\`), and a maintained **\`justfile\`**.

## Workflow Rules
1. **Checklists = Humans & Big Picture (\`_AUDIT/CHECKLIST.md\`):** Keep concise (<=30 items) so humans can scan standards, **big plans**, and **future plans** at a glance. When the user says "big plan" or mentions a future plan, add one concise item under \`## Big Plans & Future Roadmap\` and link its Beads epic (\`beads: <id>\`). NEVER put granular tasks in the checklist.
2. **Beads = Agents & Execution (\`.beads/\`):** Break active work into granular tasks and dependencies in Beads (\`bd ready\` → claim → close → \`bd sync\`, or \`farmwork_beads\`). Graduate plan steps via \`farmwork_plan\` (\`to-beads\`), which links the Beads epic back to the checklist; closing that epic checks the item off.
3. **Plan first:** Save non-trivial specs to \`_PLANS/\` via \`farmwork_plan\` (\`create\`) and confirm before large edits.
4. **Maintain \`justfile\`:** Run \`just --list\` / \`just check\`; update \`justfile\` whenever scripts change.
5. **Explicit state machines:** Avoid boolean flag explosions (\`isLoading\`/\`isError\`/\`isSaving\`) and loose status strings. Model lifecycles with native language types/enums and guarded transitions — no state-machine library required.
6. **Verify before shipping:** Run \`farmwork_gates\` (lint, test, build, security), keep modules under 700 lines, preserve "why" comments, plant tangents in \`_AUDIT/GARDEN.md\`, and refresh \`_AUDIT/FARMHOUSE.md\` with \`farmwork_audit\`.

## Commands (\`${detected.stack}\`)
- **Justfile:** \`just --list\` · \`just check\` · \`just ready\`
- **Lint:** ${detected.commands.lint ? `\`${detected.commands.lint}\`` : "_not configured_"}
- **Test:** ${detected.commands.test ? `\`${detected.commands.test}\`` : "_not configured_"}
- **Build:** ${detected.commands.build ? `\`${detected.commands.build}\`` : "_not configured_"}

## MCP Tools (\`farmwork\`)
\`farmwork_status\` · \`farmwork_audit\` (incl. lazy \`security\`/\`performance\`/\`accessibility\`/\`code-quality\` pillars) · \`farmwork_gates\` · \`farmwork_beads\` (agent tasks) · \`farmwork_checklist\` (human big plans & standards) · \`farmwork_just\` · \`farmwork_garden\` · \`farmwork_plan\`
`;
  writeManaged("AGENTS.md", agentsMd, { overwriteOnReinstall: true });

  // 3. CLAUDE.md pointer
  const claudeMd = `# ${name}

Read and follow [AGENTS.md](./AGENTS.md).
`;
  writeManaged("CLAUDE.md", claudeMd, { overwriteOnReinstall: true });

  // 4. .mcp.json (merge non-destructively)
  if (includeMcpConfig) {
    const mcpPath = path.join(dir, ".mcp.json");
    let mcpObj = { mcpServers: {} };
    let existed = false;
    if (fs.existsSync(mcpPath)) {
      existed = true;
      try {
        mcpObj = JSON.parse(fs.readFileSync(mcpPath, "utf8"));
      } catch {
        mcpObj = { mcpServers: {} };
      }
    }
    if (!mcpObj.mcpServers || typeof mcpObj.mcpServers !== "object") mcpObj.mcpServers = {};
    if (!mcpObj.mcpServers.farmwork || force || reinstall) {
      mcpObj.mcpServers.farmwork = mcpServerEntry;
      fs.writeFileSync(mcpPath, `${JSON.stringify(mcpObj, null, 2)}\n`);
      created.push(existed ? ".mcp.json (merged)" : ".mcp.json");
    } else {
      skipped.push(".mcp.json");
    }
  }

  // 5. _AUDIT/GARDEN.md (COMPOST.md created lazily)
  writeManaged(
    "_AUDIT/GARDEN.md",
    `# Idea Garden

> Nursery for pre-plan ideas. Ideas age naturally: **Fresh** (0–44d), **Wilting** (45–60d), and **Auto-Composted** (>60d during \`farmwork_audit\`).

**Last Updated:** ${today}
**Active Ideas:** 0
**Wilting Ideas:** 0

---

## Ideas

_No ideas planted yet. Use \`farmwork_garden\` (\`action: "plant"\`) to plant an idea._

---

## Graduated to Plans

| Idea | Plan | Date |
|------|------|------|

---

## Implemented

| Idea | Plan | Completed |
|------|------|-----------|
`,
  );

  // 6. _AUDIT/CHECKLIST.md
  writeManaged("_AUDIT/CHECKLIST.md", buildStarterChecklist(name, detected.stack));

  // 7. Stack-aware maintained justfile
  if (includeJustfile) {
    const existingJust = findJustfile(dir);
    if (existingJust && !force) {
      skipped.push(existingJust.file);
    } else {
      const jfName = existingJust?.file || "justfile";
      fs.writeFileSync(path.join(dir, jfName), buildStarterJustfile(dir, { ...detected, projectName: name }));
      created.push(jfName);
    }
  }

  // 8. Beads (.beads/) initialization (git repos when `bd` is installed)
  let beadsNote = null;
  if (includeBeads) {
    if (fs.existsSync(path.join(dir, ".beads"))) {
      skipped.push(".beads/");
    } else if (!isBeadsAvailable()) {
      beadsNote = "Beads CLI (`bd`) not installed — install from https://beads.gascity.com/ and run `bd init`";
    } else if (!fs.existsSync(path.join(dir, ".git"))) {
      beadsNote = "Not a git repo yet — run `git init && bd init` to enable Beads task tracking";
    } else {
      try {
        const bdRes = initBeads(dir);
        if (bdRes.created) created.push(".beads/");
      } catch (err) {
        beadsNote = `Beads init skipped (${err instanceof Error ? err.message : String(err)})`;
      }
    }
  }

  // 9. Initial deterministic audit
  const hadFarmhouse = fs.existsSync(path.join(dir, "_AUDIT", "FARMHOUSE.md"));
  const audit = runAudit(dir);
  created.push(hadFarmhouse ? "_AUDIT/FARMHOUSE.md (refreshed)" : "_AUDIT/FARMHOUSE.md");

  return {
    blocked: false,
    reinstalledFrom: reinstall && install.isLegacy ? install.generation : null,
    legacyFiles: install.legacyFiles,
    projectName: name,
    stack: detected.stack,
    commands: detected.commands,
    created,
    skipped,
    beadsNote,
    health: audit.health,
  };
}

/* ============================================================================
   Local Docs & Multi-Farm Folder Scanner (for Local Farm Viewer)
   ============================================================================ */

export function countFarmDocs(cwd) {
  const dir = resolveProjectPath(cwd);
  let count = 0;
  for (const rootDoc of ["AGENTS.md", "CLAUDE.md", "README.md"]) {
    if (fs.existsSync(path.join(dir, rootDoc))) count++;
  }
  if (findJustfile(dir)) count++;
  for (const subDir of ["_AUDIT", "_PLANS", "_OFFICE", "_RESEARCH"]) {
    const fullDir = path.join(dir, subDir);
    if (!fs.existsSync(fullDir)) continue;
    try {
      count += fs.readdirSync(fullDir).filter((n) => n.endsWith(".md")).length;
    } catch {
      // ignore
    }
  }
  return count;
}

export function readFarmDocs(cwd) {
  const dir = resolveProjectPath(cwd);
  const docs = [];

  const addFile = (relPath, category) => {
    const full = path.join(dir, relPath);
    let stat;
    try {
      stat = fs.statSync(full);
    } catch {
      return;
    }
    if (!stat.isFile()) return;
    const content = fs.readFileSync(full, "utf8");
    const titleMatch = content.match(/^#\s+(.+)$/m);
    docs.push({
      path: relPath,
      name: path.basename(relPath),
      category,
      title: titleMatch ? titleMatch[1].trim() : path.basename(relPath),
      updatedAt: stat.mtime.toISOString(),
      content,
    });
  };

  for (const rootDoc of ["AGENTS.md", "CLAUDE.md", "README.md"]) {
    addFile(rootDoc, "Root");
  }
  const justFound = findJustfile(dir);
  if (justFound) {
    const stat = fs.statSync(justFound.fullPath);
    docs.push({
      path: justFound.file,
      name: justFound.file,
      category: "Root",
      title: `Justfile (${justFound.file})`,
      updatedAt: stat.mtime.toISOString(),
      content: "```makefile\n" + fs.readFileSync(justFound.fullPath, "utf8") + "\n```",
    });
  }

  const scanDir = (subDir, category) => {
    const fullDir = path.join(dir, subDir);
    if (!fs.existsSync(fullDir)) return;
    for (const f of fs.readdirSync(fullDir).filter((n) => n.endsWith(".md")).sort()) {
      addFile(`${subDir}/${f}`, category);
    }
  };

  scanDir("_AUDIT", "Audit");
  scanDir("_PLANS", "Plans");
  scanDir("_OFFICE", "Legacy Office");
  scanDir("_RESEARCH", "Legacy Research");

  return docs;
}

export function scanFarms(rootDir) {
  const root = resolveProjectPath(rootDir);
  const found = [];
  const seen = new Set();

  const tryAdd = (dir) => {
    const resolved = path.resolve(dir);
    if (seen.has(resolved)) return false;
    if (isFarmworkProject(resolved)) {
      seen.add(resolved);
      found.push(computeHealth(resolved));
      return true;
    }
    return false;
  };

  const rootIsFarm = tryAdd(root);

  const scanChildren = (parentDir, depth) => {
    if (depth > 2) return;
    let entries = [];
    try {
      entries = fs.readdirSync(parentDir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".") || IGNORED_DIRS.has(entry.name)) continue;
      const child = path.join(parentDir, entry.name);
      if (tryAdd(child)) continue;
      if (depth < 2 && !fs.existsSync(path.join(child, ".git"))) {
        scanChildren(child, depth + 1);
      }
    }
  };

  if (!rootIsFarm || !fs.existsSync(path.join(root, ".git"))) {
    scanChildren(root, 1);
  }

  found.sort((a, b) => a.projectName.localeCompare(b.projectName));
  return { root, farms: found };
}
