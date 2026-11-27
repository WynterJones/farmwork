import fs from "fs-extra";
import path from "path";
import { execSync, spawnSync } from "child_process";

export const VERSION = "3.3.0";

export const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  ".beads",
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

export const TEST_FILE_PATTERNS = [
  /\.test\.[cm]?[jt]sx?$/i,
  /\.spec\.[cm]?[jt]sx?$/i,
  /_test\.rb$/i,
  /_spec\.rb$/i,
  /_test\.go$/i,
  /^test_.*\.py$/i,
  /_test\.py$/i,
  /_test\.rs$/i,
];

const LEGACY_V1_AUDIT_FILES = ["KNIP.md", "TESTS.md"];

export const PILLAR_AUDITS = {
  security: {
    key: "security",
    file: "SECURITY.md",
    title: "Security Audit",
    description: "OWASP posture, secrets hygiene, and dependency vulnerabilities",
  },
  performance: {
    key: "performance",
    file: "PERFORMANCE.md",
    title: "Performance Audit",
    description: "Speed, bundle size, queries, rendering, and runtime efficiency",
  },
  accessibility: {
    key: "accessibility",
    file: "ACCESSIBILITY.md",
    title: "Accessibility Audit",
    description: "WCAG 2.1 AA semantics, keyboard navigation, and contrast",
  },
  "code-quality": {
    key: "code-quality",
    file: "CODE_QUALITY.md",
    title: "Code Quality Audit",
    description: "Modularity, state machines (explicit & implicit), error handling, and dead code",
  },
};

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

export function plural(n, singular, pluralWord = `${singular}s`) {
  return `${n} ${n === 1 ? singular : pluralWord}`;
}

export const FARMWORK_STANDARDS_MD = `# Farmwork v3 Agent Standards

> Living operational contract for any AI coding agent (Claude Code, Gemini CLI, Codex, Cursor, Antigravity) keeping small, fast projects clean and out of Trash Mountain.

## Core Principles
1. **Checklists = Humans & Big Picture (\`_AUDIT/CHECKLIST.md\`)** — Keep checklists concise (<=30 items) so a person can scan project health, **big plans**, and **future plans** at a glance. When the user says "big plan" or mentions a future plan, add one concise item under \`## Big Plans & Future Roadmap\` and link its Beads epic (\`beads: <id>\`) when work begins. NEVER dump granular tasks or let checklists grow into 100–200+ items.
2. **Beads = Agents & Granular Execution (\`.beads/\`)** — Agents break big plans into granular tasks, subtasks, and dependencies inside Beads (\`bd\` or \`farmwork_beads\`: \`ready\` → \`claim\` → \`close\` → \`sync\`). Graduate plan steps via \`farmwork_plan\` (\`action: "to-beads"\`), which creates the Beads epic + child tasks and links the epic back to the checklist (closing that epic checks the item off).
3. **Plan Before Non-Trivial Code** — Save high-level specs to \`_PLANS/<FEATURE_NAME>.md\` via \`farmwork_plan\` (\`action: "create"\`) and confirm before large edits.
4. **Use & Maintain the \`justfile\`** — Prefer \`just\` recipes (\`just --list\`, \`just check\`, \`just test\`, \`just dev\`). Update \`justfile\` in the same change whenever scripts evolve.
5. **Make Invalid States Unrepresentable** — Audit explicit and implicit state machines (boolean flag clusters like \`isLoading\`/\`isError\`, loose status strings mutated across files). Refactor using **native language constructs first** (TS discriminated unions, Rails enums + guarded methods, Rust/Python/Go enums) — don't add a state-machine library unless genuinely needed.
6. **Keep Modules Small & Honest** — Split files before they turn into monoliths (>700 lines), remove dead code and debug noise, and preserve comments that explain *why* a non-obvious decision exists.
7. **Verify Gates Before Shipping** — Run \`farmwork_gates\` (lint, test, build, security) on the current commit before claiming work is done.
8. **Keep \`AGENTS.md\` Lean & Capture Tangents** — Keep repo instructions concise (<180 lines) and plant out-of-scope ideas in \`_AUDIT/GARDEN.md\` (\`farmwork_garden\`) instead of expanding the current diff.
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

let cachedGlobalV3 = null;
let cachedJustAvailable = null;
let cachedBeadsAvailable = null;

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

export function isJustAvailable() {
  if (cachedJustAvailable !== null) return cachedJustAvailable;
  try {
    cachedJustAvailable = spawnSync("just", ["--version"], { stdio: "ignore", timeout: 2500 }).status === 0;
  } catch {
    cachedJustAvailable = false;
  }
  return cachedJustAvailable;
}

export function isBeadsAvailable() {
  if (cachedBeadsAvailable !== null) return cachedBeadsAvailable;
  try {
    cachedBeadsAvailable = spawnSync("bd", ["--version"], { stdio: "ignore", timeout: 2500 }).status === 0;
  } catch {
    cachedBeadsAvailable = false;
  }
  return cachedBeadsAvailable;
}

export function listTrackedFiles(cwd) {
  const dir = resolveProjectPath(cwd);
  if (fs.existsSync(path.join(dir, ".git"))) {
    const res = spawnSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
      cwd: dir,
      shell: false,
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 4,
      timeout: 5000,
    });
    if (res.status === 0 && res.stdout) {
      const files = res.stdout
        .split("\n")
        .filter(Boolean)
        .filter((rel) => !rel.split("/").some((part) => IGNORED_DIRS.has(part)));
      if (files.length > 0) return files;
    }
  }

  const files = [];
  function walk(current, relBase, depth) {
    if (depth > 6 || files.length > 1500) return;
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      const rel = relBase ? `${relBase}/${entry.name}` : entry.name;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full, rel, depth + 1);
      } else if (entry.isFile()) {
        files.push(rel);
      }
    }
  }
  walk(dir, "", 0);
  return files;
}
