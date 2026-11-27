import fs from "fs-extra";
import path from "path";
import { spawnSync } from "child_process";
import { assertWritableV3, isBeadsAvailable, isJustAvailable, resolveProjectPath } from "./shared.js";
import { detectProject } from "./detect.js";
import { completeChecklistForBeads } from "./checklist.js";

/* ============================================================================
   Justfile Command Runner Integration (https://just.systems)
   ============================================================================ */

const JUSTFILE_NAMES = ["justfile", "Justfile", ".justfile", ".Justfile"];
const JUST_KEYWORDS = new Set(["set", "alias", "export", "import", "mod", "unexport"]);

export function findJustfile(cwd) {
  const dir = resolveProjectPath(cwd);
  for (const name of JUSTFILE_NAMES) {
    const full = path.join(dir, name);
    if (fs.existsSync(full) && fs.statSync(full).isFile()) {
      return { file: name, fullPath: full };
    }
  }
  return null;
}

export function parseJustfileContent(content) {
  const lines = String(content || "").split(/\r?\n/);
  const recipes = [];
  let pendingComment = null;
  let pendingAttrs = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();

    if (!trimmed) {
      pendingComment = null;
      pendingAttrs = [];
      continue;
    }

    if (/^[ \t]/.test(raw)) continue;

    if (trimmed.startsWith("#")) {
      const text = trimmed.replace(/^#+\s*/, "").trim();
      if (text && !/^[-=─═]{3,}/.test(text)) pendingComment = text;
      continue;
    }

    if (/^\[[^\]]+\]$/.test(trimmed)) {
      pendingAttrs.push(trimmed.slice(1, -1).trim());
      continue;
    }

    if (/^[A-Za-z_][A-Za-z0-9_-]*\s*:=/.test(trimmed)) {
      pendingComment = null;
      pendingAttrs = [];
      continue;
    }

    const firstWord = trimmed.split(/\s+/)[0];
    if (JUST_KEYWORDS.has(firstWord)) {
      pendingComment = null;
      pendingAttrs = [];
      continue;
    }

    const recipeMatch = trimmed.match(/^(@?)([A-Za-z_][A-Za-z0-9_-]*)([^:=]*):(?!=)\s*(.*)$/);
    if (recipeMatch) {
      const name = recipeMatch[2];
      const rawParams = recipeMatch[3].trim();
      const rawDeps = recipeMatch[4].trim();
      const isPrivate = name.startsWith("_") || pendingAttrs.some((a) => /^private\b/i.test(a));
      const isDefault = pendingAttrs.some((a) => /^default\b/i.test(a));
      let docAttr = null;
      for (const a of pendingAttrs) {
        const m = a.match(/^doc\(["'](.+)["']\)$/i);
        if (m) docAttr = m[1];
      }
      recipes.push({
        name,
        params: rawParams ? rawParams.split(/\s+/).filter(Boolean) : [],
        deps: rawDeps ? rawDeps.split(/\s+/).filter(Boolean) : [],
        description: docAttr || pendingComment || "",
        isDefault: isDefault || (recipes.length === 0 && !isPrivate),
        isPrivate,
        line: i + 1,
      });
    }

    pendingComment = null;
    pendingAttrs = [];
  }

  return recipes;
}

export function detectJustfile(cwd) {
  const dir = resolveProjectPath(cwd);
  const found = findJustfile(dir);
  const installed = isJustAvailable();
  if (!found) {
    return { installed, exists: false, file: null, path: null, recipes: [], allRecipesCount: 0 };
  }
  const content = fs.readFileSync(found.fullPath, "utf8");
  const all = parseJustfileContent(content);
  const publicRecipes = all.filter((r) => !r.isPrivate);
  return {
    installed,
    exists: true,
    file: found.file,
    path: found.fullPath,
    recipes: publicRecipes,
    allRecipesCount: all.length,
  };
}

function detectDevCommand(dir, project) {
  if (project.stack === "rails") {
    return fs.existsSync(path.join(dir, "bin", "dev")) ? "bin/dev" : "bin/rails server";
  }
  if (fs.existsSync(path.join(dir, "package.json"))) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
      const pm = project.packageManager || "npm";
      if (pkg.scripts?.dev) return `${pm} run dev`;
      if (pkg.scripts?.start) return `${pm} run start`;
    } catch {
      // ignore
    }
  }
  if (project.stack === "rust") return "cargo run";
  if (project.stack === "go") return "go run .";
  return null;
}

