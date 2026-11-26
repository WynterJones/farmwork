import fs from "fs-extra";
import path from "path";
import { execSync, spawnSync } from "child_process";

export const VERSION = "3.0.0";

const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  "vendor",
  "dist",
  "build",
  "target",
  ".next",
  ".nuxt",
  ".svelte-kit",
  "tmp",
  "log",
  "coverage",
  ".venv",
  "venv",
  "__pycache__",
  ".cache",
  "storage",
]);

const TEST_FILE_PATTERNS = [
  /\.test\.[cm]?[jt]sx?$/i,
  /\.spec\.[cm]?[jt]sx?$/i,
  /_test\.rb$/i,
  /_spec\.rb$/i,
  /_test\.go$/i,
  /^test_.*\.py$/i,
  /_test\.py$/i,
  /_test\.rs$/i,
];

const LEGACY_V1_AUDIT_FILES = [
  "SECURITY.md",
  "PERFORMANCE.md",
  "ACCESSIBILITY.md",
  "CODE_QUALITY.md",
  "KNIP.md",
  "TESTS.md",
];

export class LegacyFarmworkError extends Error {
  constructor(dir, install) {
    super(
      `Legacy Farmwork (${install.generation}) detected in "${dir}". Farmwork v3 does not auto-update past projects. Run \`farmwork init --reinstall\` inside that repo if you want to reinstall v3.`,
    );
    this.name = "LegacyFarmworkError";
    this.code = "LEGACY_FARMWORK";
    this.generation = install.generation;
    this.legacyFiles = install.legacyFiles;
  }
}

function plural(n, singular, pluralWord = `${singular}s`) {
  return `${n} ${n === 1 ? singular : pluralWord}`;
}

export const FARMWORK_STANDARDS_MD = `# Farmwork v3 Agent Standards

> Living operational contract for any AI coding agent (Claude Code, Gemini CLI, Codex, Cursor, Antigravity) working on a real software project.

## Core Principles
1. **Plan Before Non-Trivial Code** — Save plans to \`_PLANS/<FEATURE_NAME>.md\` using \`farmwork_plan\` (\`action: "create"\`) and get confirmation before large edits.
2. **Deterministic Truth Over Guesses** — Always call \`farmwork_status\` or \`farmwork_audit\` instead of manually estimating test counts or scores.
3. **Verify Gates Before Shipping** — Run \`farmwork_gates\` (lint, test, build) and fix failures before committing or claiming work is complete.
4. **Preserve Architectural Comments** — Remove debug \`console.log\` noise and dead code, but **never** strip comments that explain *why* a non-obvious decision exists.
5. **Keep Living Docs Honest** — Use \`farmwork_checklist\` as you finish standards items, \`farmwork_garden\` (\`action: "plant"\`) for out-of-scope ideas instead of scope-creeping, and \`farmwork_audit\` after shipping meaningful milestones.
6. **Repo Is the Source of Truth** — All state lives as plain Markdown + \`.farmwork.json\` inside git so any agent or human can read it with zero lock-in.
`;

export function todayISO() {
  return new Date().toISOString().split("T")[0];
}

export function slugifyPlan(title) {
  return (
    String(title || "UNTITLED")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "UNTITLED"
  );
}

export function daysBetween(dateStr, refDate = new Date()) {
  if (!dateStr) return 0;
  const parsed = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return 0;
  const refUtc = Date.UTC(refDate.getUTCFullYear(), refDate.getUTCMonth(), refDate.getUTCDate());
  return Math.max(0, Math.floor((refUtc - parsed.getTime()) / (1000 * 60 * 60 * 24)));
}

export function resolveProjectPath(projectPath) {
  return path.resolve(projectPath || process.cwd());
}

export function isFarmworkProject(cwd) {
  return (
    fs.existsSync(path.join(cwd, ".farmwork.json")) ||
    fs.existsSync(path.join(cwd, "_AUDIT", "FARMHOUSE.md"))
  );
}

export function readManifest(cwd) {
  const manifestPath = path.join(cwd, ".farmwork.json");
  if (!fs.existsSync(manifestPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch {
    return null;
  }
}

/**
 * Inspect whether a directory has Farmwork v3, a legacy v1/v2 installation, or none.
 * Legacy repos are never auto-updated — users must explicitly run `farmwork init --reinstall`.
 */
export function detectFarmworkInstall(cwd) {
  const dir = resolveProjectPath(cwd);
  const manifest = readManifest(dir);
  const legacyFiles = [];

  if (fs.existsSync(path.join(dir, "_OFFICE"))) legacyFiles.push("_OFFICE/");
  if (fs.existsSync(path.join(dir, "_RESEARCH"))) legacyFiles.push("_RESEARCH/");
  if (fs.existsSync(path.join(dir, ".claude", "agents", "the-farmer.md"))) legacyFiles.push(".claude/agents/");
  if (fs.existsSync(path.join(dir, ".claude", "commands", "audit.md"))) legacyFiles.push(".claude/commands/");
  for (const f of LEGACY_V1_AUDIT_FILES) {
    if (fs.existsSync(path.join(dir, "_AUDIT", f))) {
      legacyFiles.push(`_AUDIT/${f}`);
    }
  }

  if (manifest?.version && /^3\./.test(String(manifest.version))) {
    return { generation: "v3", version: String(manifest.version), isLegacy: false, legacyFiles };
  }

  if (manifest) {
    return {
      generation: "v1",
      version: manifest.version ? String(manifest.version) : "1.x",
      isLegacy: true,
      legacyFiles: [".farmwork.json (legacy)", ...legacyFiles],
    };
  }

  const hasFarmhouse = fs.existsSync(path.join(dir, "_AUDIT", "FARMHOUSE.md"));
  const hasLegacyClaude =
    fs.existsSync(path.join(dir, ".claude", "commands", "audit.md")) ||
    fs.existsSync(path.join(dir, ".claude", "agents", "the-farmer.md"));
  const hasV1Dirs = fs.existsSync(path.join(dir, "_OFFICE")) || fs.existsSync(path.join(dir, "_RESEARCH"));

  if (hasFarmhouse || hasLegacyClaude || hasV1Dirs) {
    const generation = hasV1Dirs || legacyFiles.some((f) => f.startsWith("_AUDIT/")) ? "v1" : "v2";
    return { generation, version: generation, isLegacy: true, legacyFiles };
  }

  return { generation: "none", version: null, isLegacy: false, legacyFiles: [] };
}

export function assertWritableV3(cwd) {
  const dir = resolveProjectPath(cwd);
  const install = detectFarmworkInstall(dir);
  if (install.isLegacy) {
    throw new LegacyFarmworkError(dir, install);
  }
  return install;
}

function isPlaceholderTestScript(cmd) {
  return typeof cmd === "string" && /no test specified/i.test(cmd);
}

let cachedGlobalV3 = null;

export function isGlobalFarmworkV3Available() {
  if (cachedGlobalV3 !== null) return cachedGlobalV3;
  try {
    const out = execSync("farmwork --version", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 2500 }).trim();
    cachedGlobalV3 = /^3\./.test(out);
  } catch {
    cachedGlobalV3 = false;
  }
  return cachedGlobalV3;
}

function detectNodeStack(dir, pkg) {
  const deps = { ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) };
  if (deps["@modelcontextprotocol/sdk"] || deps.fastmcp) return "mcp-node";

  const hasVite =
    Boolean(deps.vite) ||
    fs.existsSync(path.join(dir, "vite.config.js")) ||
    fs.existsSync(path.join(dir, "vite.config.ts")) ||
    fs.existsSync(path.join(dir, "vite.config.mjs"));
  const hasNext =
    Boolean(deps.next) ||
    fs.existsSync(path.join(dir, "next.config.js")) ||
    fs.existsSync(path.join(dir, "next.config.mjs")) ||
    fs.existsSync(path.join(dir, "next.config.ts"));
  const hasReact = Boolean(deps.react);

  if (hasNext) return "next";
  if (hasVite && hasReact) return "vite-react";
  if (hasVite) return "vite";
  if (hasReact) return "react";
  return "node";
}

