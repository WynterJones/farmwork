import inquirer from "inquirer";
import fs from "fs-extra";
import path from "path";
import { farmTerm, emojis } from "./terminal.js";

/**
 * Auto-detect project configuration from package.json and lockfiles.
 * No questions asked unless something can't be inferred.
 */
function detectProjectConfig(cwd) {
  const pkgPath = path.join(cwd, "package.json");
  let pkg = {};
  let hasPackageJson = false;

  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    hasPackageJson = true;
  } catch {
    pkg = {};
  }

  const scripts = pkg.scripts || {};

  let packageManager = "npm";
  if (fs.existsSync(path.join(cwd, "bun.lockb")) || fs.existsSync(path.join(cwd, "bun.lock"))) {
    packageManager = "bun";
  } else if (fs.existsSync(path.join(cwd, "pnpm-lock.yaml"))) {
    packageManager = "pnpm";
  } else if (fs.existsSync(path.join(cwd, "yarn.lock"))) {
    packageManager = "yarn";
  } else if (fs.existsSync(path.join(cwd, "package-lock.json"))) {
    packageManager = "npm";
  }

  const runScript = (name) => (scripts[name] ? `${packageManager} run ${name}` : null);

  return {
    projectName: pkg.name || path.basename(cwd),
    packageManager,
    testCommand: runScript("test") || runScript("test:run") || `${packageManager} run test`,
    buildCommand: runScript("build") || `${packageManager} run build`,
    lintCommand: runScript("lint") || `${packageManager} run lint`,
    hasPackageJson,
  };
}