export function buildStarterJustfile(cwd, project = null) {
  const dir = resolveProjectPath(cwd);
  const proj = project || detectProject(dir);
  const devCmd = detectDevCommand(dir, proj);
  const lines = [
    `# ${proj.projectName} — Maintained Justfile (https://just.systems)`,
    `# Keep these recipes accurate whenever scripts or workflows evolve.`,
    ``,
    `set shell := ["bash", "-cu"]`,
    `set dotenv-load`,
    ``,
    `# Show all available recipes`,
    `[default]`,
    `help:`,
    `    @just --list --unsorted`,
    ``,
  ];

  if (devCmd) lines.push(`# Start local development server`, `dev:`, `    ${devCmd}`, ``);
  if (proj.commands.lint) lines.push(`# Run linter / static checks`, `lint:`, `    ${proj.commands.lint}`, ``);
  if (proj.commands.test) lines.push(`# Run automated test suite`, `test:`, `    ${proj.commands.test}`, ``);
  if (proj.commands.build) lines.push(`# Build the project`, `build:`, `    ${proj.commands.build}`, ``);

  lines.push(
    `# Run full quality & security verification gates`,
    `check:`,
    `    farmwork gates`,
    ``,
    `# Run deterministic secrets & dependency security scan`,
    `security:`,
    `    farmwork security`,
    ``,
    `# Refresh _AUDIT/FARMHOUSE.md and tend the Idea Garden`,
    `audit:`,
    `    farmwork audit`,
    ``,
    `# Show project health score & status`,
    `status:`,
    `    farmwork status`,
    ``,
    `# Open the Local Farm Viewer in your browser`,
    `view:`,
    `    farmwork view`,
    ``,
    `# Show unblocked Beads issues ready to work on`,
    `ready:`,
    `    bd ready`,
    ``,
    `# List open Beads issues`,
    `issues:`,
    `    bd list --status open`,
    ``,
    `# Sync Beads issue graph with git/remote`,
    `sync:`,
    `    bd sync`,
    ``,
  );

  return lines.join("\n");
}

export function initJustfile(cwd, { force = false } = {}) {
  const dir = resolveProjectPath(cwd);
  assertWritableV3(dir);
  const existing = findJustfile(dir);
  if (existing && !force) {
    const info = detectJustfile(dir);
    return { created: false, skipped: true, file: existing.file, recipes: info.recipes };
  }
  const content = buildStarterJustfile(dir);
  const targetPath = path.join(dir, existing?.file || "justfile");
  fs.writeFileSync(targetPath, content);
  const info = detectJustfile(dir);
  return { created: true, skipped: false, file: path.basename(targetPath), path: targetPath, recipes: info.recipes };
}

export function runJustRecipe(cwd, recipe, { args = [], timeoutMs = 120000 } = {}) {
  const dir = resolveProjectPath(cwd);
  const cleanRecipe = String(recipe || "").trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(cleanRecipe)) {
    throw new Error(`Invalid just recipe name: "${recipe}"`);
  }
  if (!isJustAvailable()) {
    throw new Error("`just` is not installed. Install from https://just.systems/man/en/");
  }
  const info = detectJustfile(dir);
  if (!info.exists) {
    throw new Error("No justfile found in this repository. Run `farmwork just --init` first.");
  }
  const matched = info.recipes.find((r) => r.name === cleanRecipe);
  if (!matched) {
    throw new Error(`Recipe "${cleanRecipe}" not found in ${info.file}.`);
  }
  const safeArgs = Array.isArray(args) ? args.map((a) => String(a)) : [];
  const start = Date.now();
  const res = spawnSync("just", [cleanRecipe, ...safeArgs], {
    cwd: dir,
    shell: false,
    encoding: "utf8",
    timeout: timeoutMs,
    maxBuffer: 1024 * 1024 * 4,
  });
  const durationMs = Date.now() - start;
  const combined = `${res.stdout || ""}\n${res.stderr || ""}`.trim();
  const tail = combined.split("\n").slice(-50).join("\n");
  return {
    recipe: cleanRecipe,
    command: `just ${[cleanRecipe, ...safeArgs].join(" ")}`,
    passed: res.status === 0,
    exitCode: res.status,
    durationMs,
    output: tail,
  };
}

/* ============================================================================
   Beads Issue & Dependency Graph Integration (https://beads.gascity.com)
   ============================================================================ */

function extractJsonOutput(text) {
  const str = String(text || "").trim();
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch {
    const idxObj = str.indexOf("{");
    const idxArr = str.indexOf("[");
    const candidates = [idxObj, idxArr].filter((n) => n >= 0);
    if (candidates.length === 0) return null;
    try {
      return JSON.parse(str.slice(Math.min(...candidates)));
    } catch {
      return null;
    }
  }
}

