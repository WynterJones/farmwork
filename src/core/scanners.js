import fs from "fs-extra";
import path from "path";
import { spawnSync } from "child_process";
import { TEST_FILE_PATTERNS, listTrackedFiles, resolveProjectPath } from "./shared.js";
import { detectProject } from "./detect.js";
import { parseChecklist } from "./checklist.js";
import { detectJustfile } from "./tooling.js";

/* ============================================================================
   Deterministic Security Scan (Secrets + Tracked Files + Stack Vuln Scanners)
   ============================================================================ */

const SENSITIVE_TRACKED_FILE_PATTERNS = [
  { label: "Committed .env file", re: /(^|\/)\.env(\.(local|prod|production|staging|dev|development))?$/i },
  { label: "Private key or certificate", re: /\.(pem|p12|pfx|key|jks)$/i },
  { label: "SSH private key", re: /(^|\/)id_(rsa|ed25519|ecdsa|dsa)$/i },
];

const SECRET_PATTERNS = [
  { label: "AWS Access Key", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { label: "GitHub Token", re: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/ },
  { label: "OpenAI / Anthropic API Key", re: /\bsk-(?:proj-|ant-api\d+-)?[A-Za-z0-9_-]{24,}\b/ },
  { label: "Stripe Live Secret Key", re: /\bsk_live_[A-Za-z0-9]{16,}\b/ },
  { label: "Slack Token", re: /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/ },
  { label: "Private Key Block", re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/ },
];

const SKIP_CONTENT_EXT = /\.(png|jpe?g|gif|webp|ico|woff2?|ttf|eot|pdf|zip|gz|tar|mp3|mp4|mov|sqlite|db|lock)$/i;
const SOURCE_CODE_EXT = /\.(?:[cm]?[jt]sx?|rb|py|go|rs)$/i;

export function runSecurityScan(cwd, { skipDeps = false, timeoutMs = 30000 } = {}) {
  const dir = resolveProjectPath(cwd);
  const project = detectProject(dir);
  const files = listTrackedFiles(dir);
  const secretFindings = [];
  let filesScanned = 0;

  for (const rel of files) {
    const base = path.basename(rel);
    if (!/\.(example|sample|template)$/i.test(base)) {
      for (const pat of SENSITIVE_TRACKED_FILE_PATTERNS) {
        if (pat.re.test(rel)) {
          secretFindings.push({
            severity: "CRITICAL",
            type: pat.label,
            file: rel,
            line: null,
            detail: "Remove from git history/tracking and add to .gitignore",
          });
        }
      }
    }

    if (SKIP_CONTENT_EXT.test(rel) || base === "package-lock.json" || base === "pnpm-lock.yaml" || base === "yarn.lock") {
      continue;
    }

    const full = path.join(dir, rel);
    let stat;
    try {
      stat = fs.statSync(full);
    } catch {
      continue;
    }
    if (!stat.isFile() || stat.size > 256 * 1024) continue;

    let text;
    try {
      text = fs.readFileSync(full, "utf8");
    } catch {
      continue;
    }
    if (text.includes("\u0000")) continue;
    filesScanned++;

    const lines = text.split("\n");
    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx];
      for (const pat of SECRET_PATTERNS) {
        if (pat.re.test(line)) {
          secretFindings.push({
            severity: "CRITICAL",
            type: pat.label,
            file: rel,
            line: idx + 1,
            detail: "Possible hardcoded secret detected (value redacted)",
          });
          break;
        }
      }
    }
  }

  let dependencyAudit = { status: "skipped", tool: null, command: null, durationMs: 0, reason: "Skipped" };

  if (!skipDeps) {
    let tool = null;
    let command = null;

    if (fs.existsSync(path.join(dir, "package-lock.json"))) {
      tool = "npm audit";
      command = "npm audit --omit=dev --audit-level=high";
    } else if (fs.existsSync(path.join(dir, "bin", "brakeman"))) {
      tool = "brakeman";
      command = "bin/brakeman -q --no-pager";
    } else if (fs.existsSync(path.join(dir, "Cargo.lock"))) {
      if (spawnSync("cargo", ["audit", "--version"], { stdio: "ignore" }).status === 0) {
        tool = "cargo audit";
        command = "cargo audit";
      }
    } else if (fs.existsSync(path.join(dir, "pyproject.toml")) || fs.existsSync(path.join(dir, "requirements.txt"))) {
      if (spawnSync("pip-audit", ["--version"], { stdio: "ignore" }).status === 0) {
        tool = "pip-audit";
        command = "pip-audit";
      }
    }

    if (!command) {
      dependencyAudit = {
        status: "skipped",
        tool: null,
        command: null,
        durationMs: 0,
        reason: "No supported lockfile or security scanner detected (npm audit / brakeman / cargo-audit / pip-audit)",
      };
    } else {
      const start = Date.now();
      const res = spawnSync(command, {
        cwd: dir,
        shell: true,
        encoding: "utf8",
        timeout: timeoutMs,
        maxBuffer: 1024 * 1024 * 4,
      });
      const durationMs = Date.now() - start;
      const combined = `${res.stdout || ""}\n${res.stderr || ""}`.trim();
      const tail = combined.split("\n").slice(-30).join("\n");

      if (res.status !== 0 && /ENOTFOUND|EAI_AGAIN|ETIMEDOUT|network/i.test(combined)) {
        dependencyAudit = {
          status: "skipped",
          tool,
          command,
          durationMs,
          reason: `${tool} skipped (offline / registry unreachable)`,
        };
      } else {
        dependencyAudit = {
          status: res.status === 0 ? "passed" : "failed",
          tool,
          command,
          durationMs,
          output: tail,
        };
      }
    }
  }

  const passed = secretFindings.length === 0 && dependencyAudit.status !== "failed";
  return {
    projectName: project.projectName,
    stack: project.stack,
    passed,
    filesScanned,
    secretFindings,
    dependencyAudit,
  };
}