export async function init(options) {
  const cwd = process.cwd();

  await farmTerm.logoAnimated();

  const claudeDir = path.join(cwd, ".claude");
  const claudeMd = path.join(cwd, "CLAUDE.md");

  const isAlreadyInstalled = fs.existsSync(claudeDir) && fs.existsSync(claudeMd);

  if (isAlreadyInstalled && !options.force) {
    farmTerm.warn("Farmwork is already installed in this project!");
    farmTerm.nl();
    farmTerm.gray("  Detected:\n");
    farmTerm.gray("    • .claude/ directory\n");
    farmTerm.gray("    • CLAUDE.md\n");
    farmTerm.nl();

    const { continueInit } = await inquirer.prompt([
      {
        type: "list",
        name: "continueInit",
        message: "What would you like to do?",
        choices: [
          { name: "🐴 Re-initialize (will backup existing files)", value: "reinit" },
          { name: "🐮 Run doctor instead (check health)", value: "doctor" },
          { name: "🌾 Run status instead (view metrics)", value: "status" },
          { name: "🐔 Exit", value: "exit" },
        ],
      },
    ]);

    if (continueInit === "exit") {
      farmTerm.info("No changes made. Your farm is safe! 🌾\n");
      return;
    }

    if (continueInit === "doctor") {
      farmTerm.nl();
      const { doctor } = await import("./doctor.js");
      await doctor();
      return;
    }

    if (continueInit === "status") {
      farmTerm.nl();
      const { status } = await import("./status.js");
      await status();
      return;
    }

    options.force = true;
    farmTerm.nl();
  }

  farmTerm.header("FARMWORK INITIALIZATION", "primary");
  farmTerm.info("Let's set up your farm! Detecting your project setup...\n");

  const detected = detectProjectConfig(cwd);

  farmTerm.section("Detected Configuration", emojis.seedling);
  farmTerm.gray(`  Project:         ${detected.projectName}\n`);
  farmTerm.gray(`  Package manager: ${detected.packageManager}\n`);
  farmTerm.gray(`  Test:            ${detected.testCommand}\n`);
  farmTerm.gray(`  Build:           ${detected.buildCommand}\n`);
  farmTerm.gray(`  Lint:            ${detected.lintCommand}\n`);
  farmTerm.nl();

  let answers = { ...detected };

  const isInteractive = Boolean(process.stdin.isTTY) && !options.force;
  if (isInteractive) {
    const { confirmed } = await inquirer.prompt([
      {
        type: "confirm",
        name: "confirmed",
        message: "Look good?",
        default: true,
      },
    ]);

    if (!confirmed) {
      const { projectName } = await inquirer.prompt([
        {
          type: "input",
          name: "projectName",
          message: "🌱 Project name:",
          default: detected.projectName,
        },
      ]);
      answers.projectName = projectName;
    }
  }

  // Check for existing files
  const existingFiles = [];
  const filesToCheck = [
    { path: path.join(cwd, "CLAUDE.md"), name: "CLAUDE.md", backup: "OLD_CLAUDE.md" },
    { path: path.join(cwd, "AGENTS.md"), name: "AGENTS.md", backup: "OLD_AGENTS.md" },
    { path: path.join(cwd, ".claude", "commands"), name: ".claude/commands/", backup: null, isDir: true },
    { path: path.join(cwd, ".claude", "agents"), name: ".claude/agents/", backup: null, isDir: true },
    { path: path.join(cwd, ".claude", "skills"), name: ".claude/skills/", backup: null, isDir: true },
    { path: path.join(cwd, "_AUDIT"), name: "_AUDIT/", backup: null, isDir: true },
  ];

  for (const file of filesToCheck) {
    if (fs.existsSync(file.path)) {
      existingFiles.push(file);
    }
  }

  let didBackupClaudeMd = false;

  if (existingFiles.length > 0 && !options.force) {
    farmTerm.nl();
    farmTerm.warn("The following files/folders already exist:");
    farmTerm.nl();

    for (const file of existingFiles) {
      if (file.isDir) {
        farmTerm.gray(`    ${file.name}`);
        farmTerm.cyan(" (will add new files)\n");
      } else if (file.backup) {
        farmTerm.gray(`    ${file.name}`);
        farmTerm.yellow(` → ${file.backup}\n`);
      } else {
        farmTerm.gray(`    ${file.name}`);
        farmTerm.red(" (will overwrite)\n");
      }
    }
    farmTerm.nl();

    const { overwriteChoice } = await inquirer.prompt([
      {
        type: "list",
        name: "overwriteChoice",
        message: "How would you like to proceed?",
        choices: [
          { name: "🌱 Continue (backup files, add to existing folders)", value: "overwrite" },
          { name: "🐔 Cancel installation", value: "cancel" },
        ],
      },
    ]);

    if (overwriteChoice === "cancel") {
      farmTerm.nl();
      farmTerm.gray("  Installation cancelled.\n\n");
      process.exit(0);
    }

    farmTerm.nl();
    for (const file of existingFiles) {
      if (file.backup) {
        const backupPath = path.join(cwd, file.backup);
        await fs.copy(file.path, backupPath);
        farmTerm.status(`Backed up ${file.name} → ${file.backup}`, "pass");
        if (file.name === "CLAUDE.md") {
          didBackupClaudeMd = true;
        }
      }
    }
  }

  answers._didBackupClaudeMd = didBackupClaudeMd;

  farmTerm.nl();
  farmTerm.section("Planting Your Farm", emojis.seedling);

  try {
    const steps = [
      {
        name: "Creating directories",
        fn: async () => {
          await fs.ensureDir(path.join(cwd, "_AUDIT"));
          await fs.ensureDir(path.join(cwd, "_PLANS"));
          await fs.ensureDir(path.join(cwd, ".claude", "commands"));
          await fs.ensureDir(path.join(cwd, ".claude", "agents"));
          await fs.ensureDir(path.join(cwd, ".claude", "skills"));
        },
      },
      { name: "Planting CLAUDE.md", fn: () => createClaudeMd(cwd, answers) },
      { name: "Growing AGENTS.md", fn: () => createAgentsMd(cwd, answers) },
      { name: "Building FARMHOUSE.md", fn: () => createFarmhouseMd(cwd, answers) },
      { name: "Creating the Idea Garden", fn: () => createGardenDocs(cwd, answers) },
      { name: "Training agents", fn: () => createAgents(cwd, answers) },
      { name: "Cultivating skills", fn: () => createSkills(cwd, answers) },
      { name: "Setting up commands", fn: () => createCommands(cwd, answers) },
    ];

    for (const step of steps) {
      await farmTerm.spin(step.name, step.fn);
    }

    farmTerm.nl();
    farmTerm.divider("═", 50);
    farmTerm.success("Farmwork initialized successfully!");

    farmTerm.section("Created Structure", emojis.corn);
    await farmTerm.planting(
      [
        "_AUDIT/",
        "_PLANS/",
        ".claude/skills/",
        ".claude/agents/",
        ".claude/commands/",
        "CLAUDE.md",
        "AGENTS.md",
      ],
      "Files planted",
    );

    farmTerm.section("Next Steps", emojis.carrot);
    farmTerm.nl();
    farmTerm.white("  1. ");
    farmTerm.yellow('"open the farm"');
    farmTerm.gray(" → Quick audit of your setup\n");
    farmTerm.white("  2. ");
    farmTerm.yellow('"I have an idea for..."');
    farmTerm.gray(" → Plant an idea in the Garden\n");
    farmTerm.white("  3. ");
    farmTerm.yellow("/push");
    farmTerm.gray(" → Clean, review, test, build, commit & push\n");

    farmTerm.nl();
    farmTerm.section("Get Claude Comfortable", emojis.wheat);
    farmTerm.gray("  Copy and paste this prompt to Claude Code:\n\n");

    farmTerm.box(
      "Prompt for Claude",
      [
        "Hey Claude, I am using the Farmwork framework.",
        "Please look at CLAUDE.md and my app, then",
        "suggest any project-specific agents or slash",
        "commands that would work well here.",
      ],
      "secondary",
    );

    if (answers._didBackupClaudeMd) {
      farmTerm.nl();
      farmTerm.section("Merge Your Old Instructions", "🥬");
      farmTerm.gray("  Your old CLAUDE.md was backed up. Use this prompt to merge:\n\n");

      farmTerm.box(
        "Merge Prompt",
        [
          "Hey Claude, look at my CLAUDE.md file and",
          "merge the project-specific instructions from",
          "OLD_CLAUDE.md into it, so I have one file",
          "with all the Farmwork instructions plus my",
          "original project setup. Then delete the OLD",
          "file when done.",
        ],
        "accent",
      );
    }

    farmTerm.nl();
    await farmTerm.tractorAnimation("Your farm is ready!", 1500);
    farmTerm.nl();
  } catch (error) {
    farmTerm.error("Failed to initialize Farmwork");
    console.error(error);
    process.exit(1);
  }
}

