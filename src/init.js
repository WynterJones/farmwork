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

  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
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
        },
      },
      { name: "Planting CLAUDE.md", fn: () => createClaudeMd(cwd, answers) },
      { name: "Growing AGENTS.md", fn: () => createAgentsMd(cwd, answers) },
      { name: "Building FARMHOUSE.md", fn: () => createFarmhouseMd(cwd) },
      { name: "Creating the Idea Garden", fn: () => createGardenDocs(cwd) },
      { name: "Training agents", fn: () => createAgents(cwd) },
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
        ".claude/agents/",
        ".claude/commands/",
        "CLAUDE.md",
        "AGENTS.md",
      ],
      "Files planted",
    );

    farmTerm.section("Your Commands", emojis.carrot);
    farmTerm.gray("  Type / in Claude Code to see them all.\n\n");
    farmTerm.commands([
      { name: "/audit", description: "Refresh metrics, tend the Idea Garden" },
      { name: "/inspect", description: "Audit + code review + dry-run gates" },
      { name: "/add-idea", description: "Plant an idea in the Garden" },
      { name: "/new-ideas", description: "Generate 10 ideas, plant the keepers" },
      { name: "/compost", description: "Retire an idea, with a reason" },
      { name: "/plan-idea", description: "Graduate an idea into _PLANS/" },
      { name: "/push", description: "Clean, gate, commit, push, update metrics" },
    ]);

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

This project uses the Farmwork workflow: a small set of slash commands and agents
that keep docs current, ideas tracked, and code clean without heavy process.

---

## Slash Commands

Everything Farmwork does is an explicit slash command. Type \`/\` to see them all.
Each does exactly one thing - there are no hidden trigger phrases.

| Command | What It Does |
|---------|--------------|
| \`/audit\` | Refresh FARMHOUSE.md metrics and tend the Idea Garden |
| \`/inspect\` | Everything in \`/audit\`, plus a full code review and dry-run quality gates |
| \`/add-idea\` | Plant a new idea in GARDEN.md |
| \`/new-ideas\` | Generate 10 fresh ideas and plant the ones you pick |
| \`/compost\` | Retire an idea to COMPOST.md with a reason |
| \`/plan-idea\` | Graduate an idea into a plan in \`_PLANS/\` |
| \`/push\` | Clean, review, test, build, commit, push, update metrics |

\`/inspect\` and \`/audit\` never commit anything. Use \`/push\` to ship.

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
| \`.claude/commands/\` | Slash commands |
| \`.claude/agents/\` | Specialized subagents the commands invoke |
`;

  await fs.writeFile(path.join(cwd, "CLAUDE.md"), content);
}

async function createAgentsMd(cwd, answers) {
  const content = `# ${answers.projectName}

## Farmwork (Generic AI Assistant Instructions)

This project uses the Farmwork workflow. \`AGENTS.md\` is for AI coding assistants that
don't read \`.claude/\` (Gemini CLI and similar) - it points you at the same command
definitions rather than restating them.

If you're Claude Code, use \`CLAUDE.md\`. If you're Codex, copy the command files into
\`~/.codex/prompts/\` and invoke them as slash commands.

---

## The Commands Are the Source of Truth

Every Farmwork workflow is a single markdown file in \`.claude/commands/\`. Each one is
plain instructions - **read the file and follow it directly**. Nothing in there depends
on Claude-specific features except the \`Task\` tool, and where a command says to launch
an agent, read that agent's file in \`.claude/agents/\` and do the work yourself instead.

| The user asks for | Read and follow |
|-------------------|-----------------|
| an audit / project health | \`.claude/commands/audit.md\` |
| a deep inspection or code review | \`.claude/commands/inspect.md\` |
| to record an idea | \`.claude/commands/add-idea.md\` |
| new ideas / brainstorming | \`.claude/commands/new-ideas.md\` |
| to drop an idea | \`.claude/commands/compost.md\` |
| to turn an idea into a plan | \`.claude/commands/plan-idea.md\` |
| to commit, push, or ship | \`.claude/commands/push.md\` |

Keeping the steps in one place means this file can't drift out of sync with what
Claude Code actually runs.

---

## Plan-First Development

For any non-trivial feature, before writing code:
1. Write the plan to \`_PLANS/<FEATURE_NAME>.md\` (SCREAMING_SNAKE_CASE filename)
2. Ask "Ready to start implementing?" and wait for an explicit yes before coding

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
| \`.claude/commands/\` | The workflow definitions - read these, they're plain markdown |
| \`.claude/agents/\` | Role definitions the commands delegate to |
`;

  await fs.writeFile(path.join(cwd, "AGENTS.md"), content);
}

