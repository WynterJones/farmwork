import fs from "fs-extra";
import path from "path";
import { assertWritableV3, daysBetween, resolveProjectPath, slugifyPlan, todayISO } from "./shared.js";
import { BIG_PLANS_GROUP, addChecklistItem, linkChecklistItem, parseChecklist, setChecklistItem } from "./checklist.js";
import { runBeadsAction } from "./tooling.js";

/* ============================================================================
   Idea Garden & Compost
   ============================================================================ */

const IDEA_LIFECYCLE = Object.freeze({
  FRESH: "fresh",
  WILTING: "wilting",
  EXPIRED: "expired",
});

function resolveIdeaLifecycle(ageDays) {
  if (ageDays > 60) return IDEA_LIFECYCLE.EXPIRED;
  if (ageDays >= 45) return IDEA_LIFECYCLE.WILTING;
  return IDEA_LIFECYCLE.FRESH;
}

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
    const lifecycle = resolveIdeaLifecycle(ageDays);

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
      ? "_No ideas planted yet. Use `farmwork_garden` (`action: \"plant\"`) or add an idea below._"
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
    const nextLifecycle = resolveIdeaLifecycle(idea.ageDays);
    if (nextLifecycle === IDEA_LIFECYCLE.EXPIRED) {
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
      if (nextLifecycle === IDEA_LIFECYCLE.WILTING) wilting.push(idea.title);
      kept.push({ ...idea, lifecycle: nextLifecycle });
    }
  }

  writeGarden(dir, { ideas: kept, graduated: garden.graduated, implemented: garden.implemented });
  if (autoComposted.length > 0) {
    writeCompost(dir, compost.items);
  }
  return { active: kept.length, wilting, autoComposted };
}

