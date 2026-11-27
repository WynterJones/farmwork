import fs from "fs-extra";
import path from "path";
import { assertWritableV3, resolveProjectPath } from "./shared.js";
import { detectProject } from "./detect.js";

/* ============================================================================
   Human-Facing Big-Picture Checklists (_AUDIT/CHECKLIST.md)
   - Concise (<=30 active items recommended): big plans, future plans & standards
   - Granular execution tasks belong in Beads (.beads/), linked via `beads: <id>`
   ============================================================================ */

export const BIG_PLANS_GROUP = "Big Plans & Future Roadmap";
export const DEFAULT_MAX_CHECKLIST_ITEMS = 30;

const TRAILING_META_RE = /\s*\((?=[^)]*(?:\bbeads:|_PLANS\/))([^)]+)\)\s*$/i;
const PLAN_REF_RE = /`?(_PLANS\/[A-Za-z0-9_.-]+\.md)`?/;
const BEADS_REF_RE = /\bbeads:\s*`?([A-Za-z0-9._-]+)`?/i;

export function parseChecklistMeta(rawTitle) {
  const full = String(rawTitle || "").trim();
  const planMatch = full.match(PLAN_REF_RE);
  const beadsMatch = full.match(BEADS_REF_RE);
  const displayTitle = full.replace(TRAILING_META_RE, "").trim() || full;

  return {
    title: full,
    displayTitle,
    planPath: planMatch ? planMatch[1] : null,
    beadsId: beadsMatch ? beadsMatch[1] : null,
  };
}

export function formatChecklistTitle(rawTitle, { planPath = null, beadsId = null } = {}) {
  const existing = parseChecklistMeta(rawTitle);
  const cleanTitle = existing.displayTitle;
  const nextPlan = planPath !== undefined ? planPath : existing.planPath;
  const nextBeads = beadsId !== undefined ? beadsId : existing.beadsId;

  const metaParts = [];
  if (nextPlan) metaParts.push(`\`${String(nextPlan).trim()}\``);
  if (nextBeads) metaParts.push(`beads: \`${String(nextBeads).trim()}\``);

  return metaParts.length > 0 ? `${cleanTitle} (${metaParts.join(", ")})` : cleanTitle;
}

export function parseChecklist(cwd) {
  const dir = resolveProjectPath(cwd);
  const filePath = path.join(dir, "_AUDIT", "CHECKLIST.md");
  const project = detectProject(dir);
  const maxRecommended = Number(project.limits?.maxChecklistItems || DEFAULT_MAX_CHECKLIST_ITEMS);

  if (!fs.existsSync(filePath)) {
    return {
      exists: false,
      items: [],
      summary: {
        total: 0,
        activeTotal: 0,
        completed: 0,
        skipped: 0,
        pending: 0,
        percent: 0,
        linkedToBeads: 0,
        standards: { active: 0, completed: 0, percent: 100 },
        bigPlans: { total: 0, pending: 0, completed: 0 },
        maxRecommended,
        bloated: false,
        warning: null,
      },
    };
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
      const meta = parseChecklistMeta(itemMatch[2]);
      items.push({
        id: idCounter++,
        group: currentGroup,
        title: meta.title,
        displayTitle: meta.displayTitle,
        state,
        beadsId: meta.beadsId,
        planPath: meta.planPath,
        lineIndex: lineIdx,
      });
    }
  }

  const completed = items.filter((i) => i.state === "complete").length;
  const skipped = items.filter((i) => i.state === "skip").length;
  const activeTotal = items.length - skipped;
  const pending = activeTotal - completed;
  const percent = activeTotal > 0 ? Math.round((completed / activeTotal) * 100) : 100;
  const linkedToBeads = items.filter((i) => Boolean(i.beadsId)).length;
  // Big plans are a human roadmap (pending by nature) — tracked separately so recording a future plan never costs health points
  const isBigPlan = (i) => i.group.toLowerCase() === BIG_PLANS_GROUP.toLowerCase();
  const activePlans = items.filter((i) => isBigPlan(i) && i.state !== "skip");
  const activeStandards = items.filter((i) => !isBigPlan(i) && i.state !== "skip");
  const standardsDone = activeStandards.filter((i) => i.state === "complete").length;
  const plansDone = activePlans.filter((i) => i.state === "complete").length;
  const bloated = activeTotal > maxRecommended;
  const warning = bloated
    ? `Checklist has ${activeTotal} active items (recommended <= ${maxRecommended}). Keep checklists concise for humans (big plans & standards); move granular tasks to Beads (.beads/).`
    : null;

  return {
    exists: true,
    items,
    summary: {
      total: items.length,
      activeTotal,
      completed,
      skipped,
      pending,
      percent,
      linkedToBeads,
      standards: {
        active: activeStandards.length,
        completed: standardsDone,
        percent: activeStandards.length > 0 ? Math.round((standardsDone / activeStandards.length) * 100) : 100,
      },
      bigPlans: { total: activePlans.length, pending: activePlans.length - plansDone, completed: plansDone },
      maxRecommended,
      bloated,
      warning,
    },
  };
}

function findChecklistItem(parsed, target) {
  if (typeof target === "number" || /^\d+$/.test(String(target))) {
    const numId = Number(target);
    return parsed.items.find((i) => i.id === numId) || null;
  }
  const needle = String(target || "").trim().toLowerCase();
  if (!needle) return null;
  return (
    parsed.items.find((i) => i.planPath && i.planPath.toLowerCase() === needle) ||
    parsed.items.find((i) => i.beadsId && i.beadsId.toLowerCase() === needle) ||
    parsed.items.find((i) => i.displayTitle.toLowerCase() === needle) ||
    parsed.items.find((i) => i.title.toLowerCase() === needle) ||
    parsed.items.find((i) => i.displayTitle.toLowerCase().includes(needle) || i.title.toLowerCase().includes(needle)) ||
    null
  );
}