/* ============================================================================
   Deterministic Code Quality & State-Machine Hotspot Scanner
   (Built into standard audits — native language constructs recommended first)
   ============================================================================ */

export function nativeStateRecommendation(stack) {
  switch (stack) {
    case "rails":
    case "ruby":
      return "Use Rails `enum` + explicit guarded transition methods (e.g. `transition_to!`) and a frozen `ALLOWED_TRANSITIONS` map — no external state-machine gem required.";
    case "rust":
      return "Model states as a native Rust `enum` with state-specific payloads and exhaustive `match` transitions.";
    case "python":
    case "mcp-python":
      return "Model states with `enum.StrEnum` or `typing.Literal` + `dataclass` payloads and an explicit `ALLOWED_TRANSITIONS` dict.";
    case "go":
      return "Model states with a typed `string`/`iota` constant type and an explicit `switch` transition validator.";
    case "vite-react":
    case "next":
    case "react":
    case "vite":
      return "Model states as TypeScript discriminated unions (e.g. `{ kind: 'idle' } | { kind: 'loading' } | { kind: 'error'; message: string }`) or a frozen transition table — no XState required.";
    default:
      return "Model states with a frozen state/transition map (or TypeScript discriminated union) and a single `transition(state, event)` function — no state-machine library required.";
  }
}

// High-signal lifecycle/UI boolean names that commonly explode into impossible states (2^n)
const LIFECYCLE_BOOL_RE =
  /\b(?:is|has)(?:Loading|Loaded|Saving|Saved|Submitting|Submitted|Fetching|Pending|Processing|Error|Failed|Success|Succeeded|Ready|Open|Closed|Editing|Dirty|Valid|Active|Disabled|Cancelled|Canceled|Completed|Paid|Shipped|Delivered|Synced|Connected|Authenticated|Verified|Blocked|Retired|Archived|Running|Busy)\b/g;