function readBeadsJsonlFallback(beadsDir) {
  const jsonlPath = path.join(beadsDir, "issues.jsonl");
  if (!fs.existsSync(jsonlPath)) return null;
  try {
    const lines = fs.readFileSync(jsonlPath, "utf8").split("\n").filter((l) => l.trim());
    const issues = [];
    for (const line of lines) {
      try {
        issues.push(JSON.parse(line));
      } catch {
        // ignore malformed line
      }
    }
    const open = issues.filter((i) => i.status === "open").length;
    const inProgress = issues.filter((i) => i.status === "in_progress").length;
    const blocked = issues.filter((i) => i.status === "blocked").length;
    const closed = issues.filter((i) => i.status === "closed").length;
    const readyList = issues.filter((i) => i.status === "open" || i.status === "in_progress");
    return {
      summary: { total: issues.length, open, inProgress, blocked, ready: readyList.length, closed },
      ready: readyList.slice(0, 25),
      issues: issues.slice(0, 50),
    };
  } catch {
    return null;
  }
}

function runBdJson(dir, args, timeoutMs = 4000) {
  const res = spawnSync("bd", [...args, "--json"], {
    cwd: dir,
    shell: false,
    encoding: "utf8",
    timeout: timeoutMs,
    maxBuffer: 1024 * 1024 * 4,
  });
  return {
    ok: res.status === 0,
    status: res.status,
    data: extractJsonOutput(res.stdout),
    stdout: res.stdout || "",
    stderr: res.stderr || "",
  };
}

export function getBeadsState(cwd, { includeIssues = true } = {}) {
  const dir = resolveProjectPath(cwd);
  const beadsDir = path.join(dir, ".beads");
  const installed = isBeadsAvailable();
  const initialized = fs.existsSync(beadsDir);

  const empty = {
    installed,
    initialized,
    summary: { total: 0, open: 0, inProgress: 0, blocked: 0, ready: 0, closed: 0 },
    ready: [],
    issues: [],
  };

  if (!initialized) return empty;

  if (installed) {
    const st = runBdJson(dir, ["status"], 3500);
    if (st.ok && st.data?.summary) {
      const s = st.data.summary;
      const summary = {
        total: Number(s.total_issues || 0),
        open: Number(s.open_issues || 0),
        inProgress: Number(s.in_progress_issues || 0),
        blocked: Number(s.blocked_issues || 0),
        ready: Number(s.ready_issues || 0),
        closed: Number(s.closed_issues || 0),
      };
      let ready = [];
      let issues = [];
      if (includeIssues) {
        const r = runBdJson(dir, ["ready", "--limit", "25"], 3500);
        if (r.ok && Array.isArray(r.data)) ready = r.data;
        const l = runBdJson(dir, ["list", "--limit", "50"], 3500);
        if (l.ok && Array.isArray(l.data)) issues = l.data;
      }
      return { installed: true, initialized: true, summary, ready, issues };
    }
  }

  const fallback = readBeadsJsonlFallback(beadsDir);
  if (fallback) {
    return {
      installed,
      initialized: true,
      summary: fallback.summary,
      ready: includeIssues ? fallback.ready : [],
      issues: includeIssues ? fallback.issues : [],
    };
  }

  return empty;
}

function makeBeadsPrefix(projectName) {
  const clean = String(projectName || "fw")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 6);
  if (!clean || clean === "test") return "fw";
  return clean;
}

export function initBeads(cwd, { prefix = null } = {}) {
  const dir = resolveProjectPath(cwd);
  assertWritableV3(dir);
  if (fs.existsSync(path.join(dir, ".beads"))) {
    return { initialized: true, created: false, reason: "Beads already initialized in .beads/" };
  }
  if (!isBeadsAvailable()) {
    return {
      initialized: false,
      created: false,
      reason: "Beads CLI (`bd`) is not installed. Install from https://beads.gascity.com/",
    };
  }
  const project = detectProject(dir);
  const safePrefix = String(prefix || makeBeadsPrefix(project.projectName))
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "") || "fw";

  let res = spawnSync("bd", ["init", "--prefix", safePrefix, "--quiet"], {
    cwd: dir,
    shell: false,
    encoding: "utf8",
    timeout: 15000,
  });
  if (res.status !== 0 && /unknown flag.*--quiet/i.test(res.stderr || "")) {
    res = spawnSync("bd", ["init", "--prefix", safePrefix], {
      cwd: dir,
      shell: false,
      encoding: "utf8",
      timeout: 15000,
    });
  }
  if (res.status !== 0) {
    throw new Error(`bd init failed: ${(res.stderr || res.stdout || "").trim()}`);
  }
  return { initialized: true, created: true, prefix: safePrefix };
}