export function setChecklistItem(cwd, { target, state, beadsId = undefined, planPath = undefined }) {
  const dir = resolveProjectPath(cwd);
  assertWritableV3(dir);
  const filePath = path.join(dir, "_AUDIT", "CHECKLIST.md");
  if (!fs.existsSync(filePath)) {
    throw new Error("_AUDIT/CHECKLIST.md does not exist. Run farmwork init first.");
  }

  const validStates = { complete: "x", pending: " ", skip: "-" };
  if (!(state in validStates)) {
    throw new Error(`Invalid state "${state}". Use: complete, pending, or skip.`);
  }

  const parsed = parseChecklist(dir);
  const matched = findChecklistItem(parsed, target);
  if (!matched) {
    throw new Error(`Checklist item not found: "${target}"`);
  }

  const lines = fs.readFileSync(filePath, "utf8").split("\n");
  const nextTitle =
    beadsId !== undefined || planPath !== undefined
      ? formatChecklistTitle(matched.title, { planPath, beadsId })
      : matched.title;
  lines[matched.lineIndex] = `- [${validStates[state]}] ${nextTitle}`;
  fs.writeFileSync(filePath, lines.join("\n"));

  const updated = parseChecklist(dir);
  return {
    item: updated.items.find((i) => i.id === matched.id),
    summary: updated.summary,
  };
}

export function linkChecklistItem(cwd, { target, beadsId = undefined, planPath = undefined }) {
  const dir = resolveProjectPath(cwd);
  assertWritableV3(dir);
  const filePath = path.join(dir, "_AUDIT", "CHECKLIST.md");
  if (!fs.existsSync(filePath)) {
    throw new Error("_AUDIT/CHECKLIST.md does not exist. Run farmwork init first.");
  }
  if (beadsId === undefined && planPath === undefined) {
    throw new Error("Provide `beadsId` and/or `planPath` to link a checklist item.");
  }

  const parsed = parseChecklist(dir);
  const matched = findChecklistItem(parsed, target);
  if (!matched) {
    throw new Error(`Checklist item not found: "${target}"`);
  }

  const stateMark = matched.state === "complete" ? "x" : matched.state === "skip" ? "-" : " ";
  const nextTitle = formatChecklistTitle(matched.title, { planPath, beadsId });
  const lines = fs.readFileSync(filePath, "utf8").split("\n");
  lines[matched.lineIndex] = `- [${stateMark}] ${nextTitle}`;
  fs.writeFileSync(filePath, lines.join("\n"));

  const updated = parseChecklist(dir);
  return {
    item: updated.items.find((i) => i.id === matched.id),
    summary: updated.summary,
  };
}

export function addChecklistItem(
  cwd,
  { group = BIG_PLANS_GROUP, title, beadsId = null, planPath = null } = {},
) {
  const dir = resolveProjectPath(cwd);
  assertWritableV3(dir);
  const filePath = path.join(dir, "_AUDIT", "CHECKLIST.md");
  const cleanTitle = String(title || "").trim();
  if (!cleanTitle) throw new Error("Checklist item title is required.");

  const formatted = formatChecklistTitle(cleanTitle, {
    planPath: planPath || undefined,
    beadsId: beadsId || undefined,
  });

  fs.ensureDirSync(path.join(dir, "_AUDIT"));
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, `# Project Checklist\n\n## ${group}\n- [ ] ${formatted}\n`);
    return parseChecklist(dir);
  }

  // Idempotent update if a matching item already exists (e.g., linking Beads/Plan onto a future plan)
  const existing = parseChecklist(dir);
  const needle = parseChecklistMeta(cleanTitle).displayTitle.toLowerCase();
  const duplicate = existing.items.find(
    (i) =>
      (planPath && i.planPath && i.planPath.toLowerCase() === String(planPath).toLowerCase()) ||
      i.displayTitle.toLowerCase() === needle,
  );
  if (duplicate) {
    if (beadsId || planPath) {
      linkChecklistItem(dir, {
        target: duplicate.id,
        beadsId: beadsId || undefined,
        planPath: planPath || undefined,
      });
    }
    return parseChecklist(dir);
  }

  // Hard cap: checklists stay glanceable for humans. Agents put granular breakdowns in Beads instead.
  if (existing.summary.activeTotal >= existing.summary.maxRecommended) {
    throw new Error(
      `Checklist is at its ${existing.summary.maxRecommended}-item cap. Track granular tasks in Beads (\`farmwork_beads\` action='create'), or complete/skip/remove finished items first (cap: \`limits.maxChecklistItems\` in .farmwork.json).`,
    );
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
    lines.splice(insertIdx, 0, `- [ ] ${formatted}`);
    fs.writeFileSync(filePath, lines.join("\n"));
  } else {
    const suffix = content.endsWith("\n") ? "" : "\n";
    fs.writeFileSync(filePath, `${content}${suffix}\n## ${group}\n- [ ] ${formatted}\n`);
  }

  return parseChecklist(dir);
}

/** When an agent closes a Beads epic linked from the checklist, check off the human big-plan item. */
export function completeChecklistForBeads(cwd, beadsId) {
  const needle = String(beadsId || "").trim().toLowerCase();
  const checklist = parseChecklist(cwd);
  const linked = needle && checklist.items.find((i) => i.beadsId && i.beadsId.toLowerCase() === needle);
  if (!linked || linked.state === "complete") return null;
  return setChecklistItem(cwd, { target: linked.id, state: "complete" }).item;
}