async function createClaudeMd(cwd, answers) {
  const content = `# ${answers.projectName}

## Farmwork

This project uses the Farmwork workflow: lightweight skills and agents that keep
docs current, ideas tracked, and code clean without heavy process.

---

## Skills (Auto-Activate on Phrases)

Skills auto-activate when you use these phrases. Workflow details are in \`.claude/skills/\`.

| Phrase | Skill | What Happens |
|--------|-------|--------------|
| **open the farm** | farm-audit | Quick audit: update FARMHOUSE.md metrics |
| **count the herd** | farm-audit | Deep audit: quick audit + full inspection pass (no code changes) |
| **I have an idea for...** | garden | Plant idea in GARDEN.md |
| **water the garden** | garden | Generate 10 new ideas |
| **compost this...** | garden | Move idea to COMPOST.md |
| **let's plan this idea...** | garden | Graduate idea → create a plan in \`_PLANS/\` |

---

## Slash Commands (Explicit)

| Command | What It Does |
|---------|---------------|
| \`/push\` | Clean, review, test, build, commit, push, update metrics |

---

## Plan Mode Protocol

For any non-trivial feature:

1. **Save the plan**: Write to \`_PLANS/<FEATURE_NAME>.md\` (SCREAMING_SNAKE_CASE)
2. **Confirm**: Ask "Ready to start implementing?" and wait for explicit yes before writing code

---

## Project Configuration

- **Test:** \`${answers.testCommand}\`
- **Build:** \`${answers.buildCommand}\`
- **Lint:** \`${answers.lintCommand}\`

---

## Directory Structure

| Directory | Purpose |
|-----------|---------|
| \`_AUDIT/\` | Living audit + idea documents (FARMHOUSE, GARDEN, COMPOST) |
| \`_PLANS/\` | Feature implementation plans |
| \`.claude/skills/\` | Auto-activating workflows |
| \`.claude/agents/\` | Specialized subagents |
| \`.claude/commands/\` | Explicit slash commands |
`;

  await fs.writeFile(path.join(cwd, "CLAUDE.md"), content);
}

async function createAgentsMd(cwd, answers) {
  const content = `# ${answers.projectName}

## Farmwork (Generic AI Assistant Instructions)

This project uses the Farmwork workflow. \`AGENTS.md\` is for AI coding assistants that
don't support Claude Code's native skills/subagents (Codex, Gemini CLI, and similar
tools) - it documents the same workflow as \`CLAUDE.md\`, written as plain instructions
you follow directly instead of auto-activating skills.

If you're Claude Code, use \`CLAUDE.md\` instead - it references \`.claude/skills/\`
for these same workflows.

---

## Phrase-Triggered Workflows

When the user uses one of these phrases, follow the matching steps yourself - there
are no skills or subagents to invoke here, so do the work directly.

### "open the farm" - Quick Audit
1. Count commands, agents, skills, tests, and plans:
   - Commands: \`ls -1 .claude/commands/*.md 2>/dev/null | wc -l\`
   - Agents: \`ls -1 .claude/agents/*.md 2>/dev/null | wc -l\`
   - Skills: \`ls -d .claude/skills/*/ 2>/dev/null | wc -l\`
   - Tests: \`find . -name "*.test.*" -not -path "./node_modules/*" | wc -l\`
   - Plans: \`ls -1 _PLANS/*.md 2>/dev/null | wc -l\` (total + completed)
2. Read \`_AUDIT/GARDEN.md\` and check each idea's \`**Planted:**\` date:
   - 45-60 days old: mark \`⚠️ WILTING\`
   - 60+ days old: move the idea to \`_AUDIT/COMPOST.md\` and remove it from GARDEN.md
3. Update \`_AUDIT/FARMHOUSE.md\` with fresh metrics, a score, and an audit history entry

### "count the herd" - Deep Audit
Everything in "open the farm", plus:
4. Review the codebase yourself for quality, security, performance, code smells, and
   basic accessibility. Report findings inline (severity + suggested fix) - don't
   create new audit files for this.
5. Run lint/test/build as a dry run only (no commits, no pushes) and report status

### Idea Garden Phrases
| Phrase | Action |
|--------|--------|
| "I have an idea for..." | Add a new entry to \`_AUDIT/GARDEN.md\` with today's \`**Planted:**\` date |
| "water the garden" | Read GARDEN.md + COMPOST.md, propose 10 new ideas, plant the ones the user picks |
| "compost this..." | Move the idea to \`_AUDIT/COMPOST.md\` with a reason, remove it from GARDEN.md |
| "let's plan this idea..." | Write a plan to \`_PLANS/\`, move the idea into GARDEN.md's "Graduated to Plans" table |

---

## Plan-First Development

For any non-trivial feature, before writing code:
1. Write the plan to \`_PLANS/<FEATURE_NAME>.md\` (SCREAMING_SNAKE_CASE filename)
2. Ask "Ready to start implementing?" and wait for an explicit yes before coding

---

## Shipping Changes

There's no \`/push\` slash command outside Claude Code, so do this manually when asked
to ship:
1. Remove \`.DS_Store\` files, then stage changes (\`git add -A\`)
2. Clean up obvious dead code/console.logs/comments (keep JSDoc and lint/ts directives)
3. Run lint, test, and build - stop if any fail
4. Commit with a descriptive message, then push
5. Update \`_AUDIT/FARMHOUSE.md\` metrics

---

## Project Configuration

- **Test:** \`${answers.testCommand}\`
- **Build:** \`${answers.buildCommand}\`
- **Lint:** \`${answers.lintCommand}\`

---

## Directory Structure

| Directory | Purpose |
|-----------|---------|
| \`_AUDIT/\` | Living audit + idea documents (FARMHOUSE, GARDEN, COMPOST) |
| \`_PLANS/\` | Feature implementation plans |
| \`.claude/\` | Claude Code configuration (skills/agents/commands) - not used by other tools |
`;

  await fs.writeFile(path.join(cwd, "AGENTS.md"), content);
}