async function createFarmhouseMd(cwd) {
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
| Commands | 7 |
| Agents | 4 |
| Unit Tests | 0 |
| Total Plans | 0 |
| Completed Plans | 0 |

---

## How to get 10/10

Every command and agent is documented and working, \`_PLANS/\` reflects real
implementation history, and CLAUDE.md is complete and accurate.

---

## Commands (\`.claude/commands/\`)

| Command | Description |
|---------|-------------|
| \`/audit\` | Refresh FARMHOUSE.md metrics and tend the Idea Garden |
| \`/inspect\` | Audit + full code review + dry-run quality gates |
| \`/add-idea\` | Plant a new idea in GARDEN.md |
| \`/new-ideas\` | Generate 10 ideas and plant the ones you pick |
| \`/compost\` | Retire an idea to COMPOST.md with a reason |
| \`/plan-idea\` | Graduate an idea into a plan in \`_PLANS/\` |
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

## Audit History

| Date | Changes |
|------|---------|
| ${today} | Initial FARMHOUSE setup via Farmwork CLI |
`;

  await fs.writeFile(path.join(cwd, "_AUDIT", "FARMHOUSE.md"), content);
}

async function createGardenDocs(cwd) {
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

async function createAgents(cwd) {
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
3. Count unit tests: \`find . -name "*.test.*" -not -path "./node_modules/*" | wc -l\`
4. Count total plans: \`ls -1 _PLANS/*.md 2>/dev/null | wc -l\`
5. Count completed plans: search \`_PLANS/*.md\` for a \`**Status:** Complete\` marker

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

async function createCommands(cwd, answers) {
  const pm = answers.packageManager || "npm";

  const commands = {
    "audit.md": `---
description: Refresh FARMHOUSE.md metrics and tend the Idea Garden
allowed-tools: Bash(ls:*), Bash(find:*), Task, Read, Edit, Glob, Grep
---

# Audit

Quick health pass. Reports only - never edits source code, never commits.

## Steps

1. Launch the \`the-farmer\` agent. It gathers the metrics, ages the Idea Garden
   (wilting at 45-60 days, auto-composting past 60), and rewrites
   \`_AUDIT/FARMHOUSE.md\` with a fresh score and history entry.
2. Report what it found: the metric counts, any wilting or auto-composted ideas,
   and the new score.

If \`_AUDIT/FARMHOUSE.md\` doesn't exist yet, say so and suggest \`npx farmwork init\`
rather than inventing one.

For a deeper pass that also reviews the code, use \`/inspect\`.
`,

    "inspect.md": `---
description: Full inspection - audit, code review, and dry-run quality gates
allowed-tools: Bash(ls:*), Bash(find:*), Bash(${pm}:*), Task, Read, Edit, Glob, Grep
---

# Inspect

Everything \`/audit\` does, plus a full code review and a dry run of the quality
gates. **Changes nothing and commits nothing** - this is a read-only report.

## Steps

1. Run the \`/audit\` workflow first (launch \`the-farmer\`, update FARMHOUSE.md).
2. Launch the \`code-reviewer\` agent across the codebase. It covers quality,
   security, performance, code smells, and basic accessibility, and reports findings
   inline by severity. Don't write its findings to any audit file.
3. Run the quality gates as a **dry run** and report pass/fail for each:
   - Lint: \`${answers.lintCommand}\`
   - Tests: \`${answers.testCommand}\`
   - Build: \`${answers.buildCommand}\`
   Skip any script that doesn't exist in package.json and note it as skipped.
   A failing gate is a finding to report, not a reason to stop.
4. Consolidate into one report: metrics, findings grouped by severity, gate results,
   and the two or three things worth doing next.

Use \`/push\` when you're ready to actually fix and ship.
`,

    "add-idea.md": `---
description: Plant a new idea in the Idea Garden
argument-hint: [the idea]
allowed-tools: Task, Read, Edit, Glob, Grep
---

# Add Idea

Plant \`$ARGUMENTS\` in \`_AUDIT/GARDEN.md\`.

Launch the \`idea-gardener\` agent to record it. If \`$ARGUMENTS\` is empty, ask what
the idea is before doing anything.

The entry needs a title, **today's date** as \`**Planted:**\` (get it from
\`date +%Y-%m-%d\` rather than guessing), a one or two sentence description, and two
to four bullets. Ask for the description and bullets if the user only gave a title.

Then update the Active Ideas count and Last Updated date in the header.

The planted date matters: \`/audit\` uses it to wilt ideas at 45 days and compost them
at 60. An idea with no date is invisible to that lifecycle.
`,

    "new-ideas.md": `---
description: Generate 10 fresh ideas and plant the ones you pick
allowed-tools: Task, Read, Edit, Glob, Grep
---

# New Ideas

Launch the \`idea-gardener\` agent to brainstorm against this project's context.

1. It reads \`_AUDIT/GARDEN.md\` (what's already growing), \`_AUDIT/COMPOST.md\`
   (what was rejected and why - don't re-propose these), and \`CLAUDE.md\`.
2. It proposes **10** ideas as a numbered list, one line each, ranging from small
   enhancements to ambitious features.
3. Ask which ones to plant. Wait for an answer - don't plant all 10 by default.
4. Plant only the chosen ones, each with today's date and a few implementation bullets.

Ideas that echo something in COMPOST.md are the main failure here. If one is genuinely
worth revisiting, say why it's different this time rather than quietly re-proposing it.
`,

    "compost.md": `---
description: Retire an idea to COMPOST.md with a reason
argument-hint: [the idea to retire]
allowed-tools: Task, Read, Edit, Glob, Grep
---

# Compost

Retire \`$ARGUMENTS\` from the Idea Garden.

Launch the \`idea-gardener\` agent. It finds the idea in \`_AUDIT/GARDEN.md\`, moves it
to \`_AUDIT/COMPOST.md\` with today's date and a reason, removes it from GARDEN.md, and
updates the counts in both files.

**Ask for the reason if the user didn't give one.** The reason is the entire point of
composting rather than deleting - it's what stops the same idea being re-proposed in
six months. "Not doing it" is not a reason.

If \`$ARGUMENTS\` doesn't clearly match one idea, list the close matches and ask which
one rather than guessing.
`,

    "plan-idea.md": `---
description: Graduate an idea from the Garden into a plan in _PLANS/
argument-hint: [the idea to plan]
allowed-tools: Task, Read, Write, Edit, Glob, Grep
---

# Plan Idea

Turn \`$ARGUMENTS\` into a real implementation plan.

1. Find the idea in \`_AUDIT/GARDEN.md\`. If it isn't there, that's fine - plan it
   anyway and say it wasn't in the Garden.
2. Work out the approach: what changes, which files, what order, what could go wrong.
   Ask about anything genuinely ambiguous before writing.
3. Write the plan to \`_PLANS/<FEATURE_NAME>.md\` in SCREAMING_SNAKE_CASE, with a
   \`**Status:** In Progress\` marker so \`/audit\` can count it.
4. Move the idea into GARDEN.md's "Graduated to Plans" table with the date and a link,
   and remove it from the Ideas section.
5. Ask **"Ready to start implementing?"** and wait for an explicit yes before writing
   any code.

Step 5 is the point of this command. Writing the plan and immediately implementing it
defeats the purpose of having planned.
`,

    "push.md": `---
description: Clean up, review, run quality gates, commit, push, and update metrics
argument-hint: [optional: commit message override]
allowed-tools: Bash(find:*), Bash(git:*), Bash(${pm}:*), Bash(npx:*), Task
---

# Push

End-to-end ship: clean, gate, commit, push, update metrics.

Execute in order. **Stop immediately if any step fails.**

### 1. Clean up system files
\`\`\`bash
find . -name '.DS_Store' -type f -delete
\`\`\`

### 2. Stage changes
\`\`\`bash
git add -A
\`\`\`
Run \`git status\`. If there's nothing to commit, say so and stop here.

### 3. Run the code-cleaner agent
Launch \`code-cleaner\` on the staged files to strip comments and console.logs,
preserving JSDoc, eslint/ts directives, and \`console.error/warn/info\`. Re-stage
anything it touched with \`git add -A\`.

### 4. Run the quality gates
Read package.json and run each script that actually exists:

1. Lint: \`${answers.lintCommand}\`
2. Tests: \`${answers.testCommand}\`
3. Build: \`${answers.buildCommand}\`

Note any missing script as "(skipped - no X script)". If an existing check fails, stop
and report which one - don't push broken code.

### 5. Write the commit message
If \`$ARGUMENTS\` is given, use it. Otherwise read \`git diff --cached\` and
\`git log -5 --oneline\`, then write a concise message in the repo's existing style
that explains **why**, not what.

### 6. Commit and push
Commit with the footer \`🌽 Generated with FARMWORK\`, then \`git push\`.

If the current branch is the default branch and the repo has a remote, create a branch
first rather than pushing straight to main.

### 7. Update metrics
Launch \`the-farmer\` to refresh \`_AUDIT/FARMHOUSE.md\`.

### 8. Report
Files changed, commit hash, push status, and confirmation that metrics were refreshed.
`,
  };

  for (const [filename, content] of Object.entries(commands)) {
    await fs.writeFile(path.join(cwd, ".claude", "commands", filename), content);
  }
}
