import fs from "fs-extra";
import path from "path";
import { spawnSync } from "child_process";
import {
  PILLAR_AUDITS,
  assertWritableV3,
  detectFarmworkInstall,
  isFarmworkProject,
  plural,
  readManifest,
  resolveProjectPath,
  todayISO,
} from "./shared.js";
import { countCommitsSince, countTestFiles, detectProject, getGitState } from "./detect.js";
import { parseChecklist } from "./checklist.js";
import { listPlans, parseCompost, parseGarden, tendGarden } from "./markdown.js";
import { detectJustfile, getBeadsState } from "./tooling.js";
import { checkContextHygiene, runCodeQualityScan, runSecurityScan } from "./scanners.js";

/* ============================================================================
   Lazy Pillar Audits (Security, Performance, Accessibility, Code Quality)
   ============================================================================ */

export function parsePillarAudits(cwd) {
  const dir = resolveProjectPath(cwd);
  return Object.values(PILLAR_AUDITS).map((meta) => {
    const relPath = `_AUDIT/${meta.file}`;
    const full = path.join(dir, relPath);
    if (!fs.existsSync(full)) {
      return {
        key: meta.key,
        file: meta.file,
        path: relPath,
        title: meta.title,
        description: meta.description,
        exists: false,
        score: null,
        status: null,
        lastUpdated: null,
      };
    }
    const content = fs.readFileSync(full, "utf8");
    const scoreMatch = content.match(/\*\*Score:\*\*\s*([\d.]+)\s*\/\s*10/i);
    const statusMatch = content.match(/\*\*Status:\*\*\s*(.+)/i);
    const updatedMatch = content.match(/\*\*Last Updated:\*\*\s*(\d{4}-\d{2}-\d{2})/i);
    return {
      key: meta.key,
      file: meta.file,
      path: relPath,
      title: meta.title,
      description: meta.description,
      exists: true,
      score: scoreMatch ? Number(scoreMatch[1]) : null,
      status: statusMatch ? statusMatch[1].trim() : "Audited",
      lastUpdated: updatedMatch ? updatedMatch[1] : null,
    };
  });
}

export function savePillarAudit(
  cwd,
  { pillar, score, status = "Audited", summary = "", findings = [], recommendations = [] },
) {
  const dir = resolveProjectPath(cwd);
  assertWritableV3(dir);

  const key = String(pillar || "").trim().toLowerCase();
  const meta = PILLAR_AUDITS[key];
  if (!meta) {
    throw new Error(`Unknown pillar "${pillar}". Use: ${Object.keys(PILLAR_AUDITS).join(", ")}.`);
  }

  const numScore = Number(score);
  if (Number.isNaN(numScore) || numScore < 0 || numScore > 10) {
    throw new Error("Score must be a number between 0 and 10.");
  }
  const roundedScore = Number(numScore.toFixed(1));
  const today = todayISO();
  const relPath = `_AUDIT/${meta.file}`;
  const fullPath = path.join(dir, relPath);

  let existingHistoryRows = [];
  if (fs.existsSync(fullPath)) {
    const prev = fs.readFileSync(fullPath, "utf8");
    const histMatch = prev.match(/## Audit History\s*\n([\s\S]*)$/);
    if (histMatch) {
      existingHistoryRows = histMatch[1]
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.startsWith("|") && !l.includes("---") && !l.toLowerCase().includes("| date |"));
    }
  }

  const cleanFindings = Array.isArray(findings) ? findings : [];
  const findingsMd =
    cleanFindings.length === 0
      ? "_No open issues recorded._"
      : cleanFindings
          .map((f) => {
            if (typeof f === "string") return `- ${f}`;
            const sev = String(f.severity || "MEDIUM").toUpperCase();
            const loc = f.location ? ` (\`${f.location}\`)` : "";
            const fix = f.fix ? ` — **Fix:** ${f.fix}` : "";
            return `- **[${sev}]** ${f.title || f.detail || "Finding"}${loc}${f.detail && f.title ? `: ${f.detail}` : ""}${fix}`;
          })
          .join("\n");

  const recsMd =
    Array.isArray(recommendations) && recommendations.length > 0
      ? recommendations.map((r) => `- ${r}`).join("\n")
      : "- _Keep gates green and re-audit after major architecture changes._";

  const newRow = `| ${today} | Score ${roundedScore}/10 · ${plural(cleanFindings.length, "finding")} · ${status} |`;
  const historyRows = existingHistoryRows[0] === newRow ? existingHistoryRows : [newRow, ...existingHistoryRows];
  const trimmedHistory = historyRows.slice(0, 15).join("\n");

  const project = detectProject(dir);
  const content = `# ${meta.title} — ${project.projectName}

> ${meta.description}

**Last Updated:** ${today}
**Score:** ${roundedScore}/10
**Status:** ${status}

---

## Executive Summary

${summary || "_Audit completed via Farmwork v3._"}

---

## Findings

${findingsMd}

---

## Recommendations

${recsMd}

---

## Audit History

| Date | Summary |
|------|---------|
${trimmedHistory}
`;

  fs.ensureDirSync(path.join(dir, "_AUDIT"));
  fs.writeFileSync(fullPath, content);

  return {
    saved: true,
    pillar: meta.key,
    path: relPath,
    score: roundedScore,
    status,
    findingsCount: cleanFindings.length,
  };
}