export function runBeadsAction(
  cwd,
  { action = "status", id, title, type = "task", priority = 2, description, parent, status, assignee, reason, blockerId, prefix, limit } = {},
) {
  const dir = resolveProjectPath(cwd);
  const cleanAction = String(action || "status").trim().toLowerCase();

  if (cleanAction === "status") return getBeadsState(dir, { includeIssues: false });
  if (cleanAction === "ready") {
    const state = getBeadsState(dir, { includeIssues: true });
    return { installed: state.installed, initialized: state.initialized, summary: state.summary, ready: state.ready };
  }
  if (cleanAction === "list") {
    if (!fs.existsSync(path.join(dir, ".beads"))) return getBeadsState(dir, { includeIssues: false });
    if (!isBeadsAvailable()) return getBeadsState(dir, { includeIssues: true });
    const args = ["list", "--limit", String(Number(limit) || 50)];
    if (status) args.push("--status", String(status));
    if (type) args.push("--type", String(type));
    const res = runBdJson(dir, args, 5000);
    if (!res.ok) throw new Error(`bd list failed: ${(res.stderr || res.stdout).trim()}`);
    return { issues: Array.isArray(res.data) ? res.data : [] };
  }

  assertWritableV3(dir);
  if (cleanAction === "init") return initBeads(dir, { prefix });
  if (!isBeadsAvailable()) throw new Error("Beads CLI (`bd`) is not installed. Install from https://beads.gascity.com/");
  if (!fs.existsSync(path.join(dir, ".beads"))) {
    throw new Error("Beads is not initialized in this repo. Run `bd init` or `farmwork_beads` with action='init'.");
  }

  if (cleanAction === "create") {
    const cleanTitle = String(title || "").trim();
    if (!cleanTitle) throw new Error("Issue title is required for beads create.");
    const args = ["create", cleanTitle, "-t", String(type || "task"), "-p", String(Number.isFinite(Number(priority)) ? Number(priority) : 2)];
    if (description) args.push("--description", String(description));
    if (parent) args.push("--parent", String(parent));
    const res = runBdJson(dir, args, 8000);
    if (!res.ok) throw new Error(`bd create failed: ${(res.stderr || res.stdout).trim()}`);
    return { created: true, issue: res.data || { title: cleanTitle } };
  }

  if (cleanAction === "update" || cleanAction === "claim") {
    const cleanId = String(id || "").trim();
    if (!cleanId) throw new Error("Issue id is required for beads update.");
    const args = ["update", cleanId];
    if (cleanAction === "claim" && !status) args.push("--status", "in_progress");
    else if (status) args.push("--status", String(status));
    if (priority !== undefined && priority !== null) args.push("--priority", String(priority));
    if (assignee) args.push("--assignee", String(assignee));
    const res = runBdJson(dir, args, 8000);
    if (!res.ok) throw new Error(`bd update failed: ${(res.stderr || res.stdout).trim()}`);
    return { updated: true, id: cleanId, issue: res.data };
  }

  if (cleanAction === "close") {
    const cleanId = String(id || "").trim();
    if (!cleanId) throw new Error("Issue id is required for beads close.");
    const args = ["close", cleanId];
    if (reason) args.push("--reason", String(reason));
    const res = runBdJson(dir, args, 8000);
    if (!res.ok) throw new Error(`bd close failed: ${(res.stderr || res.stdout).trim()}`);
    const checklistItem = completeChecklistForBeads(dir, cleanId);
    return { closed: true, id: cleanId, issue: res.data, checklistCompleted: checklistItem?.displayTitle || null };
  }

  if (cleanAction === "dep") {
    const cleanId = String(id || "").trim();
    const cleanBlocker = String(blockerId || "").trim();
    if (!cleanId || !cleanBlocker) throw new Error("Both `id` and `blockerId` are required to add a dependency.");
    const res = spawnSync("bd", ["dep", "add", cleanId, cleanBlocker], { cwd: dir, shell: false, encoding: "utf8", timeout: 8000 });
    if (res.status !== 0) throw new Error(`bd dep add failed: ${(res.stderr || res.stdout).trim()}`);
    return { linked: true, id: cleanId, blockedBy: cleanBlocker, output: (res.stdout || "").trim() };
  }

  if (cleanAction === "sync") {
    const res = spawnSync("bd", ["sync"], { cwd: dir, shell: false, encoding: "utf8", timeout: 15000 });
    if (res.status !== 0) throw new Error(`bd sync failed: ${(res.stderr || res.stdout).trim()}`);
    return { synced: true, output: `${res.stdout || ""}\n${res.stderr || ""}`.trim() };
  }

  throw new Error(`Unknown beads action "${action}". Use: status, ready, list, create, update, claim, close, dep, sync, init.`);
}