/**
 * Auto-detect stack and lint/test/build commands across Ruby/Rails, Node/Vite/React, Python, Rust, and Go.
 * Honors overrides in a v3 .farmwork.json when present (unless ignoreManifest is true).
 */
export function detectProject(cwd, { ignoreManifest = false } = {}) {
  const dir = resolveProjectPath(cwd);
  const rawManifest = readManifest(dir);
  const isV3Manifest = Boolean(rawManifest?.version && /^3\./.test(String(rawManifest.version)));
  const manifest = !ignoreManifest && isV3Manifest ? rawManifest : null;

  let stack = "generic";
  let packageManager = null;
  let projectName = path.basename(dir);
  let testCommand = null;
  let buildCommand = null;
  let lintCommand = null;

  const hasGemfile = fs.existsSync(path.join(dir, "Gemfile"));
  const hasRailsBin = fs.existsSync(path.join(dir, "bin", "rails"));
  const pkgPath = path.join(dir, "package.json");

  if (hasGemfile && hasRailsBin) {
    // Check Rails before package.json because Rails apps frequently include package.json for Tailwind/JS assets
    stack = "rails";
    packageManager = "bundler";
    testCommand = fs.existsSync(path.join(dir, "spec")) ? "bundle exec rspec" : "bin/rails test";
    buildCommand = "SECRET_KEY_BASE_DUMMY=1 bin/rails assets:precompile";
    if (fs.existsSync(path.join(dir, "bin", "rubocop"))) {
      lintCommand = "bin/rubocop";
    } else if (fs.existsSync(path.join(dir, ".rubocop.yml"))) {
      lintCommand = "bundle exec rubocop";
    }
  } else if (fs.existsSync(pkgPath)) {
    stack = "node";
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
      if (pkg.name) projectName = pkg.name;
      stack = detectNodeStack(dir, pkg);
      const scripts = pkg.scripts || {};
      if (fs.existsSync(path.join(dir, "bun.lockb")) || fs.existsSync(path.join(dir, "bun.lock"))) {
        packageManager = "bun";
      } else if (fs.existsSync(path.join(dir, "pnpm-lock.yaml"))) {
        packageManager = "pnpm";
      } else if (fs.existsSync(path.join(dir, "yarn.lock"))) {
        packageManager = "yarn";
      } else {
        packageManager = "npm";
      }
      const run = (script) =>
        scripts[script] && !isPlaceholderTestScript(scripts[script]) ? `${packageManager} run ${script}` : null;
      testCommand = run("test") || run("test:run");
      buildCommand = run("build");
      lintCommand = run("lint") || run("check") || run("typecheck");
    } catch {
      // ignore malformed package.json
    }
  } else if (hasGemfile) {
    stack = "ruby";
    packageManager = "bundler";
    if (fs.existsSync(path.join(dir, "spec"))) {
      testCommand = "bundle exec rspec";
    }
    if (fs.existsSync(path.join(dir, "bin", "rubocop"))) {
      lintCommand = "bin/rubocop";
    } else if (fs.existsSync(path.join(dir, ".rubocop.yml"))) {
      lintCommand = "bundle exec rubocop";
    }
  } else if (fs.existsSync(path.join(dir, "Cargo.toml"))) {
    stack = "rust";
    packageManager = "cargo";
    testCommand = "cargo test";
    buildCommand = "cargo build";
    lintCommand = "cargo clippy --all-targets";
  } else if (fs.existsSync(path.join(dir, "go.mod"))) {
    stack = "go";
    packageManager = "go";
    testCommand = "go test ./...";
    buildCommand = "go build ./...";
    lintCommand = "go vet ./...";
  } else if (
    fs.existsSync(path.join(dir, "pyproject.toml")) ||
    fs.existsSync(path.join(dir, "requirements.txt"))
  ) {
    let isMcpPy = false;
    try {
      const pyMeta = fs.existsSync(path.join(dir, "pyproject.toml"))
        ? fs.readFileSync(path.join(dir, "pyproject.toml"), "utf8")
        : fs.readFileSync(path.join(dir, "requirements.txt"), "utf8");
      isMcpPy = /\b(fastmcp|mcp)\b/i.test(pyMeta);
    } catch {
      // ignore
    }
    stack = isMcpPy ? "mcp-python" : "python";
    packageManager = fs.existsSync(path.join(dir, "uv.lock")) ? "uv" : "pip";
    testCommand = packageManager === "uv" ? "uv run pytest" : "pytest";
    lintCommand = packageManager === "uv" ? "uv run ruff check ." : "ruff check .";
  }

  return {
    projectName: manifest?.name || (!ignoreManifest && rawManifest?.projectName) || projectName,
    stack: manifest?.stack || stack,
    packageManager: manifest?.packageManager ?? packageManager,
    commands: {
      test: manifest?.commands?.test ?? testCommand,
      build: manifest?.commands?.build ?? buildCommand,
      lint: manifest?.commands?.lint ?? lintCommand,
    },
    lastGates: manifest?.lastGates || null,
    hasManifest: Boolean(rawManifest),
    hasV3Manifest: isV3Manifest,
    farmworkVersion: rawManifest?.version || null,
  };
}

