import fs from "fs-extra";
import path from "path";
import { spawnSync } from "child_process";
import { IGNORED_DIRS, TEST_FILE_PATTERNS, readManifest, resolveProjectPath } from "./shared.js";

function isPlaceholderTestScript(cmd) {
  return typeof cmd === "string" && /no test specified/i.test(cmd);
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
    limits: manifest?.limits || {},
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
    return {
      isGitRepo: false,
      branch: null,
      headSha: null,
      dirtyCount: 0,
      ahead: 0,
      behind: 0,
      lastCommitDate: null,
      lastCommitMessage: null,
    };
  }

  const runGit = (args) => {
    const res = spawnSync("git", args, {
      cwd: dir,
      shell: false,
      encoding: "utf8",
      timeout: 2500,
    });
    return res.status === 0 ? (res.stdout || "").trimEnd() : "";
  };

  // Single git call for branch, upstream ahead/behind, and dirty count (replaces 3 separate spawns)
  const statusOut = runGit(["status", "--porcelain=v1", "--branch"]);
  let branch = null;
  let ahead = 0;
  let behind = 0;
  let dirtyCount = 0;

  if (statusOut) {
    const statusLines = statusOut.split("\n");
    const header = statusLines[0] || "";
    if (header.startsWith("## ")) {
      const rest = header.slice(3);
      if (/^No commits yet on /i.test(rest)) {
        branch = rest.replace(/^No commits yet on /i, "").trim();
      } else {
        const branchPart = rest.split("...")[0].trim();
        branch = branchPart.startsWith("HEAD") ? "HEAD" : branchPart;
      }
      const aheadMatch = rest.match(/\bahead (\d+)/);
      const behindMatch = rest.match(/\bbehind (\d+)/);
      if (aheadMatch) ahead = Number.parseInt(aheadMatch[1], 10) || 0;
      if (behindMatch) behind = Number.parseInt(behindMatch[1], 10) || 0;
    }
    dirtyCount = statusLines.slice(1).filter(Boolean).length;
  }

  // Single git call for short HEAD SHA, commit date, and subject (replaces 3 separate spawns)
  const logOut = runGit(["log", "-1", "--format=%h%x1f%cs%x1f%s"]);
  const [rawSha, rawDate, rawMsg] = logOut ? logOut.split("\x1f") : [];
  const headSha = rawSha || null;
  const lastCommitDate = rawDate || null;
  const lastCommitMessage = rawMsg || null;

  return { isGitRepo: true, branch, headSha, dirtyCount, ahead, behind, lastCommitDate, lastCommitMessage };
}

const FARMWORK_METADATA_RE = /^(?:\.farmwork\.json|_AUDIT\/|_PLANS\/|\.beads\/)/;

export function countCommitsSince(cwd, sha, { ignoreMetadata = true } = {}) {
  const dir = resolveProjectPath(cwd);
  if (!sha || !/^[0-9a-f]{4,40}$/i.test(String(sha)) || !fs.existsSync(path.join(dir, ".git"))) {
    return null;
  }
  if (!ignoreMetadata) {
    const res = spawnSync("git", ["rev-list", "--count", `${sha}..HEAD`], {
      cwd: dir,
      shell: false,
      encoding: "utf8",
      timeout: 2500,
    });
    if (res.status !== 0) return null;
    const n = Number.parseInt((res.stdout || "").trim(), 10);
    return Number.isNaN(n) ? null : n;
  }

  const res = spawnSync("git", ["log", "--format=COMMIT:%H", "--name-only", `${sha}..HEAD`], {
    cwd: dir,
    shell: false,
    encoding: "utf8",
    timeout: 2500,
  });
  if (res.status !== 0) return null;

  let count = 0;
  let inCommit = false;
  let currentHasCode = false;
  for (const raw of (res.stdout || "").split("\n")) {
    const line = raw.trim();
    if (line.startsWith("COMMIT:")) {
      if (inCommit && currentHasCode) count++;
      inCommit = true;
      currentHasCode = false;
    } else if (line && !FARMWORK_METADATA_RE.test(line)) {
      currentHasCode = true;
    }
  }
  if (inCommit && currentHasCode) count++;
  return count;
}