/* ============================================================================
   Deterministic Health Score, Audit & Quality Gates (with Gate Staleness)
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
  const justfile = detectJustfile(dir);
  const beads = getBeadsState(dir, { includeIssues: false });
  const contextHygiene = checkContextHygiene(dir);

  const hasAgentsMd = fs.existsSync(path.join(dir, "AGENTS.md"));
  const hasClaudeMd = fs.existsSync(path.join(dir, "CLAUDE.md"));
  const hasMcpConfig = fs.existsSync(path.join(dir, ".mcp.json"));
  const hasFarmhouse = assumeFarmhouse || fs.existsSync(path.join(dir, "_AUDIT", "FARMHOUSE.md"));
  const hasPlansDir = fs.existsSync(path.join(dir, "_PLANS"));

  const breakdown = [];
  let earned = 0;

  // 1. Setup & Living Docs (2.0 pts — COMPOST.md & Pillar Audits created lazily)
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

  // 2. Checklist Standards (3.0 pts) — big plans / future roadmap items are excluded (pending by design)
  const standards = checklist.summary.standards;
  const checklistPts = checklist.exists ? Number(((standards.percent / 100) * 3.0).toFixed(1)) : 0;
  earned += checklistPts;
  breakdown.push({
    label: `Checklist Standards (${standards.percent}% of ${standards.active} active)`,
    points: checklistPts,
    max: 3.0,
    passed: checklist.exists && standards.percent >= 70,
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

  // 4. Verified Quality Gates (2.5 pts — decays honestly if commits landed after last gate run)
  const rawLastGates = project.lastGates;
  const commitsSinceGates =
    rawLastGates?.commitSha && git.isGitRepo ? countCommitsSince(dir, rawLastGates.commitSha) : null;
  const gatesStale = typeof commitsSinceGates === "number" && commitsSinceGates > 0;
  const lastGates = rawLastGates
    ? { ...rawLastGates, commitsSince: commitsSinceGates, stale: gatesStale }
    : null;

  let gatePts = 0;
  let gateLabel = "Quality Gates (not yet verified — run `farmwork gates`)";
  let gatePassed = false;
  if (lastGates && lastGates.ranCount > 0) {
    if (lastGates.allPassed && !gatesStale) {
      gatePts = 2.5;
      gatePassed = true;
      gateLabel = `Quality Gates (${lastGates.passedCount}/${lastGates.ranCount} passed on ${lastGates.date})`;
    } else if (lastGates.allPassed && gatesStale) {
      gatePts = 1.5;
      gatePassed = false;
      gateLabel = `Quality Gates (passed ${plural(commitsSinceGates, "commit")} ago — stale, re-run \`farmwork gates\`)`;
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
    pillars: parsePillarAudits(dir),
    justfile,
    beads,
    contextHygiene,
    metrics: {
      testFiles,
      totalPlans: plans.length,
      completedPlans: plans.filter((p) => p.completed).length,
      activeIdeas: garden.ideas.length,
      wiltingIdeas: garden.ideas.filter((i) => i.lifecycle === "wilting").length,
      compostedIdeas: compost.items.length,
      checklistPercent: standards.percent,
      checklistCompleted: standards.completed,
      checklistActive: standards.active,
      bigPlans: checklist.summary.bigPlans.total,
      bigPlansCompleted: checklist.summary.bigPlans.completed,
      justRecipes: justfile.recipes.length,
      beadsReady: beads.summary.ready,
      beadsOpen: beads.summary.open + beads.summary.inProgress,
      beadsClosed: beads.summary.closed,
    },
    files: {
      manifest: project.hasManifest,
      v3Manifest: project.hasV3Manifest,
      agentsMd: hasAgentsMd,
      claudeMd: hasClaudeMd,
      mcpConfig: hasMcpConfig,
      justfile: justfile.exists,
      beads: beads.initialized,
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
  const codeQuality = runCodeQualityScan(dir, { skipDeadCode: true });
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

  const historyRows = existingHistoryRows[0] === newRow ? existingHistoryRows : [newRow, ...existingHistoryRows];
  const trimmedHistory = historyRows.slice(0, 15).join("\n");

  const breakdownRows = health.breakdown
    .map((b) => `| ${b.passed ? "✅" : "⚠️"} ${b.label} | ${b.points} / ${b.max} |`)
    .join("\n");

  const hotspotSummary =
    codeQuality.clean
      ? `Clean (${codeQuality.sourceFilesScanned} source files — 0 oversized, 0 state-machine hotspots, 0 debug breakpoints)`
      : [
          codeQuality.oversizedFiles.length ? `${plural(codeQuality.oversizedFiles.length, "oversized file")} (>${codeQuality.maxFileLines}L)` : null,
          codeQuality.stateMachineHotspots.length ? plural(codeQuality.stateMachineHotspots.length, "state-machine hotspot") : null,
          codeQuality.debugNoise.length ? plural(codeQuality.debugNoise.length, "debug breakpoint") : null,
        ]
          .filter(Boolean)
          .join(" · ");

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
| Checklist Standards | ${health.metrics.checklistPercent}% (${health.metrics.checklistCompleted}/${health.metrics.checklistActive}) |
| Big Plans | ${health.metrics.bigPlansCompleted} / ${health.metrics.bigPlans} done (granular tasks in Beads) |
| Plans | ${health.metrics.completedPlans} / ${health.metrics.totalPlans} complete |
| Active Ideas | ${health.metrics.activeIdeas} (${health.metrics.wiltingIdeas} wilting) |
| Composted Ideas | ${health.metrics.compostedIdeas} |
| Beads Issues | ${health.beads.initialized ? `${health.beads.summary.ready} ready · ${health.beads.summary.open + health.beads.summary.inProgress} open · ${health.beads.summary.closed} closed` : "not initialized"} |
| Justfile | ${health.justfile.exists ? `\`${health.justfile.file}\` (${plural(health.justfile.recipes.length, "recipe")})` : "not present"} |
| State & Hygiene Signals | ${hotspotSummary} |
| Context Hygiene | ${health.contextHygiene.clean ? `Clean (AGENTS.md ${health.contextHygiene.agentsLines}L)` : `${plural(health.contextHygiene.issues.length, "warning")} (run \`farmwork doctor\`)`} |
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

  return { health, gardenResult, codeQuality, farmhousePath };
}

export function runGates(cwd, { only = null, timeoutMs = 120000 } = {}) {
  const dir = resolveProjectPath(cwd);
  const project = detectProject(dir);
  const git = getGitState(dir);
  const gateNames = Array.isArray(only) && only.length > 0 ? only : ["lint", "test", "build", "security"];

  const results = [];
  for (const name of gateNames) {
    if (name === "security") {
      const start = Date.now();
      const scan = runSecurityScan(dir, { skipDeps: true });
      const durationMs = Date.now() - start;
      results.push({
        gate: "security",
        status: scan.passed ? "passed" : "failed",
        exitCode: scan.passed ? 0 : 1,
        command: "farmwork security --skip-deps",
        durationMs,
        output: scan.passed
          ? `Scanned ${scan.filesScanned} files — 0 secrets/sensitive files found`
          : scan.secretFindings.map((f) => `[${f.severity}] ${f.type}: ${f.file}${f.line ? `:${f.line}` : ""}`).join("\n"),
      });
      continue;
    }

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
    commitSha: git.headSha || null,
    allPassed,
    ranCount: ranResults.length,
    passedCount,
    gates: Object.fromEntries(results.map((r) => [r.gate, r.status])),
  };

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