async function createFarmhouseMd(cwd, answers) {
  const today = new Date().toISOString().split("T")[0];

  const content = `# Farmwork Farmhouse

> Central command for the Farmwork agentic harness.
> Updated automatically by \`the-farmer\` agent during \`/push\` or via "open the farm" / "count the herd".

**Last Updated:** ${today}
**Score:** 5.0/10
**Status:** Initial setup

---

## Quick Metrics

| Metric | Count |
|--------|-------|
| Commands | 1 |
| Agents | 4 |
| Skills | 2 |
| Unit Tests | 0 |
| Total Plans | 0 |
| Completed Plans | 0 |

---

## How to get 10/10

All commands, agents, and skills are documented and working, phrase triggers are
tested, \`_PLANS/\` reflects real implementation history, and CLAUDE.md is complete and accurate.

---

## Commands (\`.claude/commands/\`)

| Command | Description |
|---------|-------------|
| \`/push\` | Clean, review, test, build, commit, push, update metrics |

---

## Agents (\`.claude/agents/\`)

| Agent | Purpose |
|-------|---------|
| \`the-farmer\` | Audit and update FARMHOUSE.md metrics |
| \`code-reviewer\` | Quality, security, performance, code smells, accessibility |
| \`code-cleaner\` | Remove comments, console.logs, and obvious dead code |
| \`idea-gardener\` | Manage the Idea Garden and Compost |

---

## Skills (\`.claude/skills/\`)

| Skill | Triggers |
|-------|----------|
| \`farm-audit\` | "open the farm" (quick), "count the herd" (deep) |
| \`garden\` | "I have an idea for...", "water the garden", "compost this...", "let's plan this idea..." |

---

## Audit History

| Date | Changes |
|------|---------|
| ${today} | Initial FARMHOUSE setup via Farmwork CLI |
`;

  await fs.writeFile(path.join(cwd, "_AUDIT", "FARMHOUSE.md"), content);
}

async function createGardenDocs(cwd, answers) {
  const today = new Date().toISOString().split("T")[0];

  const gardenContent = `# Idea Garden

> Nursery for new ideas and concepts. The pre-plan creative thinking stage.
> Ideas older than 60 days without action will naturally compost during "open the farm".

**Last Updated:** ${today}
**Active Ideas:** 0
**Wilting Ideas:** 0

---

## How to Use

| Phrase | Action |
|--------|--------|
| \`I have an idea for...\` | Plant a new idea here |
| \`let's plan this idea...\` | Graduate idea to _PLANS/ |
| \`compost this...\` | Reject idea, move to COMPOST |

---

## Idea Lifecycle

Ideas have a natural lifecycle:
- **Fresh** (0-44 days) - New ideas, ready to be developed
- **Wilting** (45-60 days) - Ideas aging without action, marked with ⚠️
- **Composted** (60+ days) - Auto-moved to COMPOST during "open the farm"

---

## Ideas

_No ideas planted yet. Start with "I have an idea for..."_

<!-- Idea format:
### [Idea Title]
**Planted:** YYYY-MM-DD
[Short description]
- Bullet point 1
- Bullet point 2
-->

---

## Graduated to Plans

| Idea | Plan | Date |
|------|------|------|

---

## Implemented

| Idea | Plan | Completed |
|------|------|-----------|
`;

  await fs.writeFile(path.join(cwd, "_AUDIT", "GARDEN.md"), gardenContent);

  const compostContent = `# Idea Compost

> Archive of rejected ideas. Reference to avoid re-proposing and remember why we didn't pursue something.
> Ideas that age 60+ days in the Garden are automatically composted during "open the farm".

**Last Updated:** ${today}
**Composted Ideas:** 0
**Auto-Composted:** 0

---

## How to Use

| Phrase | Action |
|--------|--------|
| \`compost this...\` | Move idea from GARDEN here (or reject a new one directly) |

---

## Composted Ideas

_No composted ideas yet._

<!-- Composted idea format:
### [Idea Title]
**Composted:** YYYY-MM-DD
**Reason:** [User's reason OR "Auto-composted: aged 60+ days without action"]
[Original description if available]
-->
`;

  await fs.writeFile(path.join(cwd, "_AUDIT", "COMPOST.md"), compostContent);
}