export function countTestFiles(cwd) {
  const dir = resolveProjectPath(cwd);
  let count = 0;

  function walk(current, depth) {
    if (depth > 8) return;
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full, depth + 1);
      } else if (entry.isFile()) {
        if (TEST_FILE_PATTERNS.some((re) => re.test(entry.name))) {
          count++;
        }
      }
    }
  }

  walk(dir, 0);
  return count;
}

export function getGitState(cwd) {
  const dir = resolveProjectPath(cwd);
  if (!fs.existsSync(path.join(dir, ".git"))) {
    return { isGitRepo: false, branch: null, dirtyCount: 0, ahead: 0, behind: 0, lastCommitDate: null, lastCommitMessage: null };
  }

  const runGit = (args) => {
    try {
      return execSync(`git ${args}`, { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    } catch {
      return "";
    }
  };

  const branch = runGit("rev-parse --abbrev-ref HEAD") || null;
  const porcelain = runGit("status --porcelain");
  const dirtyCount = porcelain ? porcelain.split("\n").filter(Boolean).length : 0;

  let ahead = 0;
  let behind = 0;
  const revList = runGit("rev-list --left-right --count @{u}...HEAD");
  if (revList) {
    const [b, a] = revList.split(/\s+/).map((n) => parseInt(n, 10) || 0);
    behind = b;
    ahead = a;
  }

  const lastCommitDate = runGit("log -1 --format=%cs") || null;
  const lastCommitMessage = runGit("log -1 --format=%s") || null;

  return { isGitRepo: true, branch, dirtyCount, ahead, behind, lastCommitDate, lastCommitMessage };
}

/* ============================================================================
   Idea Garden & Compost
   ============================================================================ */

export function parseGarden(cwd) {
  const dir = resolveProjectPath(cwd);
  const filePath = path.join(dir, "_AUDIT", "GARDEN.md");
  if (!fs.existsSync(filePath)) {
    return { exists: false, ideas: [], graduated: [], implemented: [] };
  }

  const content = fs.readFileSync(filePath, "utf8");
  const ideasSectionMatch = content.match(/## Ideas\s*\n([\s\S]*?)(?=\n---|\n## |$)/);
  // Strip HTML comments before parsing so commented-out template examples are ignored
  const ideasBlock = (ideasSectionMatch ? ideasSectionMatch[1] : "").replace(/<!--[\s\S]*?-->/g, "");

  const ideas = [];
  const headingRegex = /^###\s+(.+)$/gm;
  const matches = [...ideasBlock.matchAll(headingRegex)];

  for (let i = 0; i < matches.length; i++) {
    const rawTitle = matches[i][1].trim();
    const title = rawTitle.replace(/\s*⚠️\s*WILTING\s*$/i, "").trim();
    const start = matches[i].index + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : ideasBlock.length;
    const body = ideasBlock.slice(start, end).replace(/<!--[\s\S]*?-->/g, "").trim();

    const plantedMatch = body.match(/\*\*Planted:\*\*\s*(\d{4}-\d{2}-\d{2})/);
    const planted = plantedMatch ? plantedMatch[1] : null;
    const ageDays = planted ? daysBetween(planted) : 0;
    const lifecycle = ageDays > 60 ? "expired" : ageDays >= 45 ? "wilting" : "fresh";

    const lines = body
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("**Planted:**"));
    const bullets = lines.filter((l) => l.startsWith("- ")).map((l) => l.slice(2).trim());
    const description = lines.filter((l) => !l.startsWith("- ")).join(" ").trim();

    ideas.push({ title, planted, ageDays, lifecycle, description, bullets });
  }

  const parseTableRows = (sectionName) => {
    const sec = content.match(new RegExp(`## ${sectionName}\\s*\\n([\\s\\S]*?)(?=\\n---|\\n## |$)`));
    if (!sec) return [];
    return sec[1]
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("|") && !l.includes("---") && !l.toLowerCase().includes("| idea |"))
      .map((l) => l.split("|").slice(1, -1).map((c) => c.trim()))
      .filter((cols) => cols.length >= 2 && cols[0]);
  };

  const graduated = parseTableRows("Graduated to Plans").map(([idea, plan, date]) => ({ idea, plan, date }));
  const implemented = parseTableRows("Implemented").map(([idea, plan, completed]) => ({ idea, plan, completed }));

  return { exists: true, ideas, graduated, implemented };
}

export function parseCompost(cwd) {
  const dir = resolveProjectPath(cwd);
  const filePath = path.join(dir, "_AUDIT", "COMPOST.md");
  if (!fs.existsSync(filePath)) {
    return { exists: false, items: [] };
  }

  const content = fs.readFileSync(filePath, "utf8");
  const secMatch = content.match(/## Composted Ideas\s*\n([\s\S]*)$/);
  // Strip HTML comments before parsing so commented-out template examples are ignored
  const block = (secMatch ? secMatch[1] : "").replace(/<!--[\s\S]*?-->/g, "");

  const items = [];
  const matches = [...block.matchAll(/^###\s+(.+)$/gm)];
  for (let i = 0; i < matches.length; i++) {
    const title = matches[i][1].trim();
    const start = matches[i].index + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : block.length;
    const body = block.slice(start, end).replace(/<!--[\s\S]*?-->/g, "").trim();

    const dateMatch = body.match(/\*\*Composted:\*\*\s*(\d{4}-\d{2}-\d{2})/);
    const reasonMatch = body.match(/\*\*Reason:\*\*\s*(.+)/);
    const description = body
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("**Composted:**") && !l.startsWith("**Reason:**"))
      .join(" ")
      .trim();

    items.push({
      title,
      composted: dateMatch ? dateMatch[1] : null,
      reason: reasonMatch ? reasonMatch[1].trim() : "",
      description,
      auto: /auto-composted/i.test(reasonMatch ? reasonMatch[1] : ""),
    });
  }

  return { exists: true, items };
}

function writeGarden(cwd, { ideas, graduated, implemented }) {
  const dir = resolveProjectPath(cwd);
  const today = todayISO();
  const activeCount = ideas.filter((i) => i.lifecycle !== "wilting").length;
  const wiltingCount = ideas.filter((i) => i.lifecycle === "wilting").length;

  const ideasMd =
    ideas.length === 0
      ? "_No ideas planted yet. Use `farmwork_garden_plant` or add an idea below._"
      : ideas
          .map((idea) => {
            const heading = idea.lifecycle === "wilting" ? `### ${idea.title} ⚠️ WILTING` : `### ${idea.title}`;
            const parts = [heading, `**Planted:** ${idea.planted || today}`];
            if (idea.description) parts.push(idea.description);
            if (idea.bullets?.length) {
              for (const b of idea.bullets) parts.push(`- ${b}`);
            }
            return parts.join("\n");
          })
          .join("\n\n");

  const gradRows = graduated.map((g) => `| ${g.idea} | ${g.plan} | ${g.date || today} |`).join("\n");
  const implRows = implemented.map((g) => `| ${g.idea} | ${g.plan} | ${g.completed || today} |`).join("\n");

  const content = `# Idea Garden

> Nursery for pre-plan ideas. Ideas age naturally: **Fresh** (0–44d), **Wilting** (45–60d), and **Auto-Composted** (>60d during \`farmwork_audit\`).

**Last Updated:** ${today}
**Active Ideas:** ${activeCount}
**Wilting Ideas:** ${wiltingCount}

---

## Ideas

${ideasMd}

---

## Graduated to Plans

| Idea | Plan | Date |
|------|------|------|
${gradRows ? `${gradRows}\n` : ""}
---

## Implemented

| Idea | Plan | Completed |
|------|------|-----------|
${implRows ? `${implRows}\n` : ""}`;

  fs.ensureDirSync(path.join(dir, "_AUDIT"));
  fs.writeFileSync(path.join(dir, "_AUDIT", "GARDEN.md"), content);
}

function writeCompost(cwd, items) {
  const dir = resolveProjectPath(cwd);
  const today = todayISO();
  const autoCount = items.filter((i) => i.auto).length;

  const body =
    items.length === 0
      ? "_No composted ideas yet._"
      : items
          .map((item) => {
            const parts = [
              `### ${item.title}`,
              `**Composted:** ${item.composted || today}`,
              `**Reason:** ${item.reason || "Retired"}`,
            ];
            if (item.description) parts.push(item.description);
            return parts.join("\n");
          })
          .join("\n\n");

  const content = `# Idea Compost

> Archive of retired ideas and why we passed on them — prevents re-proposing the same dead ends.

**Last Updated:** ${today}
**Composted Ideas:** ${items.length}
**Auto-Composted:** ${autoCount}

---

## Composted Ideas

${body}
`;

  fs.ensureDirSync(path.join(dir, "_AUDIT"));
  fs.writeFileSync(path.join(dir, "_AUDIT", "COMPOST.md"), content);
}

export function plantIdea(cwd, { title, description = "", bullets = [] }) {
  const dir = resolveProjectPath(cwd);
  assertWritableV3(dir);
  const garden = parseGarden(dir);
  const cleanTitle = String(title || "").trim();
  if (!cleanTitle) throw new Error("Idea title is required.");

  const exists = garden.ideas.find((i) => i.title.toLowerCase() === cleanTitle.toLowerCase());
  if (exists) {
    return { added: false, reason: "Idea already exists in GARDEN.md", idea: exists };
  }

  const newIdea = {
    title: cleanTitle,
    planted: todayISO(),
    ageDays: 0,
    lifecycle: "fresh",
    description: String(description || "").trim(),
    bullets: Array.isArray(bullets) ? bullets.map((b) => String(b).trim()).filter(Boolean) : [],
  };
  garden.ideas.push(newIdea);
  writeGarden(dir, garden);
  return { added: true, idea: newIdea };
}

export function compostIdea(cwd, { title, reason = "Retired", description = "" }) {
  const dir = resolveProjectPath(cwd);
  assertWritableV3(dir);
  const garden = parseGarden(dir);
  const compost = parseCompost(dir);
  const needle = String(title || "").trim().toLowerCase();
  if (!needle) throw new Error("Idea title is required.");

  const idx = garden.ideas.findIndex((i) => i.title.toLowerCase() === needle || i.title.toLowerCase().includes(needle));
  let removed = null;
  if (idx !== -1) {
    removed = garden.ideas.splice(idx, 1)[0];
    writeGarden(dir, garden);
  }

  const entry = {
    title: removed ? removed.title : String(title).trim(),
    composted: todayISO(),
    reason: String(reason || "Retired").trim(),
    description: removed?.description || String(description || "").trim(),
    auto: /auto-composted/i.test(String(reason || "")),
  };
  compost.items.unshift(entry);
  writeCompost(dir, compost.items);
  return { composted: true, fromGarden: Boolean(removed), entry };
}

export function tendGarden(cwd) {
  const dir = resolveProjectPath(cwd);
  assertWritableV3(dir);
  const garden = parseGarden(dir);
  if (!garden.exists) {
    return { active: 0, wilting: [], autoComposted: [] };
  }
  const compost = parseCompost(dir);
  const kept = [];
  const wilting = [];
  const autoComposted = [];

  for (const idea of garden.ideas) {
    if (idea.ageDays > 60) {
      const entry = {
        title: idea.title,
        composted: todayISO(),
        reason: "Auto-composted: aged 60+ days without action",
        description: idea.description,
        auto: true,
      };
      compost.items.unshift(entry);
      autoComposted.push(idea.title);
    } else {
      if (idea.ageDays >= 45) {
        idea.lifecycle = "wilting";
        wilting.push(idea.title);
      } else {
        idea.lifecycle = "fresh";
      }
      kept.push(idea);
    }
  }

  writeGarden(dir, { ideas: kept, graduated: garden.graduated, implemented: garden.implemented });
  if (autoComposted.length > 0) {
    writeCompost(dir, compost.items);
  }
  return { active: kept.length, wilting, autoComposted };
}

/* ============================================================================
   Local Repo Checklists (_AUDIT/CHECKLIST.md)
   ============================================================================ */

export function parseChecklist(cwd) {
  const dir = resolveProjectPath(cwd);
  const filePath = path.join(dir, "_AUDIT", "CHECKLIST.md");
  if (!fs.existsSync(filePath)) {
    return { exists: false, items: [], summary: { total: 0, completed: 0, skipped: 0, pending: 0, percent: 0 } };
  }

  const lines = fs.readFileSync(filePath, "utf8").split("\n");
  let currentGroup = "General";
  const items = [];
  let idCounter = 1;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    const groupMatch = line.match(/^##\s+(.+)$/);
    if (groupMatch) {
      currentGroup = groupMatch[1].trim();
      continue;
    }
    const itemMatch = line.match(/^\s*-\s+\[([ xX-])\]\s+(.+)$/);
    if (itemMatch) {
      const mark = itemMatch[1];
      const state = mark === "x" || mark === "X" ? "complete" : mark === "-" ? "skip" : "pending";
      items.push({
        id: idCounter++,
        group: currentGroup,
        title: itemMatch[2].trim(),
        state,
        lineIndex: lineIdx,
      });
    }
  }

  const completed = items.filter((i) => i.state === "complete").length;
  const skipped = items.filter((i) => i.state === "skip").length;
  const activeTotal = items.length - skipped;
  const pending = activeTotal - completed;
  const percent = activeTotal > 0 ? Math.round((completed / activeTotal) * 100) : 100;

  return {
    exists: true,
    items,
    summary: { total: items.length, activeTotal, completed, skipped, pending, percent },
  };
}

export function setChecklistItem(cwd, { target, state }) {
  const dir = resolveProjectPath(cwd);
  assertWritableV3(dir);
  const filePath = path.join(dir, "_AUDIT", "CHECKLIST.md");
  if (!fs.existsSync(filePath)) {
    throw new Error("_AUDIT/CHECKLIST.md does not exist. Run farmwork_init first.");
  }

  const validStates = { complete: "x", pending: " ", skip: "-" };
  if (!(state in validStates)) {
    throw new Error(`Invalid state "${state}". Use: complete, pending, or skip.`);
  }

  const parsed = parseChecklist(dir);
  let matched = null;

  if (typeof target === "number" || /^\d+$/.test(String(target))) {
    const numId = Number(target);
    matched = parsed.items.find((i) => i.id === numId);
  } else {
    const needle = String(target || "").trim().toLowerCase();
    matched =
      parsed.items.find((i) => i.title.toLowerCase() === needle) ||
      parsed.items.find((i) => i.title.toLowerCase().includes(needle));
  }

  if (!matched) {
    throw new Error(`Checklist item not found: "${target}"`);
  }

  const lines = fs.readFileSync(filePath, "utf8").split("\n");
  lines[matched.lineIndex] = lines[matched.lineIndex].replace(/^(\s*-\s+\[)[ xX-](\]\s+)/, `$1${validStates[state]}$2`);
  fs.writeFileSync(filePath, lines.join("\n"));

  const updated = parseChecklist(dir);
  return {
    item: updated.items.find((i) => i.id === matched.id),
    summary: updated.summary,
  };
}

export function addChecklistItem(cwd, { group = "Project Standards", title }) {
  const dir = resolveProjectPath(cwd);
  assertWritableV3(dir);
  const filePath = path.join(dir, "_AUDIT", "CHECKLIST.md");
  const cleanTitle = String(title || "").trim();
  if (!cleanTitle) throw new Error("Checklist item title is required.");

  fs.ensureDirSync(path.join(dir, "_AUDIT"));
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, `# Project Checklist\n\n## ${group}\n- [ ] ${cleanTitle}\n`);
    return parseChecklist(dir);
  }

  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split("\n");
  const headerIdx = lines.findIndex((l) => l.trim().toLowerCase() === `## ${group.toLowerCase()}`);

  if (headerIdx !== -1) {
    let insertIdx = headerIdx + 1;
    while (insertIdx < lines.length && !lines[insertIdx].startsWith("## ")) {
      insertIdx++;
    }
    while (insertIdx > headerIdx + 1 && lines[insertIdx - 1].trim() === "") {
      insertIdx--;
    }
    lines.splice(insertIdx, 0, `- [ ] ${cleanTitle}`);
    fs.writeFileSync(filePath, lines.join("\n"));
  } else {
    const suffix = content.endsWith("\n") ? "" : "\n";
    fs.writeFileSync(filePath, `${content}${suffix}\n## ${group}\n- [ ] ${cleanTitle}\n`);
  }

  return parseChecklist(dir);
}

/* ============================================================================
   Plans (_PLANS/*.md)
   ============================================================================ */

export function listPlans(cwd) {
  const dir = resolveProjectPath(cwd);
  const plansDir = path.join(dir, "_PLANS");
  if (!fs.existsSync(plansDir)) return [];

  return fs
    .readdirSync(plansDir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((file) => {
      const fullPath = path.join(plansDir, file);
      const content = fs.readFileSync(fullPath, "utf8");
      const titleMatch = content.match(/^#\s+(.+)$/m);
      const statusMatch = content.match(/\*\*Status:\*\*\s*(.+)/i);
      const createdMatch = content.match(/\*\*Created:\*\*\s*(\d{4}-\d{2}-\d{2})/i);
      const status = statusMatch ? statusMatch[1].trim() : "Draft";
      return {
        file,
        slug: file.replace(/\.md$/i, ""),
        path: `_PLANS/${file}`,
        title: titleMatch ? titleMatch[1].trim() : file.replace(/\.md$/i, ""),
        status,
        completed: /^complete(d)?$/i.test(status),
        created: createdMatch ? createdMatch[1] : null,
      };
    });
}

export function createPlan(cwd, { title, summary = "", approach = "", files = [], steps = [], risks = [], fromIdea = null }) {
  const dir = resolveProjectPath(cwd);
  assertWritableV3(dir);
  const cleanTitle = String(title || "").trim();
  if (!cleanTitle) throw new Error("Plan title is required.");

  const slug = slugifyPlan(cleanTitle);
  const filename = `${slug}.md`;
  const plansDir = path.join(dir, "_PLANS");
  fs.ensureDirSync(plansDir);
  const planPath = path.join(plansDir, filename);
  const today = todayISO();

  const filesMd = files.length ? files.map((f) => `- \`${f}\``).join("\n") : "- _TBD_";
  const stepsMd = steps.length ? steps.map((s, idx) => `${idx + 1}. ${s}`).join("\n") : "1. _Define concrete steps_";
  const risksMd = risks.length ? risks.map((r) => `- ${r}`).join("\n") : "- _None identified yet_";

  const content = `# ${cleanTitle}

**Status:** Draft
**Created:** ${today}
${fromIdea ? `**Graduated From:** ${fromIdea}\n` : ""}
---

## Overview

${summary || "_Describe the problem and goal._"}

## Technical Approach

${approach || "_Outline architecture, key tradeoffs, and data flow._"}

## Files to Modify

${filesMd}

## Implementation Steps

${stepsMd}

## Risks & Verification

${risksMd}
`;

  fs.writeFileSync(planPath, content);

  // If linked to an Idea Garden entry, move it to Graduated to Plans
  let graduated = false;
  if (fromIdea) {
    const garden = parseGarden(dir);
    const needle = fromIdea.toLowerCase();
    const idx = garden.ideas.findIndex((i) => i.title.toLowerCase() === needle || i.title.toLowerCase().includes(needle));
    if (idx !== -1) {
      const [idea] = garden.ideas.splice(idx, 1);
      garden.graduated.push({ idea: idea.title, plan: `_PLANS/${filename}`, date: today });
      writeGarden(dir, garden);
      graduated = true;
    }
  }

  return { file: filename, path: `_PLANS/${filename}`, slug, graduated };
}

export function completePlan(cwd, slugOrTitle) {
  const dir = resolveProjectPath(cwd);
  assertWritableV3(dir);
  const plans = listPlans(dir);
  const needle = String(slugOrTitle || "").trim().toLowerCase();
  const match = plans.find(
    (p) =>
      p.slug.toLowerCase() === needle ||
      p.file.toLowerCase() === needle ||
      p.title.toLowerCase() === needle ||
      p.title.toLowerCase().includes(needle),
  );
  if (!match) throw new Error(`Plan not found: "${slugOrTitle}"`);

  const fullPath = path.join(dir, match.path);
  let content = fs.readFileSync(fullPath, "utf8");
  const today = todayISO();

  if (/\*\*Status:\*\*/i.test(content)) {
    content = content.replace(/\*\*Status:\*\*\s*.+/i, `**Status:** Complete`);
  } else {
    content = content.replace(/^(#\s+.+\n)/, `$1\n**Status:** Complete\n`);
  }
  if (!/\*\*Completed:\*\*/i.test(content)) {
    content = content.replace(/\*\*Status:\*\*\s*Complete/, `**Status:** Complete\n**Completed:** ${today}`);
  }
  fs.writeFileSync(fullPath, content);

  const garden = parseGarden(dir);
  if (garden.exists) {
    const alreadyLogged = garden.implemented.some((i) => i.plan === match.path);
    if (!alreadyLogged) {
      garden.implemented.push({ idea: match.title, plan: match.path, completed: today });
      writeGarden(dir, garden);
    }
  }

  return { completed: true, plan: match.path, title: match.title };
}

/* ============================================================================
   Deterministic Health Score, Audit & Quality Gates
   ============================================================================ */

export function computeHealth(cwd, { assumeFarmhouse = false } = {}) {
  const dir = resolveProjectPath(cwd);
  const install = detectFarmworkInstall(dir);
  const project = detectProject(dir);
  const git = getGitState(dir);
  const testFiles = countTestFiles(dir);
  const garden = parseGarden(dir);
  const compost = parseCompost(dir);
  const checklist = parseChecklist(dir);
  const plans = listPlans(dir);

  const hasAgentsMd = fs.existsSync(path.join(dir, "AGENTS.md"));
  const hasClaudeMd = fs.existsSync(path.join(dir, "CLAUDE.md"));
  const hasMcpConfig = fs.existsSync(path.join(dir, ".mcp.json"));
  const hasFarmhouse = assumeFarmhouse || fs.existsSync(path.join(dir, "_AUDIT", "FARMHOUSE.md"));
  const hasPlansDir = fs.existsSync(path.join(dir, "_PLANS"));

  const breakdown = [];
  let earned = 0;

  // 1. Setup & Living Docs (2.0 pts — COMPOST.md is created lazily so never penalized)
  let setupPts = 0;
  if (project.hasV3Manifest) setupPts += 0.5;
  if (hasAgentsMd || hasClaudeMd) setupPts += 0.5;
  if (hasMcpConfig) setupPts += 0.3;
  if (hasFarmhouse) setupPts += 0.3;
  if (checklist.exists) setupPts += 0.2;
  if (garden.exists) setupPts += 0.2;
  earned += setupPts;
  breakdown.push({
    label: "Setup & Living Docs (.farmwork.json, AGENTS.md, .mcp.json, _AUDIT/)",
    points: Number(setupPts.toFixed(1)),
    max: 2.0,
    passed: setupPts >= 1.7,
  });

  // 2. Checklist Standards (3.0 pts)
  const checklistPts = checklist.exists ? Number(((checklist.summary.percent / 100) * 3.0).toFixed(1)) : 0;
  earned += checklistPts;
  breakdown.push({
    label: `Checklist Standards (${checklist.summary.percent}% of ${checklist.summary.activeTotal || 0} active)`,
    points: checklistPts,
    max: 3.0,
    passed: checklist.exists && checklist.summary.percent >= 70,
  });

  // 3. Automated Test Presence (1.5 pts)
  const testPts = testFiles >= 5 ? 1.5 : testFiles >= 1 ? 1.0 : 0;
  earned += testPts;
  breakdown.push({
    label: `Automated Tests (${plural(testFiles, "test file")} found)`,
    points: testPts,
    max: 1.5,
    passed: testFiles >= 1,
  });

  // 4. Verified Quality Gates (2.5 pts — earned by actually running `farmwork gates`)
  const lastGates = project.lastGates;
  let gatePts = 0;
  let gateLabel = "Quality Gates (not yet verified — run `farmwork gates`)";
  let gatePassed = false;
  if (lastGates && lastGates.ranCount > 0) {
    if (lastGates.allPassed) {
      gatePts = 2.5;
      gatePassed = true;
      gateLabel = `Quality Gates (${lastGates.passedCount}/${lastGates.ranCount} passed on ${lastGates.date})`;
    } else {
      gatePts = 0.5;
      gateLabel = `Quality Gates (${lastGates.passedCount}/${lastGates.ranCount} passed on ${lastGates.date} — failures present)`;
    }
  } else if (lastGates && lastGates.ranCount === 0) {
    gatePts = 0.5;
    gateLabel = "Quality Gates (no lint/test/build commands configured)";
  }
  earned += gatePts;
  breakdown.push({
    label: gateLabel,
    points: gatePts,
    max: 2.5,
    passed: gatePassed,
  });

  // 5. Planning & Garden Hygiene (1.0 pt)
  const expiredIdeas = garden.ideas.filter((i) => i.lifecycle === "expired").length;
  let hygienePts = 0;
  if (hasPlansDir) hygienePts += 0.5;
  if (expiredIdeas === 0) hygienePts += 0.5;
  earned += hygienePts;
  breakdown.push({
    label: `Planning & Garden Hygiene (${plural(plans.length, "plan")}, ${plural(expiredIdeas, "overdue idea")})`,
    points: hygienePts,
    max: 1.0,
    passed: hygienePts === 1.0,
  });

  const score = Math.min(10, Number(earned.toFixed(1)));
  const status =
    score >= 8.5 ? "Thriving" : score >= 6.5 ? "Healthy" : score >= 4.5 ? "Needs tending" : "Initial setup";

  return {
    projectName: project.projectName,
    path: dir,
    stack: project.stack,
    packageManager: project.packageManager,
    commands: project.commands,
    lastGates,
    farmworkVersion: project.farmworkVersion,
    install,
    initialized: isFarmworkProject(dir),
    score,
    status,
    breakdown,
    metrics: {
      testFiles,
      totalPlans: plans.length,
      completedPlans: plans.filter((p) => p.completed).length,
      activeIdeas: garden.ideas.length,
      wiltingIdeas: garden.ideas.filter((i) => i.lifecycle === "wilting").length,
      compostedIdeas: compost.items.length,
      checklistPercent: checklist.summary.percent,
      checklistCompleted: checklist.summary.completed,
      checklistActive: checklist.summary.activeTotal || 0,
    },
    files: {
      manifest: project.hasManifest,
      v3Manifest: project.hasV3Manifest,
      agentsMd: hasAgentsMd,
      claudeMd: hasClaudeMd,
      mcpConfig: hasMcpConfig,
      farmhouse: hasFarmhouse,
      garden: garden.exists,
      compost: compost.exists,
      checklist: checklist.exists,
      plansDir: hasPlansDir,
    },
    git,
  };
}

export function runAudit(cwd) {
  const dir = resolveProjectPath(cwd);
  assertWritableV3(dir);
  const gardenResult = tendGarden(dir);
  const health = computeHealth(dir, { assumeFarmhouse: true });
  const today = todayISO();
  const farmhousePath = path.join(dir, "_AUDIT", "FARMHOUSE.md");

  let existingHistoryRows = [];
  if (fs.existsSync(farmhousePath)) {
    const prev = fs.readFileSync(farmhousePath, "utf8");
    const histMatch = prev.match(/## Audit History\s*\n([\s\S]*)$/);
    if (histMatch) {
      existingHistoryRows = histMatch[1]
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.startsWith("|") && !l.includes("---") && !l.toLowerCase().includes("| date |"));
    }
  }

  const summaryBits = [
    `Score ${health.score}/10`,
    plural(health.metrics.testFiles, "test"),
    `${health.metrics.checklistPercent}% checklist`,
    `${health.metrics.completedPlans}/${health.metrics.totalPlans} plans`,
  ];
  if (gardenResult.autoComposted.length > 0) {
    summaryBits.push(`auto-composted ${gardenResult.autoComposted.length}`);
  }
  const newRow = `| ${today} | ${summaryBits.join(" · ")} |`;

  // Keep latest 15 audit entries without duplicating identical consecutive entries
  const historyRows = existingHistoryRows[0] === newRow ? existingHistoryRows : [newRow, ...existingHistoryRows];
  const trimmedHistory = historyRows.slice(0, 15).join("\n");

  const breakdownRows = health.breakdown
    .map((b) => `| ${b.passed ? "✅" : "⚠️"} ${b.label} | ${b.points} / ${b.max} |`)
    .join("\n");

  const content = `# Farmwork Farmhouse — ${health.projectName}

> Deterministic health report for **${health.projectName}** (\`${health.stack}\`). Updated by \`farmwork audit\` or the \`farmwork_audit\` MCP tool.

**Last Updated:** ${today}
**Score:** ${health.score}/10
**Status:** ${health.status}

---

## Quick Metrics

| Metric | Value |
|--------|-------|
| Stack | \`${health.stack}\` |
| Test Files | ${health.metrics.testFiles} |
| Checklist Progress | ${health.metrics.checklistPercent}% (${health.metrics.checklistCompleted}/${health.metrics.checklistActive}) |
| Plans | ${health.metrics.completedPlans} / ${health.metrics.totalPlans} complete |
| Active Ideas | ${health.metrics.activeIdeas} (${health.metrics.wiltingIdeas} wilting) |
| Composted Ideas | ${health.metrics.compostedIdeas} |
| Git Branch | \`${health.git.branch || "n/a"}\` (${health.git.dirtyCount} uncommitted) |

---

## Health Score Breakdown

| Check | Points |
|-------|--------|
${breakdownRows}

---

## Quality Gate Commands

- **Lint:** ${health.commands.lint ? `\`${health.commands.lint}\`` : "_not configured_"}
- **Test:** ${health.commands.test ? `\`${health.commands.test}\`` : "_not configured_"}
- **Build:** ${health.commands.build ? `\`${health.commands.build}\`` : "_not configured_"}

---

## Audit History

| Date | Summary |
|------|---------|
${trimmedHistory}
`;

  fs.ensureDirSync(path.join(dir, "_AUDIT"));
  fs.writeFileSync(farmhousePath, content);

  return { health, gardenResult, farmhousePath };
}

export function runGates(cwd, { only = null, timeoutMs = 120000 } = {}) {
  const dir = resolveProjectPath(cwd);
  const project = detectProject(dir);
  const gateNames = Array.isArray(only) && only.length > 0 ? only : ["lint", "test", "build"];

  const results = [];
  for (const name of gateNames) {
    const cmd = project.commands[name];
    if (!cmd) {
      results.push({ gate: name, status: "skipped", command: null, durationMs: 0, output: "No command configured" });
      continue;
    }

    const start = Date.now();
    const res = spawnSync(cmd, {
      cwd: dir,
      shell: true,
      encoding: "utf8",
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024 * 4,
    });
    const durationMs = Date.now() - start;
    const combined = `${res.stdout || ""}\n${res.stderr || ""}`.trim();
    const tail = combined.split("\n").slice(-35).join("\n");

    results.push({
      gate: name,
      status: res.status === 0 ? "passed" : "failed",
      exitCode: res.status,
      command: cmd,
      durationMs,
      output: tail,
    });
  }

  const allPassed = results.every((r) => r.status !== "failed");
  const ranResults = results.filter((r) => r.status !== "skipped");
  const passedCount = ranResults.filter((r) => r.status === "passed").length;
  const gateSummary = {
    date: todayISO(),
    allPassed,
    ranCount: ranResults.length,
    passedCount,
    gates: Object.fromEntries(results.map((r) => [r.gate, r.status])),
  };

  // Record gate verification on v3 repos only (never modify legacy v1/v2 manifests)
  const install = detectFarmworkInstall(dir);
  if (install.generation === "v3") {
    const manifestPath = path.join(dir, ".farmwork.json");
    const manifest = readManifest(dir);
    if (manifest) {
      manifest.lastGates = gateSummary;
      fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    }
  }

  return { projectName: project.projectName, stack: project.stack, allPassed, summary: gateSummary, results };
}

/* ============================================================================
   Initialization (v3 Agent-First)
   ============================================================================ */

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

> Living engineering standards for **${name}** (\`${stack}\`). Use \`[x]\` done, \`[ ]\` pending, or \`[-]\` skipped (excluded from completion %).

## Foundation
- [x] Farmwork v3 initialized (\`.farmwork.json\` & \`AGENTS.md\`)
- [ ] README documents local setup and architecture
- [ ] Environment variables documented in \`.env.example\`

## Quality & Testing
- [ ] Automated test suite runs cleanly via \`farmwork_gates\`
- [ ] Linter / static analysis passes with zero errors
- [ ] Production build succeeds cleanly
${stackSection}
## Security & Shipping
- [ ] Secrets excluded via \`.gitignore\` and never committed
- [ ] Error handling & logging verified for production paths
- [ ] Deployment / release workflow verified
`;
}

export function initProject(
  cwd,
  { force = false, reinstall = false, projectName = null, includeMcpConfig = true, useNpx = false } = {},
) {
  const dir = resolveProjectPath(cwd);
  const install = detectFarmworkInstall(dir);

  // Never auto-update or partially overwrite a past Farmwork v1/v2 installation
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

  // 1. .farmwork.json manifest (overwritten on --reinstall or --force)
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

  // 2. AGENTS.md (universal source of truth for Claude, Gemini, Codex, Cursor, Antigravity)
  const agentsMd = `# ${name} — Farmwork Agent Instructions

This repository uses **Farmwork v3** — an agent-first standards and workflow system powered by MCP.

## How to Work on This Project

Connect to the \`farmwork\` MCP server (configured in \`.mcp.json\`) and use its 6 tools directly:

| Goal | MCP Tool |
|------|----------|
| Check project health & git status | \`farmwork_status\` |
| Refresh \`_AUDIT/FARMHOUSE.md\` & age Idea Garden | \`farmwork_audit\` |
| Run lint, test, and build quality gates | \`farmwork_gates\` |
| List or update \`_AUDIT/CHECKLIST.md\` | \`farmwork_checklist\` (\`list\` / \`complete\` / \`pending\` / \`skip\` / \`add\`) |
| List, plant, or compost ideas in \`_AUDIT/GARDEN.md\` | \`farmwork_garden\` (\`list\` / \`plant\` / \`compost\`) |
| List, create, or complete plans in \`_PLANS/\` | \`farmwork_plan\` (\`list\` / \`create\` / \`complete\`) |

## Standards

1. **Plan First:** For any non-trivial feature or refactor, call \`farmwork_plan\` (\`action: "create"\`) to save a plan in \`_PLANS/\` and confirm with the user before implementing.
2. **Quality Gates:** Run \`farmwork_gates\` before shipping. Never claim tests or builds pass without running them.
3. **Preserve "Why" Comments:** Clean up debug logs and dead code, but keep comments that explain non-obvious architectural decisions.
4. **Capture, Don't Creep:** Plant out-of-scope improvements into \`_AUDIT/GARDEN.md\` with \`farmwork_garden\` (\`action: "plant"\`) rather than expanding the current diff.
5. **Local Viewer:** Run \`farmwork view\` to inspect all Markdown docs, checklists, and health scores locally in a browser.

## Project Commands

- **Stack:** \`${detected.stack}\`
- **Lint:** ${detected.commands.lint ? `\`${detected.commands.lint}\`` : "_not configured_"}
- **Test:** ${detected.commands.test ? `\`${detected.commands.test}\`` : "_not configured_"}
- **Build:** ${detected.commands.build ? `\`${detected.commands.build}\`` : "_not configured_"}

## Structure

- \`.farmwork.json\` — Project manifest, detected commands & last gate verification
- \`_AUDIT/FARMHOUSE.md\` — Deterministic project health & audit history
- \`_AUDIT/CHECKLIST.md\` — Living engineering standards checklist
- \`_AUDIT/GARDEN.md\` — Pre-plan idea nursery (\`_AUDIT/COMPOST.md\` is created automatically when ideas retire)
- \`_PLANS/\` — Feature implementation plans
`;
  writeManaged("AGENTS.md", agentsMd, { overwriteOnReinstall: true });

  // 3. CLAUDE.md (lean pointer so Claude Code never drifts from AGENTS.md)
  const claudeMd = `# ${name}

Read and follow [AGENTS.md](./AGENTS.md).

This project uses the **Farmwork v3** MCP server (\`.mcp.json\`) for deterministic audits, checklists, plans, Idea Garden tracking, and quality gates.
`;
  writeManaged("CLAUDE.md", claudeMd, { overwriteOnReinstall: true });

  // 4. .mcp.json (merge non-destructively if it already exists!)
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
    if (!mcpObj.mcpServers || typeof mcpObj.mcpServers !== "object") {
      mcpObj.mcpServers = {};
    }
    if (!mcpObj.mcpServers.farmwork || force || reinstall) {
      mcpObj.mcpServers.farmwork = mcpServerEntry;
      fs.writeFileSync(mcpPath, `${JSON.stringify(mcpObj, null, 2)}\n`);
      created.push(existed ? ".mcp.json (merged)" : ".mcp.json");
    } else {
      skipped.push(".mcp.json");
    }
  }

  // 5. _AUDIT/GARDEN.md (COMPOST.md is created lazily when the first idea is composted)
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

  // 6. _AUDIT/CHECKLIST.md (stack-aware starter standards)
  writeManaged("_AUDIT/CHECKLIST.md", buildStarterChecklist(name, detected.stack));

  // 8. Run initial deterministic audit to populate _AUDIT/FARMHOUSE.md
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
    health: audit.health,
  };
}

/* ============================================================================
   Local Docs & Multi-Farm Folder Scanner (for Local Farm Viewer)
   ============================================================================ */

export function readFarmDocs(cwd) {
  const dir = resolveProjectPath(cwd);
  const docs = [];

  const addFile = (relPath, category) => {
    const full = path.join(dir, relPath);
    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) return;
    const content = fs.readFileSync(full, "utf8");
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const stat = fs.statSync(full);
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

  // Check root itself first
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
      // Don't descend inside a standalone git repo (e.g. monorepo subpackages), only workspace grouping folders
      if (depth < 2 && !fs.existsSync(path.join(child, ".git"))) {
        scanChildren(child, depth + 1);
      }
    }
  };

  // If root isn't itself a single git repo with Farmwork, scan child workspace folders up to 2 levels deep
  if (!rootIsFarm || !fs.existsSync(path.join(root, ".git"))) {
    scanChildren(root, 1);
  }

  found.sort((a, b) => a.projectName.localeCompare(b.projectName));
  return { root, farms: found };
}