/* ============================================================================
   Plans (_PLANS/*.md) + Plan -> Human Checklist & Agent Beads Wiring
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
      const epicMatch = content.match(/\*\*Beads Epic:\*\*\s*([^\s]+)/i);
      const status = statusMatch ? statusMatch[1].trim() : "Draft";
      return {
        file,
        slug: file.replace(/\.md$/i, ""),
        path: `_PLANS/${file}`,
        title: titleMatch ? titleMatch[1].trim() : file.replace(/\.md$/i, ""),
        status,
        completed: /^complete(d)?$/i.test(status),
        created: createdMatch ? createdMatch[1] : null,
        beadsEpic: epicMatch ? epicMatch[1].trim() : null,
      };
    });
}

export function createPlan(
  cwd,
  { title, summary = "", approach = "", files = [], steps = [], risks = [], fromIdea = null, addToChecklist = true },
) {
  const dir = resolveProjectPath(cwd);
  assertWritableV3(dir);
  const cleanTitle = String(title || "").trim();
  if (!cleanTitle) throw new Error("Plan title is required.");

  const slug = slugifyPlan(cleanTitle);
  const filename = `${slug}.md`;
  const plansDir = path.join(dir, "_PLANS");
  fs.ensureDirSync(plansDir);
  const planPath = path.join(plansDir, filename);
  const relPlanPath = `_PLANS/${filename}`;
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

  let graduated = false;
  if (fromIdea) {
    const garden = parseGarden(dir);
    const needle = fromIdea.toLowerCase();
    const idx = garden.ideas.findIndex((i) => i.title.toLowerCase() === needle || i.title.toLowerCase().includes(needle));
    if (idx !== -1) {
      const [idea] = garden.ideas.splice(idx, 1);
      garden.graduated.push({ idea: idea.title, plan: relPlanPath, date: today });
      writeGarden(dir, garden);
      graduated = true;
    }
  }

  // Big plans get ONE concise human-facing item in _AUDIT/CHECKLIST.md (granular steps belong in Beads)
  let checklistLinked = false;
  let checklistWarning = null;
  if (addToChecklist !== false && fs.existsSync(path.join(dir, "_AUDIT", "CHECKLIST.md"))) {
    try {
      addChecklistItem(dir, { group: BIG_PLANS_GROUP, title: cleanTitle, planPath: relPlanPath });
      checklistLinked = true;
    } catch (err) {
      checklistWarning = err.message; // cap reached: the plan still exists, the checklist just stays concise
    }
  }

  return { file: filename, path: relPlanPath, slug, graduated, checklistLinked, checklistWarning };
}

function findPlanByRef(dir, slugOrTitle) {
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
  return match;
}

export function completePlan(cwd, slugOrTitle) {
  const dir = resolveProjectPath(cwd);
  assertWritableV3(dir);
  const match = findPlanByRef(dir, slugOrTitle);

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

  // Sync completion to the linked human checklist item if present
  let checklistUpdated = false;
  const checklist = parseChecklist(dir);
  if (checklist.exists) {
    const linked = checklist.items.find(
      (i) =>
        (i.planPath && i.planPath.toLowerCase() === match.path.toLowerCase()) ||
        (match.beadsEpic && i.beadsId && i.beadsId.toLowerCase() === match.beadsEpic.toLowerCase()) ||
        i.displayTitle.toLowerCase() === match.title.toLowerCase(),
    );
    if (linked && linked.state !== "complete") {
      setChecklistItem(dir, { target: linked.id, state: "complete" });
      checklistUpdated = true;
    }
  }

  return { completed: true, plan: match.path, title: match.title, checklistUpdated };
}

export function graduatePlanToBeads(cwd, slugOrTitle) {
  const dir = resolveProjectPath(cwd);
  assertWritableV3(dir);
  const match = findPlanByRef(dir, slugOrTitle);

  if (match.beadsEpic) {
    return {
      graduated: false,
      alreadyGraduated: true,
      plan: match.path,
      epicId: match.beadsEpic,
      tasks: [],
    };
  }

  const fullPath = path.join(dir, match.path);
  let content = fs.readFileSync(fullPath, "utf8");
  const stepsSection = content.match(/## Implementation Steps\s*\n([\s\S]*?)(?=\n## |\n---|$)/i);
  const steps = (stepsSection ? stepsSection[1] : "")
    .split("\n")
    .map((l) => l.trim())
    .map((l) => l.replace(/^(?:\d+\.\s+|-\s+(?:\[[ xX-]\]\s+)?)/, "").trim())
    .filter((l) => l && !/^_.*_$/.test(l));

  const epicRes = runBeadsAction(dir, {
    action: "create",
    title: match.title,
    type: "epic",
    priority: 1,
    description: `Plan: ${match.path}`,
  });
  const epicId = epicRes.issue?.id || null;

  const createdTasks = [];
  for (const step of steps) {
    const taskRes = runBeadsAction(dir, {
      action: "create",
      title: step.slice(0, 140),
      type: "task",
      priority: 2,
      parent: epicId || undefined,
      description: `From plan ${match.path}`,
    });
    if (taskRes.issue) createdTasks.push(taskRes.issue);
  }

  let checklistLinked = false;
  let checklistWarning = null;
  if (epicId) {
    if (/\*\*Status:\*\*/i.test(content)) {
      content = content.replace(/(\*\*Status:\*\*\s*.+)/i, `$1\n**Beads Epic:** ${epicId}`);
    } else {
      content = content.replace(/^(#\s+.+\n)/, `$1\n**Beads Epic:** ${epicId}\n`);
    }
    fs.writeFileSync(fullPath, content);

    // Connect the Beads epic back to the concise human checklist item so a person can follow the big plan -> tasks
    const checklist = parseChecklist(dir);
    if (checklist.exists) {
      const existingItem = checklist.items.find(
        (i) =>
          (i.planPath && i.planPath.toLowerCase() === match.path.toLowerCase()) ||
          i.displayTitle.toLowerCase() === match.title.toLowerCase(),
      );
      if (existingItem) {
        linkChecklistItem(dir, { target: existingItem.id, beadsId: epicId, planPath: match.path });
        checklistLinked = true;
      } else {
        try {
          addChecklistItem(dir, { group: BIG_PLANS_GROUP, title: match.title, planPath: match.path, beadsId: epicId });
          checklistLinked = true;
        } catch (err) {
          checklistWarning = err.message;
        }
      }
    }
  }

  return {
    graduated: true,
    alreadyGraduated: false,
    plan: match.path,
    epicId,
    tasks: createdTasks,
    checklistLinked,
    checklistWarning,
  };
}