async function createAgents(cwd, answers) {
  const agents = {
    "the-farmer.md": `---
name: the-farmer
description: Audit and update FARMHOUSE.md with current project metrics
tools: Read, Grep, Glob, Edit, Bash
model: opus
---

# The Farmer Agent

Maintains \`_AUDIT/FARMHOUSE.md\` - the living document tracking all systems and health.

## Instructions

### Step 1: Gather Metrics
1. Count commands: \`ls -1 .claude/commands/*.md 2>/dev/null | wc -l\`
2. Count agents: \`ls -1 .claude/agents/*.md 2>/dev/null | wc -l\`
3. Count skills: \`ls -d .claude/skills/*/ 2>/dev/null | wc -l\`
4. Count unit tests: \`find . -name "*.test.*" -not -path "./node_modules/*" | wc -l\`
5. Count total plans: \`ls -1 _PLANS/*.md 2>/dev/null | wc -l\`
6. Count completed plans: search \`_PLANS/*.md\` for a \`**Status:** Complete\` marker

### Step 2: Tend the Idea Garden
Read \`_AUDIT/GARDEN.md\` and check the age of each idea:

1. Parse each idea's \`**Planted:**\` date
2. Calculate age: today - planted date (in days)
3. For ideas **45-60 days old** (Wilting):
   - Add \`⚠️ WILTING\` after the idea title
   - Report these ideas in the audit summary
4. For ideas **over 60 days old** (Composted):
   - Move to \`_AUDIT/COMPOST.md\` with format:
     \`\`\`markdown
     ### [Idea Title]
     **Composted:** YYYY-MM-DD
     **Reason:** Auto-composted: aged 60+ days without action
     [Original description]
     \`\`\`
   - Remove from GARDEN.md
   - Update counts in both files
5. Update GARDEN.md header:
   - **Active Ideas:** (count of non-wilting ideas)
   - **Wilting Ideas:** (count of 45-60 day old ideas)
   - **Last Updated:** today's date

### Step 3: Update FARMHOUSE.md
1. Update the metrics table
2. Update the score based on completeness
3. Add an audit history entry

## Output Format

\`\`\`
## Farmhouse Audit Complete

### Metrics Updated
- Commands: X
- Agents: X
- Skills: X
- Unit Tests: X
- Total Plans: X
- Completed Plans: X

### Idea Garden
- Active Ideas: X
- Wilting Ideas: X (list titles if any)
- Auto-Composted: X (list titles if any)

### Score: X/10
\`\`\`
`,
    "code-reviewer.md": `---
name: code-reviewer
description: Comprehensive code review covering quality, security, performance, code smells, and basic accessibility. Reports findings inline with severity - does not maintain separate audit documents.
tools: Read, Grep, Glob, Bash
model: opus
---

# Code Reviewer Agent

A single comprehensive reviewer. Report every finding inline in your response with a
severity (**CRITICAL**, **HIGH**, **MEDIUM**, **LOW**) and a suggested fix. Do **not**
create or update separate audit documents per concern - this agent reports, it doesn't archive.

## Quality
- Readability and maintainability
- Best-practice violations
- Error handling patterns
- API design issues

## Security (OWASP-lite)
- XSS (\`dangerouslySetInnerHTML\`, unescaped/unsanitized input)
- Injection risks (SQL, command, template)
- Auth/authz gaps, sensitive data exposure
- Hardcoded secrets, insecure defaults

## Performance
- Memory leaks (missing cleanup/unsubscribe)
- Unnecessary re-renders
- Expensive work in render/hot paths
- Framework-specific anti-patterns

## Code Smells
- DRY violations (duplicated code)
- Complexity (long functions, deep nesting)
- Naming issues, magic values
- Technical debt markers (TODO, FIXME, HACK)

## Accessibility (basic)
- Missing or inadequate alt text on images
- Obvious color contrast issues
- Keyboard navigation gaps
- Missing ARIA labels/roles, unlabeled form fields

## Output Format

\`\`\`
## Code Review: [scope]

### Critical
- [file:line] Issue — Fix

### High
- [file:line] Issue — Fix

### Medium
- [file:line] Issue — Fix

### Low
- [file:line] Issue — Fix

### Summary
Overall assessment and recommended next steps.
\`\`\`
`,
    "code-cleaner.md": `---
name: code-cleaner
description: Remove comments (except JSDoc), console.logs, and obvious dead code before pushing
tools: Read, Write, Edit, Bash, Grep, Glob
model: opus
---

# Code Cleaner Agent

Purely cosmetic cleanup for TypeScript/JavaScript files. Never changes behavior.

## Removes
- Line comments (\`//\`) and block comments (\`/* */\`)
- \`console.log\` statements
- Unused imports and obviously dead/unreachable code (simple, unambiguous cases only)

## Preserves
- JSDoc comments (\`/** */\`)
- ESLint directive comments (\`// eslint-disable\`, \`// eslint-disable-next-line\`, etc.)
- TypeScript directive comments (\`// @ts-ignore\`, \`// @ts-expect-error\`, \`// @ts-nocheck\`)
- \`console.error\`, \`console.warn\`, \`console.info\`

Use before \`/push\`, after refactoring, or whenever asked to tidy up a file. If a piece
of "dead" code looks like it might be used dynamically (string-based imports, reflection,
etc.), leave it and flag it instead of removing it.
`,
    "idea-gardener.md": `---
name: idea-gardener
description: Manage the Idea Garden and Compost - add, graduate, reject, or generate ideas
tools: Read, Edit, Glob, Grep
model: opus
---

# Idea Gardener Agent

Manages \`_AUDIT/GARDEN.md\` and \`_AUDIT/COMPOST.md\` for idea lifecycle tracking.

## Commands

### Plant an Idea (from "I have an idea for...")
1. Parse the idea title from user input
2. Ask user for short description and key bullet points
3. Add to GARDEN.md under ## Ideas section with format:
   \`\`\`markdown
   ### [Idea Title]
   **Planted:** YYYY-MM-DD
   [Short description]
   - Bullet point 1
   - Bullet point 2
   \`\`\`
4. Update the "Active Ideas" count in the header
5. Update "Last Updated" date

**IMPORTANT:** Always include the **Planted:** date using today's date (YYYY-MM-DD format).

### Graduate an Idea (from "let's plan this idea...")
1. Find idea in GARDEN.md
2. Create plan file in _PLANS/ using plan mode
3. Move idea to "Graduated to Plans" table with date and plan link
4. Remove from ## Ideas section
5. Update "Active Ideas" count

### Compost an Idea (from "compost this...")
1. Find idea in GARDEN.md (or accept new rejection)
2. Ask for rejection reason
3. Add to COMPOST.md with format:
   \`\`\`markdown
   ### [Idea Title]
   **Composted:** YYYY-MM-DD
   **Reason:** [User's reason]
   [Original description if available]
   \`\`\`
4. Remove from GARDEN.md if it was there
5. Update counts in both files

### Water the Garden (from "water the garden")
Generate fresh ideas based on the project context:

1. **Read Context:**
   - Read \`_AUDIT/GARDEN.md\` - understand existing ideas, themes, what's being explored
   - Read \`_AUDIT/COMPOST.md\` - understand what was rejected and why (avoid these patterns)
   - Read \`CLAUDE.md\` - understand the project's purpose and configuration

2. **Generate 10 Ideas:**
   Think creatively about ideas that:
   - Extend or complement existing garden ideas
   - Fill gaps in current thinking
   - Avoid patterns that led to rejected/composted ideas
   - Align with the project's goals and tech stack
   - Range from small enhancements to ambitious features

3. **Present Ideas:**
   Display as a numbered list:
   \`\`\`
   ## Fresh Ideas for Your Garden

   1. **[Idea Title]** - One-line description
   2. **[Idea Title]** - One-line description
   ... (10 total)

   Which ideas would you like to plant? (enter numbers, e.g., 1, 3, 5)
   \`\`\`

4. **Plant Selected Ideas:**
   For each selected number, add to GARDEN.md with:
   - Title from the list
   - Today's date as **Planted:** date
   - The one-line description expanded slightly
   - 2-3 bullet points about potential implementation

## Output Format
Confirm action taken and show updated file section.
`,
  };

  for (const [filename, content] of Object.entries(agents)) {
    await fs.writeFile(path.join(cwd, ".claude", "agents", filename), content);
  }
}