// Raw status string assignments/mutations outside explicit transition tables
const LOOSE_STATUS_MUTATION_RE =
  /(?:\.\b(?:status|state|lifecycle|phase|stage)\s*=\s*["'][a-z][a-z0-9_-]{1,24}["']|\bset(?:Status|State|Phase|Stage)\s*\(\s*["'][a-z][a-z0-9_-]{1,24}["']|\.update!?\s*\([^)]*\b(?:status|state)\s*:\s*(?:["':][a-z][a-z0-9_-]{1,24}))/gi;

// Explicit guard / transition pattern (presence lowers false positives when a file already models transitions cleanly)
const EXPLICIT_TRANSITION_RE =
  /\b(?:ALLOWED_TRANSITIONS|TRANSITIONS|VALID_TRANSITIONS|transition\w*\s*\(|switch\s*\([^)]*\.(?:kind|type|status|state)\b|enum\s*:\s*(?:status|state)\b)/;

// Stray debugger statements (non-test source files)
const DEBUG_NOISE_PATTERNS = [
  { label: "debugger statement", re: /^\s*debugger\s*;?\s*$/ },
  { label: "Ruby debugger (binding.pry / byebug)", re: /^\s*(?:binding\.pry|byebug|debugger)\b/ },
  { label: "Python breakpoint / pdb", re: /^\s*(?:breakpoint\(\)|(?:import\s+pdb;\s*)?pdb\.set_trace\(\))/ },
];

export function runCodeQualityScan(cwd, { maxFileLines = null, skipDeadCode = true, timeoutMs = 20000 } = {}) {
  const dir = resolveProjectPath(cwd);
  const project = detectProject(dir);
  const limit = Number(maxFileLines || project.limits?.maxFileLines || 700);
  const files = listTrackedFiles(dir);

  const oversizedFiles = [];
  const stateMachineHotspots = [];
  const debugNoise = [];
  let sourceFilesScanned = 0;

  for (const rel of files) {
    if (!SOURCE_CODE_EXT.test(rel)) continue;
    const base = path.basename(rel);
    if (TEST_FILE_PATTERNS.some((re) => re.test(base))) continue;

    const full = path.join(dir, rel);
    let stat;
    try {
      stat = fs.statSync(full);
    } catch {
      continue;
    }
    if (!stat.isFile() || stat.size > 512 * 1024) continue;

    let text;
    try {
      text = fs.readFileSync(full, "utf8");
    } catch {
      continue;
    }
    if (text.includes("\u0000")) continue;
    sourceFilesScanned++;

    const lines = text.split("\n");

    // 1. Oversized monolith check (prevents Trash Mountain god-files)
    if (lines.length > limit) {
      oversizedFiles.push({
        file: rel,
        lines: lines.length,
        limit,
        detail: `Exceeds ${limit}-line guideline — split into focused modules`,
      });
    }

    // 2. Implicit state machine hotspots: boolean flag explosions & loose status mutations
    // Strip comments and markdown backtick prose so doc/template strings mentioning examples don't false-positive.
    const codeForBoolScan = lines
      .filter((l) => {
        const t = l.trim();
        return !t.startsWith("//") && !t.startsWith("#") && !t.startsWith("*");
      })
      .join("\n")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\\?`[^`\n]+\\?`/g, "");

    const boolFlags = new Set();
    for (const m of codeForBoolScan.matchAll(LIFECYCLE_BOOL_RE)) {
      boolFlags.add(m[0]);
    }
    const statusMutations = [];
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (trimmed.startsWith("//") || trimmed.startsWith("#") || trimmed.startsWith("*")) continue;
      if (LOOSE_STATUS_MUTATION_RE.test(lines[i])) {
        statusMutations.push(i + 1);
      }
      LOOSE_STATUS_MUTATION_RE.lastIndex = 0;
    }

    const hasExplicitModel = EXPLICIT_TRANSITION_RE.test(text);

    if (boolFlags.size >= 3) {
      stateMachineHotspots.push({
        file: rel,
        kind: "boolean-explosion",
        severity: boolFlags.size >= 5 ? "HIGH" : "MEDIUM",
        signals: [...boolFlags].slice(0, 8),
        detail: `${boolFlags.size} lifecycle boolean flags (${[...boolFlags].slice(0, 5).join(", ")}) — risks impossible 2^${boolFlags.size} state combinations`,
      });
    }

    if (statusMutations.length >= 2 && !hasExplicitModel) {
      stateMachineHotspots.push({
        file: rel,
        kind: "loose-status-mutations",
        severity: statusMutations.length >= 4 ? "HIGH" : "MEDIUM",
        lines: statusMutations.slice(0, 6),
        detail: `${statusMutations.length} raw status/state string assignments (lines ${statusMutations.slice(0, 5).join(", ")}) without an explicit transition validator`,
      });
    }

    // 3. Stray debug breakpoints
    for (let i = 0; i < lines.length; i++) {
      for (const pat of DEBUG_NOISE_PATTERNS) {
        if (pat.re.test(lines[i])) {
          debugNoise.push({
            file: rel,
            line: i + 1,
            type: pat.label,
          });
          break;
        }
      }
    }
  }

  // 4. Optional dead-code tool delegation (only when local tool is already installed)
  let deadCodeAudit = { status: "skipped", tool: null, command: null, reason: "Skipped" };
  if (!skipDeadCode) {
    let tool = null;
    let command = null;
    if (fs.existsSync(path.join(dir, "node_modules", ".bin", "knip"))) {
      tool = "knip";
      command = "npx knip --no-progress";
    } else if (
      (fs.existsSync(path.join(dir, "pyproject.toml")) || fs.existsSync(path.join(dir, "requirements.txt"))) &&
      spawnSync("vulture", ["--version"], { stdio: "ignore" }).status === 0
    ) {
      tool = "vulture";
      command = "vulture . --min-confidence 80";
    } else if (
      fs.existsSync(path.join(dir, "go.mod")) &&
      spawnSync("deadcode", ["-h"], { stdio: "ignore" }).status === 0
    ) {
      tool = "deadcode";
      command = "deadcode ./...";
    }

    if (command) {
      const start = Date.now();
      const res = spawnSync(command, {
        cwd: dir,
        shell: true,
        encoding: "utf8",
        timeout: timeoutMs,
        maxBuffer: 1024 * 1024 * 4,
      });
      const tail = `${res.stdout || ""}\n${res.stderr || ""}`.trim().split("\n").slice(-30).join("\n");
      deadCodeAudit = {
        status: res.status === 0 ? "passed" : "issues",
        tool,
        command,
        durationMs: Date.now() - start,
        output: tail,
      };
    } else {
      deadCodeAudit = {
        status: "skipped",
        tool: null,
        command: null,
        reason: "No local dead-code scanner detected (knip / vulture / deadcode)",
      };
    }
  }

  oversizedFiles.sort((a, b) => b.lines - a.lines);
  const clean = oversizedFiles.length === 0 && stateMachineHotspots.length === 0 && debugNoise.length === 0;

  return {
    projectName: project.projectName,
    stack: project.stack,
    clean,
    sourceFilesScanned,
    maxFileLines: limit,
    oversizedFiles,
    stateMachineHotspots,
    stateRecommendation: nativeStateRecommendation(project.stack),
    debugNoise,
    deadCodeAudit,
  };
}

/* ============================================================================
   Context-Budget & Doc Drift Hygiene (AGENTS.md + justfile alignment)
   ============================================================================ */

export function checkContextHygiene(cwd, { maxAgentsLines = 180 } = {}) {
  const dir = resolveProjectPath(cwd);
  const project = detectProject(dir);
  const justInfo = detectJustfile(dir);
  const issues = [];

  const agentsPath = path.join(dir, "AGENTS.md");
  let agentsLines = 0;
  const brokenRefs = [];

  if (fs.existsSync(agentsPath)) {
    const content = fs.readFileSync(agentsPath, "utf8");
    agentsLines = content.split("\n").length;
    if (agentsLines > maxAgentsLines) {
      issues.push({
        kind: "agents-bloat",
        severity: "WARNING",
        detail: `AGENTS.md is ${agentsLines} lines (recommended <= ${maxAgentsLines} to avoid agent context bloat)`,
      });
    }

    // Check explicit local file references like `src/foo.js`, `_AUDIT/FARMHOUSE.md`, `scripts/bar.sh`
    const refRe = /`((?:\.?[A-Za-z0-9_-]+\/)+[A-Za-z0-9_.-]+\.[A-Za-z0-9]+)`/g;
    const checked = new Set();
    for (const m of content.matchAll(refRe)) {
      const ref = m[1];
      if (checked.has(ref)) continue;
      checked.add(ref);
      // Skip template placeholders, globs, URLs, and lazy on-demand audit docs
      if (/[*<>[\]{}]/.test(ref) || ref.startsWith("http") || /^_AUDIT\/(?:COMPOST|SECURITY|PERFORMANCE|ACCESSIBILITY|CODE_QUALITY)\.md$/.test(ref)) {
        continue;
      }
      if (!fs.existsSync(path.join(dir, ref))) {
        brokenRefs.push(ref);
      }
    }
    if (brokenRefs.length > 0) {
      issues.push({
        kind: "broken-doc-refs",
        severity: "WARNING",
        refs: brokenRefs,
        detail: `AGENTS.md references missing files: ${brokenRefs.join(", ")}`,
      });
    }
  }

  // Check if configured quality gates in .farmwork.json have matching recipes in justfile
  const missingJustRecipes = [];
  if (justInfo.exists) {
    const recipeNames = new Set(justInfo.recipes.map((r) => r.name));
    for (const gate of ["lint", "test", "build"]) {
      if (project.commands[gate] && !recipeNames.has(gate)) {
        missingJustRecipes.push(gate);
      }
    }
    if (missingJustRecipes.length > 0) {
      issues.push({
        kind: "justfile-drift",
        severity: "WARNING",
        missing: missingJustRecipes,
        detail: `${justInfo.file} is missing recipes for configured gates: ${missingJustRecipes.join(", ")}`,
      });
    }
  }

  // Check human checklist conciseness (big plans & standards stay <=30 items; granular tasks belong in Beads)
  const checklist = parseChecklist(dir);
  if (checklist.exists && checklist.summary.bloated) {
    issues.push({
      kind: "checklist-bloat",
      severity: "WARNING",
      activeItems: checklist.summary.activeTotal,
      maxRecommended: checklist.summary.maxRecommended,
      detail: checklist.summary.warning,
    });
  }

  return {
    clean: issues.length === 0,
    agentsLines,
    maxAgentsLines,
    brokenRefs,
    missingJustRecipes,
    checklistActiveItems: checklist.summary.activeTotal,
    checklistMaxRecommended: checklist.summary.maxRecommended,
    issues,
  };
}