async function createSkills(cwd, answers) {
  const skills = {
    "farm-audit": {
      "SKILL.md": `---
name: farm-audit
description: Audit Farmwork systems and update FARMHOUSE.md. Use when user says "open the farm" (quick metrics audit) or "count the herd" (deep audit - quick audit plus a full code inspection, no changes/dry-run). Also matches "audit systems", "check farm status", "full inspection", "quality check", or asks about the current state of the project.
allowed-tools: Bash(*), Task, Read, Edit, Glob, Grep
---

# Farm Audit Skill

One skill, two modes. Both update \`_AUDIT/FARMHOUSE.md\` with current metrics; the deep
mode additionally runs a full code inspection.

## Quick Mode ("open the farm")

### Step 1: Launch the-farmer Agent
Spawn the \`the-farmer\` agent to gather all metrics.

### Step 2: Gather Metrics
1. Count commands: \`ls -1 .claude/commands/*.md 2>/dev/null | wc -l\`
2. Count agents: \`ls -1 .claude/agents/*.md 2>/dev/null | wc -l\`
3. Count skills: \`ls -d .claude/skills/*/ 2>/dev/null | wc -l\`
4. Count tests: \`find . -name "*.test.*" -not -path "./node_modules/*" | wc -l\`
5. Count total/completed plans in \`_PLANS/\`

### Step 3: Tend the Idea Garden
Read \`_AUDIT/GARDEN.md\` and check idea ages:
- **Fresh** (0-44 days): No action needed
- **Wilting** (45-60 days): Mark with ⚠️ in output
- **Composted** (60+ days): Move to \`_AUDIT/COMPOST.md\`

### Step 4: Update FARMHOUSE.md
Update with current date, all metrics, score, and an audit history entry.

## Deep Mode ("count the herd")

Runs everything in Quick Mode, then:

### Step 5: Full Code Inspection (dry run, no changes)
Launch the \`code-reviewer\` agent for a comprehensive pass: quality, security,
performance, code smells, and basic accessibility. Findings are reported inline
in this session's response - nothing is written to persistent audit docs.

### Step 6: Dry-Run Quality Gates
Run the project's lint, test, and build commands (from CLAUDE.md's Project
Configuration) to report status. Do **not** commit, push, or modify files based
on this run.

### Step 7: Consolidated Summary
Combine the FARMHOUSE metrics, code-reviewer findings, and quality gate results
into one report, grouped by severity, with recommended next steps.

## Output Format
\`\`\`
## Farm Audit Complete (Quick | Deep)

### Metrics
- Commands: X
- Agents: X
- Skills: X
- Tests: X files
- Plans: X total, X completed

### Idea Garden
- Active: X ideas
- Wilting: X ideas (list if any)
- Auto-composted: X ideas

### Code Inspection (deep mode only)
- Critical: X
- High: X
- Medium: X
- Low: X

### Quality Gates (deep mode only)
- Lint: ✓/✗
- Tests: ✓/✗
- Build: ✓/✗

### Score: X/10
\`\`\`

## Important
Deep mode never pushes changes. Use \`/push\` when ready to commit and push.
`,
      "checklist.md": `# Farm Audit Checklist

## Quick Mode ("open the farm")
- [ ] Commands, agents, skills counted
- [ ] Test file count updated
- [ ] Plans counted (total + completed)
- [ ] Idea garden tended (wilting/composted)
- [ ] FARMHOUSE.md updated with score + history entry

## Deep Mode ("count the herd") - adds:
- [ ] code-reviewer run across the codebase
- [ ] Lint/test/build run as a dry run (no commit/push)
- [ ] Consolidated summary report generated
`,
    },

    "garden": {
      "SKILL.md": `---
name: garden
description: Manage the Idea Garden - plant new ideas, water the garden for fresh ideas, compost rejected ones, or graduate an idea into a plan. Use when user says "I have an idea", "new idea", "water the garden", "generate ideas", "compost this", "reject idea", "let's plan this idea", or wants to manage project ideas.
allowed-tools: Read, Edit, Glob, Grep, Task
---

# Idea Garden Skill

Manages \`_AUDIT/GARDEN.md\` and \`_AUDIT/COMPOST.md\` for idea lifecycle tracking.

## Actions

### Plant an Idea
**Triggers:** "I have an idea for...", "new idea", "add idea"

1. Parse idea title from user input
2. Ask for:
   - Short description (1-2 sentences)
   - Key bullet points (2-4 items)
3. Add to \`_AUDIT/GARDEN.md\` under ## Ideas:
   \`\`\`markdown
   ### [Idea Title]
   **Planted:** YYYY-MM-DD
   [Short description]
   - Bullet point 1
   - Bullet point 2
   \`\`\`
4. Update "Active Ideas" count in header
5. Update "Last Updated" date

### Water the Garden
**Triggers:** "water the garden", "generate ideas", "brainstorm"

1. Read \`_AUDIT/GARDEN.md\` to understand existing ideas
2. Read \`_AUDIT/COMPOST.md\` to understand rejected patterns
3. Generate 10 new ideas that:
   - Extend or complement existing ideas
   - Avoid patterns that led to rejection
   - Align with project goals
4. Present as numbered list:
   \`\`\`
   ## Fresh Ideas
   1. **[Title]** - One-line description
   2. **[Title]** - One-line description
   ...

   Which ideas would you like to plant? (e.g., 1, 3, 5)
   \`\`\`
5. Plant selected ideas with today's date

### Compost an Idea
**Triggers:** "compost this", "reject idea", "don't want this idea", "remove this"

1. Find idea in GARDEN.md (or accept direct rejection)
2. Ask for rejection reason
3. Add to \`_AUDIT/COMPOST.md\`:
   \`\`\`markdown
   ### [Idea Title]
   **Composted:** YYYY-MM-DD
   **Reason:** [User's reason]
   [Original description if available]
   \`\`\`
4. Remove from GARDEN.md if present
5. Update counts in both files

### Graduate an Idea to Plan
**Triggers:** "let's plan this idea", "graduate idea"

1. Find idea in GARDEN.md
2. Enter Plan Mode to create a plan file in \`_PLANS/\`
3. Move idea to "Graduated to Plans" table
4. Remove from ## Ideas section

## Idea Lifecycle
- **Fresh** (0-44 days): Ready for development
- **Wilting** (45-60 days): Needs attention, marked ⚠️
- **Composted** (60+ days): Auto-moved during farm audit
`,
      "idea-templates.md": `# Idea Templates

## New Idea Format
\`\`\`markdown
### [Idea Title]
**Planted:** YYYY-MM-DD
[1-2 sentence description of the idea]
- Key aspect or requirement 1
- Key aspect or requirement 2
- Potential challenge or consideration
\`\`\`

## Composted Idea Format
\`\`\`markdown
### [Idea Title]
**Composted:** YYYY-MM-DD
**Reason:** [Why this was rejected]
[Original description]
\`\`\`

## Graduated Idea Table Row
\`\`\`markdown
| [Idea Title] | [PLAN_NAME.md](../_PLANS/PLAN_NAME.md) | YYYY-MM-DD |
\`\`\`
`,
    },
  };

  for (const [skillName, files] of Object.entries(skills)) {
    const skillDir = path.join(cwd, ".claude", "skills", skillName);
    await fs.ensureDir(skillDir);

    for (const [filename, content] of Object.entries(files)) {
      await fs.writeFile(path.join(skillDir, filename), content);
    }
  }
}

async function createCommands(cwd, answers) {
  const pm = answers.packageManager || "npm";

  const pushCommand = `---
description: Clean up, review, run quality gates, commit, push, and update metrics
argument-hint: [optional: commit message override]
allowed-tools: Bash(find:*), Bash(git:*), Bash(${pm}:*), Bash(npx:*), Task
---

# Push Command

Simplified end-to-end push: clean up, review, gate, commit, push, update metrics.

## Workflow

Execute these steps in order. **Stop immediately if any step fails.**

### Step 1: Clean Up System Files
Remove any \`.DS_Store\` files from the repository:
\`\`\`bash
find . -name '.DS_Store' -type f -delete
\`\`\`

### Step 2: Stage Changes
\`\`\`bash
git add -A
\`\`\`
Run \`git status\` to confirm there are staged changes. If nothing to commit, inform the
user and stop here.

### Step 3: Run code-cleaner Agent
Run the \`code-cleaner\` agent on staged files to remove comments and console.logs
(preserving JSDoc, eslint/ts directives, and \`console.error/warn/info\`). Re-stage
any files it modifies:
\`\`\`bash
git add -A
\`\`\`

### Step 4: Run Quality Gates

Read package.json to check which scripts exist, and run each one that does:

1. **Lint** (if a lint script exists): \`${answers.lintCommand}\`
2. **Tests** (if a test script exists): \`${answers.testCommand}\`
3. **Build** (if a build script exists): \`${answers.buildCommand}\`

For any script that doesn't exist, output in gray text "(skipped - no X script)".
If any existing check fails, stop and report which check failed.

### Step 5: Generate Commit Message

If \`$ARGUMENTS\` is provided, use it as the commit message. Otherwise:
1. Run \`git diff --cached --stat\` and \`git diff --cached\` to see the changes
2. Run \`git log -5 --oneline\` to match the repository's commit style
3. Generate a concise, descriptive commit message (type prefix, 1-2 sentences, "why" not "what")

### Step 6: Commit and Push

Create the commit with the message, including the standard footer:
\`\`\`
🌽 Generated with FARMWORK
\`\`\`
Then push to remote:
\`\`\`bash
git push
\`\`\`

### Step 7: Update Farmhouse Metrics

Run the \`the-farmer\` agent to update \`_AUDIT/FARMHOUSE.md\` with current metrics
(commands, agents, skills, tests, plans).

### Step 8: Report Success

Show a summary: files changed, commit hash, push status, and confirmation that
FARMHOUSE.md metrics were refreshed.
`;

  await fs.writeFile(path.join(cwd, ".claude", "commands", "push.md"), pushCommand);
}
