import inquirer from "inquirer";
import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import { farmTerm, emojis } from "./terminal.js";
import { selectSupplies, installSupplies } from "./supply.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function detectPackageJson() {
  try {
    const pkgPath = path.join(process.cwd(), "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    return {
      scripts: pkg.scripts || {},
    };
  } catch {
    return { scripts: {} };
  }
}

const QUESTIONS = [
  {
    type: "input",
    name: "projectName",
    message: "🌱 Project name:",
    default: path.basename(process.cwd()),
  },
  {
    type: "list",
    name: "packageManager",
    message: "🧺 Package manager:",
    choices: ["npm", "yarn", "pnpm", "bun"],
  },
  {
    type: "input",
    name: "testCommand",
    message: "🥒 Test command:",
    default: (answers) => {
      const { scripts } = detectPackageJson();
      const pm = answers.packageManager;
      if (scripts.test) return `${pm} run test`;
      if (scripts["test:run"]) return `${pm} run test:run`;
      return `${pm} run test`;
    },
  },
  {
    type: "input",
    name: "buildCommand",
    message: "🌽 Build command:",
    default: (answers) => {
      const { scripts } = detectPackageJson();
      const pm = answers.packageManager;
      if (scripts.build) return `${pm} run build`;
      return `${pm} run build`;
    },
  },
  {
    type: "input",
    name: "lintCommand",
    message: "🦉 Lint command:",
    default: (answers) => {
      const { scripts } = detectPackageJson();
      const pm = answers.packageManager;
      if (scripts.lint) return `${pm} run lint`;
      return `${pm} run lint`;
    },
  },
  {
    type: "confirm",
    name: "includeI18n",
    message: "🌻 Include i18n support?",
    default: false,
  },
  {
    type: "confirm",
    name: "includeKnip",
    message: "🔍 Include knip for dead code detection?",
    default: false,
  },
  {
    type: "confirm",
    name: "addSupplies",
    message: "🧺 Add farm supplies (MCP integrations)?",
    default: true,
  },
];

export async function init(options) {
  const cwd = process.cwd();

  // Show animated logo
  await farmTerm.logoAnimated();

  // Check if farmwork is already installed
  const claudeDir = path.join(cwd, ".claude");
  const farmworkConfig = path.join(cwd, ".farmwork.json");
  const claudeMd = path.join(cwd, "CLAUDE.md");
  const agentsMd = path.join(cwd, "AGENTS.md");

  const isAlreadyInstalled =
    fs.existsSync(claudeDir) &&
    (fs.existsSync(farmworkConfig) || fs.existsSync(claudeMd) || fs.existsSync(agentsMd));

  if (isAlreadyInstalled && !options.force) {
    farmTerm.warn("Farmwork is already installed in this project!");
    farmTerm.nl();

    // Show what's detected
    farmTerm.gray("  Detected:\n");
    if (fs.existsSync(claudeDir)) farmTerm.gray("    • .claude/ directory\n");
    if (fs.existsSync(claudeMd)) farmTerm.gray("    • CLAUDE.md\n");
    if (fs.existsSync(agentsMd)) farmTerm.gray("    • AGENTS.md\n");
    if (fs.existsSync(farmworkConfig)) farmTerm.gray("    • .farmwork.json\n");
    farmTerm.nl();

    const { continueInit } = await inquirer.prompt([
      {
        type: "list",
        name: "continueInit",
        message: "What would you like to do?",
        choices: [
          {
            name: "🐴 Re-initialize (will backup existing files)",
            value: "reinit",
          },
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

    // continueInit === "reinit" - proceed with force
    options.force = true;
    farmTerm.nl();
  }

  farmTerm.header("FARMWORK INITIALIZATION", "primary");
  farmTerm.info(
    "Let's set up your farm! Answer a few questions to get started.\n",
  );

  const answers = await inquirer.prompt(QUESTIONS);

  // Supply selection
  let selectedSupplyIds = [];
  if (answers.addSupplies) {
    selectedSupplyIds = await selectSupplies();
  }
  answers._selectedSupplies = selectedSupplyIds;

  // Check for existing files
  const existingFiles = [];
  const filesToCheck = [
    {
      path: path.join(cwd, "CLAUDE.md"),
      name: "CLAUDE.md",
      backup: "OLD_CLAUDE.md",
    },
    {
      path: path.join(cwd, "AGENTS.md"),
      name: "AGENTS.md",
      backup: "OLD_AGENTS.md",
    },
    {
      path: path.join(cwd, "justfile"),
      name: "justfile",
      backup: "OLD_justfile",
    },
    {
      path: path.join(cwd, ".farmwork.json"),
      name: ".farmwork.json",
      backup: null,
    },
    {
      path: path.join(cwd, ".claude", "commands"),
      name: ".claude/commands/",
      backup: null,
      isDir: true,
    },
    {
      path: path.join(cwd, ".claude", "agents"),
      name: ".claude/agents/",
      backup: null,
      isDir: true,
    },
    {
      path: path.join(cwd, "_AUDIT"),
      name: "_AUDIT/",
      backup: null,
      isDir: true,
    },
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
          {
            name: "🌱 Continue (backup files, add to existing folders)",
            value: "overwrite",
          },
          { name: "🐔 Cancel installation", value: "cancel" },
        ],
      },
    ]);

    if (overwriteChoice === "cancel") {
      farmTerm.nl();
      farmTerm.gray("  Installation cancelled.\n\n");
      process.exit(0);
    }

    // Backup files
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

  // Planting animation
  farmTerm.nl();
  farmTerm.section("Planting Your Farm", emojis.seedling);

  try {
    // Create folder structure with animations
    const steps = [
      {
        name: "Creating directories",
        fn: async () => {
          await fs.ensureDir(path.join(cwd, "_AUDIT"));
          await fs.ensureDir(path.join(cwd, "_PLANS"));
          await fs.ensureDir(path.join(cwd, "_RESEARCH"));
          await fs.ensureDir(path.join(cwd, "_OFFICE"));
          await fs.ensureDir(path.join(cwd, ".claude", "commands"));
          await fs.ensureDir(path.join(cwd, ".claude", "agents"));
          await fs.ensureDir(path.join(cwd, ".claude", "skills"));
        },
      },
      { name: "Planting CLAUDE.md", fn: () => createClaudeMd(cwd, answers) },
      { name: "Growing AGENTS.md", fn: () => createAgentsMd(cwd, answers) },
      {
        name: "Building FARMHOUSE.md",
        fn: () => createFarmhouseMd(cwd, answers),
      },
      {
        name: "Creating audit documents",
        fn: () => createAuditDocs(cwd, answers),
      },
      {
        name: "Setting up office",
        fn: () => createOfficeDocs(cwd, answers),
      },
      { name: "Laying out justfile", fn: () => createJustfile(cwd, answers) },
      { name: "Training agents", fn: () => createAgents(cwd, answers) },
      { name: "Cultivating skills", fn: () => createSkills(cwd, answers) },
      {
        name: "Stocking supplies",
        fn: async () => {
          if (answers._selectedSupplies.length > 0) {
            await installSupplies(answers._selectedSupplies);
          }
        },
        skip: () => answers._selectedSupplies.length === 0,
      },
      { name: "Setting up commands", fn: () => createCommands(cwd, answers) },
      { name: "Configuring settings", fn: () => createSettings(cwd, answers) },
      {
        name: "Writing .farmwork.json",
        fn: () => createProduceConfig(cwd, answers),
      },
    ];

    for (const step of steps) {
      if (step.skip && step.skip()) {
        continue;
      }
      await farmTerm.spin(step.name, step.fn);
    }

    // Install dependencies
    farmTerm.nl();
    farmTerm.section("Installing Tools", emojis.horse);

    // Check and install just
    await farmTerm.spin("Checking for just command runner", async () => {
      const { execSync } = await import("child_process");
      try {
        execSync("which just", { stdio: "ignore" });
      } catch {
        try {
          try {
            execSync("brew install just", { stdio: "pipe" });
          } catch {
            execSync("cargo install just", { stdio: "pipe" });
          }
        } catch {
          farmTerm.warn("Could not install just automatically.");
          farmTerm.gray("    Install manually: brew install just\n");
        }
      }
    });

    // Check and install beads
    await farmTerm.spin("Setting up beads issue tracking", async () => {
      const { execSync } = await import("child_process");
      try {
        execSync("which bd", { stdio: "ignore" });
      } catch {
        let installed = false;
        try {
          execSync("npm install -g @beads/bd", { stdio: "pipe" });
          installed = true;
        } catch {
          try {
            execSync("brew install steveyegge/beads/bd", { stdio: "pipe" });
            installed = true;
          } catch {
            try {
              execSync("cargo install beads", { stdio: "pipe" });
              installed = true;
            } catch {
              // All methods failed
            }
          }
        }
        if (!installed) {
          farmTerm.warn("Could not install beads automatically.");
          farmTerm.gray("    Install manually: npm install -g @beads/bd\n");
        }
      }

      // Initialize beads
      try {
        execSync("bd init", { cwd, stdio: "ignore" });
      } catch {
        // bd init might fail if already initialized
      }

      // Clean up beads-generated files (only @AGENTS.md, we create our own AGENTS.md)
      const beadsAgentFiles = ["@AGENTS.md"];
      for (const file of beadsAgentFiles) {
        try {
          await fs.remove(path.join(cwd, file));
        } catch {
          // File doesn't exist
        }
      }
    });

    // Install knip if enabled
    if (answers.includeKnip) {
      await farmTerm.spin("Installing knip for dead code detection", async () => {
        const { execSync } = await import("child_process");
        try {
          execSync(`${answers.packageManager} add -D knip`, {
            cwd,
            stdio: "pipe",
          });
        } catch {
          farmTerm.warn("Could not install knip automatically.");
          farmTerm.gray(`    Install manually: ${answers.packageManager} add -D knip\n`);
        }
      });
    }

    // Success!
    farmTerm.nl();
    farmTerm.divider("═", 50);
    farmTerm.success("Farmwork initialized successfully!");

    // Show created structure
    farmTerm.section("Created Structure", emojis.corn);
    await farmTerm.planting(
      [
        "_AUDIT/",
        "_PLANS/",
        "_RESEARCH/",
        "_OFFICE/",
        ".claude/commands/",
        ".claude/agents/",
        "CLAUDE.md",
        "AGENTS.md",
        "justfile",
        ".farmwork.json",
      ],
      "Files planted",
    );

    // Next steps
    farmTerm.section("Next Steps", emojis.carrot);
    farmTerm.nl();
    farmTerm.white("  1. ");
    farmTerm.yellow("just --list");
    farmTerm.gray(" → See available commands\n");
    farmTerm.white("  2. ");
    farmTerm.yellow('"open the farm"');
    farmTerm.gray(" → Audit your setup\n");
    farmTerm.white("  3. ");
    farmTerm.yellow('"make a plan for <feature>"');
    farmTerm.gray(" → Start planning\n");

    // Claude prompt box
    farmTerm.nl();
    farmTerm.section("Get Claude Comfortable", emojis.wheat);
    farmTerm.gray("  Copy and paste this prompt to Claude Code:\n\n");

    farmTerm.box(
      "Prompt for Claude",
      [
        "Hey Claude, I am using the Farmwork framework,",
        "please go through the justfile and create",
        "project-specific commands, and go through my",
        "app and suggest project-specific subagents",
        "that would work well.",
      ],
      "secondary",
    );

    // Show merge prompt if we backed up CLAUDE.md
    if (answers._didBackupClaudeMd) {
      farmTerm.nl();
      farmTerm.section("Merge Your Old Instructions", "🥬");
      farmTerm.gray(
        "  Your old CLAUDE.md was backed up. Use this prompt to merge:\n\n",
      );

      farmTerm.box(
        "Merge Prompt",
        [
          "Hey Claude, look at my CLAUDE.md file and",
          "merge the project-specific instructions from",
          "OLD_CLAUDE.md into it, so I have one file",
          "with all the Farmwork instructions plus my",
          "original project setup. Then delete the OLD",
          "files when done.",
        ],
        "accent",
      );
    }

    // Final tractor drive
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

## MANDATORY: Issue-First Workflow

**ALWAYS create beads issues BEFORE starting work.** This ensures full visibility and tracking.

\`\`\`bash
# Single task
bd create "Task description" -t bug|feature|task -p 0-4
bd update <id> --status in_progress
# Do the work
bd close <id> --reason "What was done"

# Multiple tasks - log ALL first, then work through
bd create "Task 1" -t feature && bd create "Task 2" -t task
bd list --status open
\`\`\`

**NO EXCEPTIONS**: Every task gets an issue.

---

## Skills (Auto-Activate on Phrases)

Skills auto-activate when you use these phrases. Workflow details are in \`.claude/skills/\`.

| Phrase | Skill | What Happens |
|--------|-------|--------------|
| **open the farm** | farm-audit | Audit systems, update FARMHOUSE.md |
| **count the herd** | farm-inspect | Full code inspection (no push) |
| **go to market** | market | i18n + accessibility audit |
| **go to production** | production | BROWNFIELD update, strategy check |
| **I have an idea for...** | garden | Plant idea in GARDEN.md |
| **water the garden** | garden | Generate 10 new ideas |
| **compost this...** | garden | Move idea to COMPOST.md |
| **let's research...** | research | Create/update _RESEARCH/ doc |

---

## Slash Commands (Explicit)

| Command | What It Does |
|---------|--------------|
| \`/push\` | Lint, test, build, commit, push |
| \`/office\` | Interactive strategy setup |

---

## Plan Mode Protocol

When entering Plan Mode:

1. **Save Plan**: Write to \`_PLANS/<FEATURE_NAME>.md\` (SCREAMING_SNAKE_CASE)
2. **Exit & Create Epic**: Create beads Epic + child issues
3. **Confirm**: Ask "Ready to start implementing?" - wait for explicit yes

---

## Project Configuration

- **Test:** \`${answers.testCommand}\`
- **Build:** \`${answers.buildCommand}\`
- **Lint:** \`${answers.lintCommand}\`

---

## Quick Reference

\`\`\`bash
just --list        # See all commands
bd list            # See all issues
ls .claude/skills  # See available skills
ls .claude/agents  # See available agents
\`\`\`
`;

  await fs.writeFile(path.join(cwd, "CLAUDE.md"), content);
}

async function createAgentsMd(cwd, answers) {
  const content = `# ${answers.projectName}

> This document provides guidance for AI coding assistants working on this project.
> It defines workflows, phrase commands, and project conventions that help maintain
> code quality and consistent development practices.

---

## MANDATORY: Issue-First Workflow

**ALWAYS create beads issues BEFORE starting work.** This ensures full visibility and tracking.

### Single Task
1. Create issue: \`bd create "Task description" -t bug|feature|task -p 0-4\`
2. Claim it: \`bd update <id> --status in_progress\`
3. Do the work
4. Close it: \`bd close <id> --reason "What was done"\`

### Multiple Tasks
When given multiple tasks, **log ALL of them first** before starting:
1. Create all issues upfront
2. Show what's queued: \`bd list --status open\`
3. Work through them one by one
4. Close each issue when complete

**NO EXCEPTIONS**: Every task gets an issue.

---

## Phrase Commands

These are phrase triggers. Most activate when the phrase is the **entire message**.

---

### Farmwork Phrases (Development Workflow)

Run these in order for a complete development cycle:

| Phrase | Action |
|--------|--------|
| **open the farm** | Audit systems, update \`_AUDIT/FARMHOUSE.md\` with current metrics |
| **count the herd** | Full inspection + dry run: code review, cleanup, performance, security, code quality, accessibility |
| **go to market** | i18n scan + accessibility audit for missing translations and a11y issues |
| **close the farm** | Execute commit and push workflow (lint, test, build, commit, push) |

---

### Plan Phrases

| Phrase | Action |
|--------|--------|
| **make a plan for...** | Investigate codebase, create plan, save to \`_PLANS/*.md\` |
| **let's implement...** | Load plan from \`_PLANS/*.md\`, create Epic + issues, confirm, start work |

---

### Idea Phrases (Pre-Plan Stage)

| Phrase | Action |
|--------|--------|
| **I have an idea for...** | Add new idea to \`_AUDIT/GARDEN.md\` (title, description, bullets) |
| **let's plan this idea...** | Graduate idea from GARDEN → create plan in \`_PLANS/\` |
| **I dont want to do this idea...** | Reject idea → move from GARDEN to COMPOST |
| **remove this feature...** | Archive feature idea to COMPOST |
| **compost this...** | Move idea from GARDEN to COMPOST |
| **water the garden** | Generate 10 new ideas based on existing GARDEN and COMPOST |

---

### Research Phrases (Pre-Plan Stage)

| Phrase | Action |
|--------|--------|
| **let's research...** | Create or update research document in \`_RESEARCH/\` |
| **update research on...** | Update existing research document with fresh findings |
| **show research on...** | Display summary of existing research document |

---

### Office Phrases (Product Strategy & UX)

| Phrase | Action |
|--------|--------|
| **setup office** | Interactive guided setup: GREENFIELD vision, strategy, optional ONBOARDING and USER_GUIDE |
| **go to production** | Production check: update BROWNFIELD.md, check GREENFIELD alignment, note doc impacts |

---

### Farmwork Phrase Details

**open the farm**
1. Launch \`the-farmer\` agent to audit all systems
2. Run \`bd list --status closed | wc -l\` to get total completed issues
3. Updates \`_AUDIT/FARMHOUSE.md\` with current metrics

**count the herd** (Full Audit Cycle)
Runs all inspection agents in parallel, then dry run quality gates. No push.

1. **Code Quality** - \`code-quality\` for review + smells, updates \`_AUDIT/CODE_QUALITY.md\`
2. **Code Cleanup** - \`code-cleaner\` for dead code + comments
3. **Performance Audit** - \`performance-auditor\`, updates \`_AUDIT/PERFORMANCE.md\`
4. **Security Audit** - \`security-auditor\` for OWASP Top 10, updates \`_AUDIT/SECURITY.md\`
5. **Accessibility** - \`accessibility-auditor\` for WCAG 2.1, updates \`_AUDIT/ACCESSIBILITY.md\`
6. **Dry Run** - lint, tests, build (but NOT commit/push)
7. **Summary Report** - Consolidate findings, ask user next steps

**go to market**
1. Scan for hardcoded text not using i18n
2. Launch \`i18n-locale-translator\` agent
3. Launch \`accessibility-auditor\` for WCAG 2.1 compliance
4. Updates \`_AUDIT/ACCESSIBILITY.md\`

**close the farm**
- Execute the commit and push workflow immediately

---

### Idea Phrase Details

**I have an idea for...**
1. Launch \`idea-gardener\` agent
2. Parse idea title from user input
3. Ask for short description and bullet points
4. Add to \`_AUDIT/GARDEN.md\` under ## Ideas section

**let's plan this idea...**
1. Launch \`idea-gardener\` agent
2. Find the idea in GARDEN.md
3. Create plan in \`_PLANS/\` using planning mode
4. Move to "Graduated to Plans" table
5. Remove from ## Ideas section

**compost this...** / **I dont want to do this idea...**
1. Launch \`idea-gardener\` agent
2. Find idea in GARDEN.md (or accept new rejection)
3. Ask for rejection reason
4. Add to \`_AUDIT/COMPOST.md\` with reason
5. Remove from GARDEN.md if it was there

**water the garden**
1. Launch \`idea-gardener\` agent
2. Read \`_AUDIT/GARDEN.md\` to understand existing ideas and themes
3. Read \`_AUDIT/COMPOST.md\` to understand what didn't work and why
4. Generate 10 new, creative ideas that:
   - Build on or extend existing garden ideas
   - Avoid patterns that led to composted ideas
   - Consider the project's direction and goals
5. Present ideas as a numbered list with title and one-line description
6. Ask user: "Which ideas would you like to plant? (enter numbers, e.g., 1, 3, 5)"
7. For selected ideas, add each to GARDEN.md with today's planted date

---

### Research Phrase Details

**let's research...**
1. Launch \`researcher\` agent
2. Parse research topic from user input
3. Check for existing research in \`_RESEARCH/\`
4. Spawn parallel subagents for:
   - Documentation finder (official docs, API refs)
   - Security researcher (CVEs, known issues)
   - Tech stack analyzer (dependencies, compatibility)
   - Community researcher (gotchas, discussions)
5. Consolidate findings into \`_RESEARCH/[TOPIC_NAME].md\`
6. Display summary and suggest next steps

**update research on...**
1. Launch \`researcher\` agent
2. Find existing research document in \`_RESEARCH/\`
3. Run targeted research refresh on specified areas
4. Merge new findings, mark outdated info with strikethrough
5. Update research history and Last Researched date

**show research on...**
1. Find research document in \`_RESEARCH/\`
2. Display summary of key findings, risks, confidence level
3. Suggest refresh if research is aging (15+ days) or stale (30+ days)

---

### Office Phrase Details

**setup office**

Interactive guided setup experience for the _OFFICE/ documents.

1. **Welcome & Context**
   - Display: "Let's set up your product office. I'll guide you through defining your vision and documentation."
   - Check if _OFFICE/ files already exist
   - If existing files found, ask: "Office files already exist. Would you like to update them or start fresh?"

2. **GREENFIELD.md Setup (Required)**
   - Spawn \`strategy-agent\` for interactive setup
   - Ask questions in sequence:
     a. "What's your project name?" (pre-fill from .farmwork.json if available)
     b. "In one sentence, what is this product?"
     c. "What problem does it solve for users?"
     d. "What's the main thing users DO in your app?" (Core action)
     e. "What's stopping users from succeeding?" (Blockers)
     f. "What motivates users to keep using it?" (Motivation)
   - Save answers to GREENFIELD.md
   - Report: "Vision documented in GREENFIELD.md"

3. **Strategy Refinement (Optional)**
   - Ask: "Would you like to define strategic pillars? (y/n)"
   - If yes, ask for 2-3 key principles that guide decisions
   - Add to GREENFIELD.md Strategic Pillars section

4. **ONBOARDING.md Setup (Optional)**
   - Ask: "Does your app have onboarding elements to document? (y/n)"
   - If yes, spawn \`onboarding-agent\` to:
     a. Scan codebase for existing onboarding elements
     b. Ask about welcome experience
     c. Ask about guided tours or tooltips
     d. Document findings in ONBOARDING.md
   - If no, keep placeholder ONBOARDING.md

5. **USER_GUIDE.md Setup (Optional)**
   - Ask: "Would you like to set up user documentation now? (y/n)"
   - If yes, spawn \`user-guide-agent\` to:
     a. Scan codebase for features
     b. Ask about main features to document
     c. Create Quick Start section
     d. Document features in USER_GUIDE.md
   - If no, keep placeholder USER_GUIDE.md

6. **Summary Report**
   \`\`\`
   ## Office Setup Complete

   ### Documents Created/Updated
   - GREENFIELD.md: [Complete/Updated]
   - BROWNFIELD.md: [Created - will populate on "go to production"]
   - ONBOARDING.md: [Complete/Skipped]
   - USER_GUIDE.md: [Complete/Skipped]

   ### Next Steps
   - Use "go to production" to update BROWNFIELD.md with implemented features
   - Run /push to commit your office documents
   \`\`\`

---

**go to production**

Production readiness check from a user experience perspective. Separate from "close the farm" (which handles code quality/push).

1. **Update BROWNFIELD.md**
   - Spawn \`brownfield-agent\` to scan for implemented features
   - Document any new features added since last production
   - Document any features removed
   - Update Production History table
   - Update Last Updated date

2. **Check for Document Impacts**
   - Scan changes against USER_GUIDE.md
   - List any features that need USER_GUIDE updates
   - Scan changes against ONBOARDING.md
   - List any onboarding elements that need updates

3. **Check GREENFIELD Alignment**
   - Spawn \`strategy-agent\` to compare BROWNFIELD against GREENFIELD
   - Ask user: "Do you see any misalignment between your vision (GREENFIELD) and what's implemented (BROWNFIELD)?"
   - If misalignment reported, add to Strategy Changelog

4. **Generate Production Readiness Report**
   \`\`\`
   ## Production Readiness: Implementation Check

   ### BROWNFIELD Status
   - Last Updated: YYYY-MM-DD
   - New Features: X added
   - Removed Features: X removed
   - Modified Features: X changed

   ### Documentation Impact
   - USER_GUIDE.md needs updates: [list or "None"]
   - ONBOARDING.md needs updates: [list or "None"]

   ### Strategy Alignment
   - GREENFIELD vision: [summary]
   - BROWNFIELD reality: [summary]
   - Alignment: High/Medium/Low

   ### Recommendation
   [Ready for production / Needs attention: ...]
   \`\`\`

5. **Ask for Confirmation**
   - "Production check complete. Ready to proceed with deployment?"
   - Wait for user confirmation before any further action

**Note:** This phrase focuses on implementation status and alignment. Use "close the farm" for code quality gates and pushing to remote.

---

## Planning Protocol

**IMPORTANT**: When entering a planning phase for any feature, ALL plans MUST:

### Step 1: Save Plan to \`_PLANS/\`
Before completing the planning phase, the plan MUST be saved to \`_PLANS/<FEATURE_NAME>.md\`:
- Use SCREAMING_SNAKE_CASE for filename
- Include: overview, technical approach, files to modify, implementation steps, risks

### Step 2: Create Implementation Tracking
After user approves:
1. Exit the planning phase
2. Create a beads Epic for the feature
3. Create child issues from plan steps

### Step 3: Confirm Before Implementation
1. Show the created Epic and issues
2. **Always ask**: "Ready to start implementing?"
3. Wait for explicit user confirmation

---

## Project Configuration

- **Test Command:** \`${answers.testCommand}\`
- **Build Command:** \`${answers.buildCommand}\`
- **Lint Command:** \`${answers.lintCommand}\`

---

## Tips for AI Assistants

### When Working on Features
- Always check the justfile: \`just --list\`
- Create issues before starting work
- Use "make a plan for..." for non-trivial features

### Before Committing
\`\`\`bash
${answers.lintCommand}    # Check code quality
${answers.buildCommand}   # Verify compilation
\`\`\`

---

## Directory Structure

This project uses a structured directory layout for AI-assisted development:

| Directory | Purpose |
|-----------|---------|
| \`_AUDIT/\` | Audit documents and health metrics |
| \`_PLANS/\` | Feature implementation plans |
| \`_RESEARCH/\` | Research documents |
| \`_OFFICE/\` | Strategy and UX documentation |
`;

  await fs.writeFile(path.join(cwd, "AGENTS.md"), content);
}

async function createFarmhouseMd(cwd, answers) {
  const today = new Date().toISOString().split("T")[0];

  const content = `# Farmwork Farmhouse

> Central command for the Farmwork agentic harness.
> Updated automatically by \`the-farmer\` agent during \`/push\` or via "open the farm" phrase.

**Last Updated:** ${today}
**Score:** 5.0/10
**Status:** Initial setup

---

## Quick Metrics

| Metric | Count |
|--------|-------|
| Commands | 2 |
| Agents | 13 |
| Office Docs | 3 |
| Research Docs | 0 |
| Justfile Recipes | 11 |
| Unit Tests | 0 |
| E2E Tests | 0 |
| Completed Issues | 0 |

---

## How to get 10/10

All Claude Code commands and agents are documented, phrase triggers are tested and working, issue tracking via beads is active, justfile navigation covers all project areas, and the CLAUDE.md instructions are complete and accurate.

---

## Commands (\`.claude/commands/\`)

| Command | Description |
|---------|-------------|
| \`/push\` | Clean, lint, test, build, commit, push, update metrics |

---

## Agents (\`.claude/agents/\`)

| Agent | Purpose |
|-------|---------|
| \`the-farmer\` | Audit and update FARMHOUSE.md metrics |
| \`code-quality\` | Code review, DRY violations, complexity, naming |
| \`security-auditor\` | OWASP vulnerability scanning |
| \`performance-auditor\` | Performance anti-patterns |
| \`accessibility-auditor\` | WCAG 2.1 compliance, alt text, contrast |
| \`code-cleaner\` | Remove dead code, comments, console.logs |
| \`i18n-locale-translator\` | Translate UI text to locales |
| \`idea-gardener\` | Manage Idea Garden and Compost |
| \`researcher\` | Systematic research before planning |
| \`strategy-agent\` | Analyze GREENFIELD.md vision and strategy (what/stopping/why) |
| \`brownfield-agent\` | Track implemented features in BROWNFIELD.md |
| \`onboarding-agent\` | Document onboarding elements (tours, tooltips, modals) |
| \`user-guide-agent\` | Create feature documentation for help docs |

---

## Phrase Commands

### Farmwork Phrases

| Phrase | Action |
|--------|--------|
| \`open the farm\` | Audit systems, update FARMHOUSE.md |
| \`count the herd\` | Full inspection + dry run (no push) |
| \`go to market\` | i18n scan + accessibility audit |
| \`close the farm\` | Execute /push |

### Plan Phrases

| Phrase | Action |
|--------|--------|
| \`make a plan for...\` | Create plan in _PLANS/ |
| \`let's implement...\` | Load plan, create Epic |

### Idea Phrases

| Phrase | Action |
|--------|--------|
| \`I have an idea for...\` | Add idea to GARDEN.md |
| \`let's plan this idea...\` | Graduate idea to _PLANS/ |
| \`compost this...\` | Move idea to COMPOST.md |

### Research Phrases

| Phrase | Action |
|--------|--------|
| \`let's research...\` | Research topic, save to _RESEARCH/ |
| \`update research on...\` | Refresh existing research |
| \`show research on...\` | Display research summary |

### Office Phrases

| Phrase | Action |
|--------|--------|
| \`setup office\` | Interactive guided setup: GREENFIELD, ONBOARDING, USER_GUIDE |
| \`go to production\` | Update BROWNFIELD.md, check alignment, note doc impacts |

---

## Issue Tracking (\`.beads/\`)

Using \`bd\` CLI for issue management:

\`\`\`bash
bd ready              # Find available work
bd create "..." -t task -p 2  # Create issue
bd update <id> --status in_progress  # Claim work
bd close <id>         # Complete work
\`\`\`

---

## Beads Issue History

**Total Completed Issues:** 0

---

## Audit History

| Date | Changes |
|------|---------|
| ${today} | Initial FARMHOUSE setup via Farmwork CLI |
`;

  await fs.writeFile(path.join(cwd, "_AUDIT", "FARMHOUSE.md"), content);
}

async function createAuditDocs(cwd, answers) {
  const today = new Date().toISOString().split("T")[0];

  const audits = [
    {
      name: "SECURITY.md",
      title: "Security Audit",
      description: "Security posture and vulnerability tracking",
    },
    {
      name: "PERFORMANCE.md",
      title: "Performance Audit",
      description: "Performance metrics and optimization tracking",
    },
    {
      name: "ACCESSIBILITY.md",
      title: "Accessibility Audit",
      description: "WCAG 2.1 Level AA compliance tracking",
    },
    {
      name: "CODE_QUALITY.md",
      title: "Code Quality Audit",
      description: "Code quality and standards tracking",
    },
    {
      name: "TESTS.md",
      title: "Test Coverage Audit",
      description: "Test coverage and gaps tracking",
    },
  ];

  for (const audit of audits) {
    const content = `# ${audit.title}

> ${audit.description}

**Last Updated:** ${today}
**Score:** 5.0/10
**Status:** Initial setup

---

## How to get 10/10

[Define what perfect looks like for this audit area]

---

## Constraints

| Constraint | Reason | Impact |
|------------|--------|--------|
| TBD | TBD | TBD |

---

## Open Items

_None currently_

---

## Audit History

| Date | Changes |
|------|---------|
| ${today} | Initial ${audit.title.toLowerCase()} setup via Farmwork CLI |
`;

    await fs.writeFile(path.join(cwd, "_AUDIT", audit.name), content);
  }

  // Create GARDEN.md (Idea nursery - custom format)
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

  // Create COMPOST.md (Rejected ideas archive - custom format)
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
| \`I dont want to do this idea...\` | Reject an idea |
| \`remove this feature...\` | Archive a feature idea |
| \`compost this...\` | Move idea from GARDEN here |

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

  // Create KNIP.md if knip is enabled
  if (answers.includeKnip) {
    const knipContent = `# Knip Dead Code Report

> Unused files, dependencies, and exports detected by knip.
> Run \`npx knip --reporter compact\` to update.

**Last Updated:** ${today}
**Status:** Initial setup

---

## Summary

| Category | Count |
|----------|-------|
| Unused Files | 0 |
| Unused Dependencies | 0 |
| Unused Exports | 0 |

---

## Unused Files

_No unused files detected._

---

## Unused Dependencies

_No unused dependencies detected._

---

## Unused Exports

_No unused exports detected._

---

## Actions

Review each finding before removal:
- Some exports may be used dynamically (via string interpolation)
- Some dependencies may be peer deps or build-only
- Some files may be entry points not detected by knip

---

## Audit History

| Date | Changes |
|------|---------|
| ${today} | Initial knip setup via Farmwork CLI |
`;

    await fs.writeFile(path.join(cwd, "_AUDIT", "KNIP.md"), knipContent);
  }
}

async function createOfficeDocs(cwd, answers) {
  const today = new Date().toISOString().split("T")[0];

  // Create GREENFIELD.md - Vision & Strategy document (replaces CORE_LOOP.md)
  const greenfieldContent = `# Greenfield Vision

> Your product vision and strategic direction. Focus on WHAT you're building, not HOW.
> This is a living document that adapts as your understanding evolves.

**Project Name:** ${answers.projectName}
**Last Updated:** ${today}
**Status:** Initial setup
**Confidence:** Low

---

## Core Idea

_What is this product in one sentence?_

[Describe your product's core purpose]

---

## Problem Being Solved

_What pain point or need does this address?_

**The Problem:**
[Describe the problem users face]

**Why It Matters:**
[Explain the impact of solving this problem]

---

## The Game Loop (Strategy)

> Treat your product like a game. What keeps users engaged?

### 1. What are they doing?
_The primary action or loop users engage in_

**Core Action:**
[Describe the main user activity]

### 2. What's stopping them?
_Friction, obstacles, or pain points_

**Current Blockers:**
- [Blocker 1]
- [Blocker 2]

### 3. Why are they doing it?
_Underlying motivation and rewards_

**User Motivation:**
[Describe what drives users]

---

## Vision Loop

\`\`\`
[Entry Point] → [Core Action] → [Reward/Feedback] → [Loop Back]
\`\`\`

---

## Strategic Pillars

_Key principles that guide product decisions_

1. **[Pillar 1]** - [Description]
2. **[Pillar 2]** - [Description]
3. **[Pillar 3]** - [Description]

---

## Success Metrics

| Metric | Current | Target | Notes |
|--------|---------|--------|-------|
| [Metric 1] | TBD | [goal] | |
| [Metric 2] | TBD | [goal] | |

---

## Strategy Changelog

| Date | Change | Previous | Reason |
|------|--------|----------|--------|
| ${today} | Initial vision setup | - | Created via farmwork init |

---

## Related Documents

- [BROWNFIELD.md](./_OFFICE/BROWNFIELD.md) - What's already implemented
- [ONBOARDING.md](./_OFFICE/ONBOARDING.md) - First-time user experience
- [USER_GUIDE.md](./_OFFICE/USER_GUIDE.md) - Feature documentation
`;

  await fs.writeFile(path.join(cwd, "_OFFICE", "GREENFIELD.md"), greenfieldContent);

  // Create BROWNFIELD.md - Implementation Status document
  const brownfieldContent = `# Brownfield Status

> What's already implemented. Focus on WHAT exists, not HOW it works.
> Updated during "go to production" to track solidified features.

**Last Updated:** ${today}
**Status:** Initial setup
**Implemented Features:** 0

---

## Current State

_High-level summary of what the app currently does_

[Describe current implementation state]

---

## Solidified Features

_Features that are complete and stable_

<!-- Feature format:
### Feature Name
**Status:** Complete | Stable | Production-ready
**Added:** YYYY-MM-DD

Brief description of what this feature does.

**Capabilities:**
- Capability 1
- Capability 2
-->

_No features solidified yet._

---

## Recent Changes

_Features added or removed in recent production cycles_

### Added
| Feature | Date | Notes |
|---------|------|-------|
| | | |

### Removed
| Feature | Date | Reason |
|---------|------|--------|
| | | |

### Modified
| Feature | Date | Change |
|---------|------|--------|
| | | |

---

## Workflows

_User workflows that are implemented_

<!-- Workflow format:
### Workflow Name
1. Step 1
2. Step 2
3. Step 3
-->

_No workflows documented yet._

---

## Technical Constraints

_Implementation decisions that affect future development_

| Constraint | Reason | Impact |
|------------|--------|--------|
| | | |

---

## Production History

| Date | Version | Changes Summary |
|------|---------|-----------------|
| ${today} | Initial | Created via farmwork init |

---

## Related Documents

- [GREENFIELD.md](./_OFFICE/GREENFIELD.md) - Vision and strategy
- [ONBOARDING.md](./_OFFICE/ONBOARDING.md) - First-time user experience
- [USER_GUIDE.md](./_OFFICE/USER_GUIDE.md) - Feature documentation
`;

  await fs.writeFile(path.join(cwd, "_OFFICE", "BROWNFIELD.md"), brownfieldContent);

  // Create ONBOARDING.md - Onboarding tracker
  const onboardingContent = `# User Onboarding

> Living document for first-time user experience: tours, popups, modals, tooltips, and progressive disclosure.
> Track what users see when they first use your product.

**Last Updated:** ${today}
**Status:** Initial setup
**Onboarding Steps:** 0

---

## Onboarding Flow Overview

\`\`\`
[Landing] → [Signup] → [Welcome] → [First Action] → [Success Moment]
\`\`\`

---

## Onboarding Elements

### Welcome Experience
_What does the user see immediately after signup/first visit?_

| Element | Type | Content | Status |
|---------|------|---------|--------|
| | | | |

### Guided Tours
_Step-by-step tours that walk users through features_

| Tour Name | Steps | Trigger | Status |
|-----------|-------|---------|--------|
| | | | |

### Tooltips & Hints
_Contextual help that appears on specific elements_

| Element | Tooltip Text | Trigger | Status |
|---------|--------------|---------|--------|
| | | | |

### Modals & Popups
_Modal dialogs that appear during onboarding_

| Modal Name | Purpose | Trigger | Status |
|------------|---------|---------|--------|
| | | | |

### Empty States
_What users see before they have data_

| Screen | Empty State Message | CTA | Status |
|--------|---------------------|-----|--------|
| | | | |

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Onboarding completion rate | TBD | 80% |
| Time to first value | TBD | < 5 min |
| Drop-off points | TBD | Identify |

---

## Changelog

| Date | Change | Reason |
|------|--------|--------|
| ${today} | Initial onboarding setup | Created via farmwork init |

---

## Related Documents

- [GREENFIELD.md](./_OFFICE/GREENFIELD.md) - Vision and strategy
- [BROWNFIELD.md](./_OFFICE/BROWNFIELD.md) - What's already implemented
- [USER_GUIDE.md](./_OFFICE/USER_GUIDE.md) - Feature documentation
`;

  await fs.writeFile(path.join(cwd, "_OFFICE", "ONBOARDING.md"), onboardingContent);

  // Create USER_GUIDE.md - Feature documentation
  const userGuideContent = `# User Guide

> Living documentation for features and how to use them.
> Grows over time to eventually become help docs.
> Each feature gets a short block with bullet list instructions.

**Last Updated:** ${today}
**Status:** Initial setup
**Features Documented:** 0

---

## Quick Start

_Minimal steps to get started with the product_

1. [First step]
2. [Second step]
3. [Third step]

---

## Features

<!-- Feature Template:
### Feature Name
Brief description of what this feature does.

**How to use:**
- Step 1
- Step 2
- Step 3

**Tips:**
- Helpful tip

**Related:** [Link to related feature]
-->

_No features documented yet. Say "setup office" to add features._

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| | |

---

## FAQ

### Common Questions

_No FAQs yet._

---

## Changelog

| Date | Change |
|------|--------|
| ${today} | Initial user guide setup |

---

## Related Documents

- [GREENFIELD.md](./_OFFICE/GREENFIELD.md) - Vision and strategy
- [BROWNFIELD.md](./_OFFICE/BROWNFIELD.md) - What's already implemented
- [ONBOARDING.md](./_OFFICE/ONBOARDING.md) - First-time user experience
`;

  await fs.writeFile(path.join(cwd, "_OFFICE", "USER_GUIDE.md"), userGuideContent);
}

async function createJustfile(cwd, answers) {
  const content = `# ${answers.projectName} - Farmwork
# Run \`just --list\` to see all commands

# Variables
project_root := justfile_directory()

# ============================================
# DEVELOPMENT
# ============================================

# Start development server
dev:
    npm run dev

# Run linter
lint:
    ${answers.lintCommand}

# Run tests
test:
    ${answers.testCommand}

# Build project
build:
    ${answers.buildCommand}

# ============================================
# NAVIGATION
# ============================================

# Go to audit folder
audit:
    @echo "{{project_root}}/_AUDIT" && cd {{project_root}}/_AUDIT

# Go to plans folder
plans:
    @echo "{{project_root}}/_PLANS" && cd {{project_root}}/_PLANS

# Go to research folder
research:
    @echo "{{project_root}}/_RESEARCH" && cd {{project_root}}/_RESEARCH

# Go to commands folder
commands:
    @echo "{{project_root}}/.claude/commands" && cd {{project_root}}/.claude/commands

# Go to agents folder
agents:
    @echo "{{project_root}}/.claude/agents" && cd {{project_root}}/.claude/agents

# ============================================
# UTILITIES
# ============================================

# Show project structure
overview:
    @tree -L 2 -I 'node_modules|.git|dist|coverage|__pycache__|.venv' 2>/dev/null || find . -maxdepth 2 -type d | head -30

# Search for files by name
search pattern:
    @find . -name "*{{pattern}}*" -not -path "./node_modules/*" -not -path "./.git/*" 2>/dev/null

# Show git status
status:
    @git status --short

# ============================================
# Farmwork WORKFLOW
# ============================================

# Run full quality gate (lint + test + build)
quality:
    just lint && just test && just build

# Show beads issues
issues:
    @bd list --status open 2>/dev/null || echo "Beads not installed. Run: cargo install beads"

# Show completed issues count
completed:
    @bd list --status closed 2>/dev/null | wc -l || echo "0"
`;

  await fs.writeFile(path.join(cwd, "justfile"), content);
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
1. Count commands: \`ls -1 .claude/commands/*.md | wc -l\`
2. Count agents: \`ls -1 .claude/agents/*.md | wc -l\`
3. Count tests: \`find . -name "*.test.*" | wc -l\`
4. Count completed issues: \`bd list --status closed | wc -l\`

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

### Step 3: Check Research Freshness
Read all documents in \`_RESEARCH/\` and check their age:

1. Parse each document's \`**Last Researched:**\` date
2. Calculate age: today - last researched date (in days)
3. For research **15-30 days old** (Aging):
   - Update status to "Aging" in the document
   - Report these in the audit summary
4. For research **over 30 days old** (Stale):
   - Update status to "Stale" in the document
   - Report these as needing refresh before use in plans
5. Count total research documents for FARMHOUSE metrics

### Step 4: Update FARMHOUSE.md
1. Update metrics table (including Research Docs count)
2. Update score based on completeness
3. Add audit history entry

## Output Format

\`\`\`
## Farmhouse Audit Complete

### Metrics Updated
- Commands: X total
- Agents: X total
- Research Docs: X total
- Tests: X files
- Completed Issues: X total

### Idea Garden
- Active Ideas: X
- Wilting Ideas: X (list titles if any)
- Auto-Composted: X (list titles if any)

### Research Library
- Fresh: X documents
- Aging: X documents (list titles if any)
- Stale: X documents (list titles if any)

### Score: X/10
\`\`\`
`,
    "code-quality.md": `---
name: code-quality
description: Review code for quality, maintainability, DRY violations, and code smells
tools: Read, Grep, Glob, Edit
model: opus
---

# Code Quality Agent

Comprehensive code quality review covering:

## Code Review
- Readability and maintainability
- Best practice violations
- Error handling patterns
- API design issues

## Code Smells
- DRY violations (duplicated code)
- Complexity issues (functions > 1000 lines, deep nesting)
- Naming issues (misleading names, abbreviations)
- Magic values (hardcoded numbers/strings)
- Technical debt (TODO, FIXME, HACK comments)

Reports findings with severity (CRITICAL, HIGH, MEDIUM, LOW).
Updates \`_AUDIT/CODE_QUALITY.md\` with results.
`,
    "security-auditor.md": `---
name: security-auditor
description: OWASP security vulnerability scanning
tools: Read, Grep, Glob, Edit
model: opus
---

# Security Auditor Agent

Scans for OWASP Top 10 vulnerabilities:
- XSS (dangerouslySetInnerHTML, unescaped input)
- Injection attacks
- Auth/authz issues
- Sensitive data exposure
- API security issues

Reports findings by severity with specific remediation steps.
Updates \`_AUDIT/SECURITY.md\` with results.
`,
    "performance-auditor.md": `---
name: performance-auditor
description: Find memory leaks, unnecessary re-renders, and anti-patterns
tools: Read, Grep, Glob, Edit
model: opus
---

# Performance Auditor Agent

Scans for performance anti-patterns:
- Memory leaks (missing cleanup)
- Unnecessary re-renders
- Bundle size issues
- Expensive operations in render
- Framework anti-patterns

Reports findings with impact assessment.
Updates \`_AUDIT/PERFORMANCE.md\` with results.
`,
    "accessibility-auditor.md": `---
name: accessibility-auditor
description: WCAG 2.1 accessibility auditing for React/Next.js applications
tools: Read, Grep, Glob, Edit
model: opus
---

# Accessibility Auditor Agent

Scans for WCAG 2.1 Level AA compliance issues:
- Missing or inadequate alt text on images
- Color contrast issues
- Keyboard navigation problems
- Missing ARIA labels and roles
- Form accessibility (labels, error messages)
- Focus management issues

Reports findings by severity (CRITICAL, HIGH, MEDIUM, LOW).
Updates \`_AUDIT/ACCESSIBILITY.md\` with results.
`,
    "code-cleaner.md": `---
name: code-cleaner
description: Remove dead code, unused imports, comments, and console.logs while preserving JSDoc
tools: Read, Write, Edit, Bash, Grep, Glob
model: opus
---

# Code Cleaner Agent

Comprehensive code cleanup for TypeScript/JavaScript files.

## Removes
- Unused imports
- Unused functions and classes
- Unused variables
- Dead code paths
- Line comments (\`//\`)
- Block comments (\`/* */\`)
- \`console.log\` statements

## Preserves
- JSDoc comments (\`/** */\`)
- \`console.error\`, \`console.warn\`, \`console.info\`

## Knip Integration
If knip is installed in the project, first run knip for comprehensive dead code detection:
\\\`\\\`\\\`bash
npx knip --reporter compact
\\\`\\\`\\\`

Knip finds:
- Unused files (not imported anywhere)
- Unused dependencies in package.json
- Unused exports from modules

Review knip output before manual cleanup. Some exports may be used dynamically.

Use after refactoring, when removing features, or before production deployment.
`,
    "i18n-locale-translator.md": `---
name: i18n-locale-translator
description: Translate UI text content into English (en) and Japanese (jp) using i18n locale system
tools: Read, Write, Edit, Glob, Grep
model: opus
---

# i18n Locale Translator Agent

Handles internationalization tasks:
- Extract hardcoded text from components
- Create translation keys in locale files
- Translate content to English and Japanese
- Update components to use translation hooks

Use when adding new features or internationalizing existing hardcoded text.
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

### Compost an Idea (from "compost this..." / "I dont want...")
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
    "researcher.md": `---
name: researcher
description: Systematic research agent - gathers documentation, risks, security concerns, and implementation insights
tools: Read, Edit, Glob, Grep, Bash, WebFetch, Task
model: opus
---

# Researcher Agent

Conducts systematic research on features, technologies, and concepts before planning.
Creates and maintains living research documents in \`_RESEARCH/\`.

## Core Capabilities

1. **Parallel Research Spawning** - Spawns focused subagents for different research areas
2. **Documentation Discovery** - Finds official docs, API references, tutorials
3. **Security Analysis** - Identifies CVEs, known vulnerabilities, security best practices
4. **Tech Stack Analysis** - Analyzes dependencies, compatibility, bundle size
5. **Community Insights** - Gathers gotchas, common issues, best practices from community
6. **MCP Integration** - Uses ref.tools MCP when available for enhanced documentation access

## Instructions

### Step 1: Parse Research Request
1. Extract the research topic from user input after "let's research..."
2. Normalize topic name to SCREAMING_SNAKE_CASE for filename
3. Check if \`_RESEARCH/[TOPIC_NAME].md\` already exists

### Step 2: Spawn Parallel Research Agents
Create focused subtasks for parallel execution using the Task tool:

**Documentation Research Task:**
- Find official documentation sites
- Identify API references and getting started guides
- Locate migration guides if applicable
- If ref.tools MCP available: Query \`mcp__Ref__ref_search_documentation\` for relevant docs

**Security Research Task:**
- Search for known CVEs related to the topic
- Find security advisories
- Identify authentication/authorization concerns
- Research data handling best practices
- Check for dependency vulnerabilities

**Tech Stack Research Task:**
- Identify required dependencies
- Check Node.js/browser compatibility
- Analyze bundle size implications
- Find TypeScript type definitions
- Check for ESM/CJS compatibility

**Community Research Task:**
- Search GitHub issues for common problems
- Find Stack Overflow discussions
- Identify known gotchas and edge cases
- Gather migration experiences
- Find performance optimization tips

### Step 3: Consolidate Findings
1. Wait for all parallel research tasks to complete
2. Merge findings into structured research document
3. Identify conflicts or contradictions between sources
4. Assign confidence levels based on source quality
5. Highlight critical risks that require attention

### Step 4: Create/Update Research Document

**If new research:**
Create \`_RESEARCH/[TOPIC_NAME].md\` with this format:

\`\`\`markdown
# Research: [Topic Name]

> Systematic research findings for informed decision-making.
> This is a living document - updated periodically as new information emerges.

**Created:** YYYY-MM-DD
**Last Researched:** YYYY-MM-DD
**Status:** Fresh
**Confidence:** High | Medium | Low

---

## Summary

[2-3 sentence executive summary of key findings]

---

## Official Documentation

| Resource | URL | Notes |
|----------|-----|-------|
| [Doc Name] | [URL] | [Key insight] |

---

## Tech Stack Analysis

### Dependencies
- **Package Name** - version X.X.X - [purpose/notes]

### Compatibility
| Environment | Status | Notes |
|-------------|--------|-------|
| Node.js | vX.X+ | [notes] |
| Browser | [support] | [notes] |

### Bundle Size / Performance
[Analysis of size and performance implications]

---

## Security Concerns

### Known Vulnerabilities
| CVE/Issue | Severity | Status | Mitigation |
|-----------|----------|--------|------------|
| [CVE-ID] | High/Med/Low | Fixed/Open | [action] |

### Security Best Practices
- [Practice 1]
- [Practice 2]

---

## Risks & Gotchas

### Common Pitfalls
1. **[Pitfall Name]** - [Description and how to avoid]

### Breaking Changes
| Version | Change | Impact |
|---------|--------|--------|
| [ver] | [change] | [impact] |

### Edge Cases
- [Edge case 1]
- [Edge case 2]

---

## Community Insights

### GitHub Issues / Discussions
| Issue | Topic | Resolution |
|-------|-------|------------|
| [#123] | [topic] | [resolution] |

### Stack Overflow / Forums
- [Key insight from community]

---

## Implementation Recommendations

### Recommended Approach
[Based on research, the recommended approach is...]

### Alternatives Considered
| Approach | Pros | Cons |
|----------|------|------|
| [Alt 1] | [pros] | [cons] |

---

## Related Research

- [Link to related _RESEARCH/ document]
- [Link to relevant _PLANS/ document]

---

## Research History

| Date | Researcher | Areas Updated |
|------|------------|---------------|
| YYYY-MM-DD | researcher agent | Initial research |
\`\`\`

**If updating existing research:**
1. Read existing document
2. Merge new findings with existing content
3. Mark outdated information with ~~strikethrough~~
4. Update Last Researched date
5. Update Status based on age (Fresh: 0-14d, Aging: 15-30d, Stale: 30+d)
6. Add entry to Research History table

### Step 5: Integration Check
1. Check for related ideas in \`_AUDIT/GARDEN.md\`
2. Check for existing plans in \`_PLANS/\`
3. Add cross-references to Related Research section
4. Suggest next steps (plan creation, more research, etc.)

## Staleness Detection

Research document status:
- **Fresh** (0-14 days) - Research is current and reliable
- **Aging** (15-30 days) - Consider refreshing for major decisions
- **Stale** (30+ days) - Recommend updating before using for plans

## Output Format

After research completion, display:

\`\`\`
## Research Complete: [Topic Name]

### Key Findings
- [Most important finding 1]
- [Most important finding 2]
- [Most important finding 3]

### Critical Risks
- [Risk 1 if any]
- [Risk 2 if any]

### Confidence: [High/Medium/Low]

Research document saved to: _RESEARCH/[TOPIC_NAME].md

Next steps:
- [ ] Review full research document
- [ ] "make a plan for..." to create implementation plan
- [ ] "update research on..." to gather more information
\`\`\`
`,
    "strategy-agent.md": `---
name: strategy-agent
description: Analyze and update GREENFIELD.md - product vision, core loop strategy, and strategic alignment
tools: Read, Edit, Glob, Grep, Task
model: opus
---

# Strategy Agent

Maintains \`_OFFICE/GREENFIELD.md\` - the living vision and strategy document.

## Core Responsibility

Define and refine the product vision focusing on WHAT, not HOW:
1. **Core Idea** - What is this product?
2. **Problem Being Solved** - What pain point does it address?
3. **The Game Loop** - What are they doing / What's stopping them / Why are they doing it

## Instructions

### When Invoked via "setup office"

Interactive setup mode:
1. Ask user for project vision in one sentence
2. Ask about the problem being solved
3. Guide through game loop questions (What/Stopping/Why)
4. Ask about strategic pillars (optional)
5. Create/update GREENFIELD.md with answers
6. Add entry to Strategy Changelog

### When Checking for Production ("go to production")

Alignment check mode:
1. Read \`_OFFICE/GREENFIELD.md\` (vision)
2. Read \`_OFFICE/BROWNFIELD.md\` (implementation)
3. Compare vision against reality
4. Ask user: "Do you see any misalignment between your vision and what's implemented?"
5. If misalignment, document in Strategy Changelog
6. Report alignment status (High/Medium/Low)

### Probing Questions for Vision

- "What is this product in one sentence?"
- "What problem does it solve for users?"
- "What's the main thing users DO in your app?"
- "What prevents users from succeeding?"
- "What motivates users to return?"
- "What are 2-3 key principles that guide your decisions?"

## Output Format

\`\`\`
## Vision Analysis

### Core Idea
[One-sentence product description]

### Problem
[Problem being solved]

### Game Loop
- Action: [What users do]
- Blockers: [What stops them]
- Motivation: [Why they do it]

### Strategic Pillars
1. [Pillar 1]
2. [Pillar 2]
3. [Pillar 3]

Updated _OFFICE/GREENFIELD.md
\`\`\`
`,
    "brownfield-agent.md": `---
name: brownfield-agent
description: Track implemented features and changes in BROWNFIELD.md during production cycles
tools: Read, Edit, Glob, Grep, Task
model: opus
---

# Brownfield Agent

Maintains \`_OFFICE/BROWNFIELD.md\` - tracking what's actually implemented.

## Core Responsibility

Document the current state of implementation focusing on WHAT exists, not HOW:
- Solidified features
- Recent additions and removals
- User workflows
- Technical constraints

## Instructions

### When Invoked via "go to production"

1. Read current \`_OFFICE/BROWNFIELD.md\`
2. Scan the codebase for implemented features:
   - Check routes, pages, and main components
   - Look for feature flags or feature directories
   - Identify user-facing functionality
3. Compare against last production snapshot
4. Document changes:
   - **Added:** New features since last production
   - **Removed:** Features that were removed
   - **Modified:** Significant changes to existing features
5. Update Solidified Features section for stable features
6. Update Production History table
7. Update Last Updated date

### When Checking Alignment

1. List all solidified features
2. List all documented workflows
3. Compare against GREENFIELD.md vision
4. Identify any gaps or misalignment

## Output Format

\`\`\`
## Implementation Status

### Current Features
- Feature A (stable)
- Feature B (new)
- Feature C (modified)

### Changes This Cycle
- Added: [list]
- Removed: [list]
- Modified: [list]

### Workflows Documented
- Workflow 1: [X steps]
- Workflow 2: [Y steps]

Updated _OFFICE/BROWNFIELD.md
\`\`\`
`,
    "onboarding-agent.md": `---
name: onboarding-agent
description: Identify and document onboarding elements - tours, popups, modals, tooltips, empty states
tools: Read, Edit, Glob, Grep, Task
model: opus
---

# Onboarding Agent

Maintains \`_OFFICE/ONBOARDING.md\` - tracking first-time user experience elements.

## Core Responsibility

Identify, document, and track all onboarding-related UI elements:
- Welcome experiences
- Guided tours
- Tooltips and hints
- Modals and popups
- Empty states
- Progressive disclosure

## Instructions

### When Invoked via "setup office"

1. Read \`_OFFICE/ONBOARDING.md\` to understand current state
2. Scan the codebase for onboarding elements:
   - Search for: \`tour\`, \`tooltip\`, \`modal\`, \`popup\`, \`hint\`, \`onboarding\`, \`welcome\`, \`empty\`, \`first-time\`
   - Check for libraries: \`react-joyride\`, \`intro.js\`, \`shepherd.js\`, etc.
3. Ask the user questions:
   - "What should users see on their first visit?"
   - "What's the critical 'aha moment' you want to guide them to?"
   - "Are there any tours or tooltips currently implemented?"
4. Document findings in ONBOARDING.md tables
5. Identify gaps in onboarding coverage
6. Add entry to Changelog

### When Checking for Production ("go to production")

1. Read \`_OFFICE/ONBOARDING.md\`
2. Check for incomplete or missing onboarding:
   - Empty states without content
   - Key flows without guidance
   - Tooltips without text
3. Report onboarding readiness status
4. Update Last Updated date

## Output Format

\`\`\`
## Onboarding Analysis

### Found Elements
- [X] Welcome modal
- [ ] Guided tour
- [X] Empty states (3 found)

### Gaps Identified
- No tour for main feature
- Missing tooltip on key button

### Recommendations
- Add 3-step tour for new users
- Create empty state for dashboard

Updated _OFFICE/ONBOARDING.md
\`\`\`
`,
    "user-guide-agent.md": `---
name: user-guide-agent
description: Document features and create user help documentation in bullet list format
tools: Read, Edit, Glob, Grep, Task
model: opus
---

# User Guide Agent

Maintains \`_OFFICE/USER_GUIDE.md\` - living feature documentation that grows into help docs.

## Core Responsibility

Create and maintain user-facing documentation for features:
- Short, scannable feature descriptions
- Step-by-step bullet list instructions
- Helpful tips and related features
- Keyboard shortcuts
- FAQ entries

## Instructions

### When Invoked via "setup office"

1. Read \`_OFFICE/USER_GUIDE.md\` to understand current documentation
2. Scan the codebase for features:
   - Identify routes and pages
   - Find user-facing components
   - Look for keyboard event handlers
   - Check for documented features in comments
3. Ask the user questions:
   - "What are the main features users should know about?"
   - "What questions do users commonly ask?"
   - "Are there any keyboard shortcuts?"
4. For each feature, create a documentation block:
   \`\`\`markdown
   ### Feature Name
   Brief description.

   **How to use:**
   - Step 1
   - Step 2

   **Tips:**
   - Helpful tip
   \`\`\`
5. Add entry to Changelog

### When Checking for Production ("go to production")

1. Read \`_OFFICE/USER_GUIDE.md\`
2. Check for completeness:
   - All major features documented?
   - Quick start section complete?
   - Any placeholder text remaining?
3. Report documentation status
4. Update Last Updated date and feature count

## Output Format

\`\`\`
## User Guide Analysis

### Documented Features
- Feature A (complete)
- Feature B (complete)
- Feature C (needs tips)

### Missing Documentation
- Feature D (new, undocumented)
- Keyboard shortcuts (incomplete)

### Recommendations
- Add documentation for Feature D
- Complete keyboard shortcuts table

Updated _OFFICE/USER_GUIDE.md
\`\`\`
`,
  };

  for (const [filename, content] of Object.entries(agents)) {
    await fs.writeFile(path.join(cwd, ".claude", "agents", filename), content);
  }
}

async function createSkills(cwd, answers) {
  // Skills are directories with SKILL.md files
  // They auto-activate based on semantic matching of the description field

  const skills = {
    "farm-audit": {
      "SKILL.md": `---
name: farm-audit
description: Audit all Farmwork systems and update FARMHOUSE.md metrics. Use when user says "open the farm", "audit systems", "check farm status", "update farmhouse", "project health", or asks about the current state of the project.
allowed-tools: Bash(*), Task, Read, Edit, Glob, Grep
---

# Farm Audit Skill

Comprehensive audit of all Farmwork systems. Updates \`_AUDIT/FARMHOUSE.md\` with current metrics.

## When to Use
- User wants to check project health
- Starting a new work session
- Before major releases
- Periodic maintenance check

## Workflow

### Step 1: Launch the-farmer Agent
Spawn the \`the-farmer\` agent to gather all metrics.

### Step 2: Gather Metrics
1. Count commands: \`ls -1 .claude/commands/*.md 2>/dev/null | wc -l\`
2. Count agents: \`ls -1 .claude/agents/*.md 2>/dev/null | wc -l\`
3. Count skills: \`ls -d .claude/skills/*/ 2>/dev/null | wc -l\`
4. Count tests: \`find . -name "*.test.*" -not -path "./node_modules/*" | wc -l\`
5. Count completed issues: \`bd list --status closed 2>/dev/null | wc -l\`

### Step 3: Tend the Idea Garden
Read \`_AUDIT/GARDEN.md\` and check idea ages:
- **Fresh** (0-44 days): No action needed
- **Wilting** (45-60 days): Mark with ⚠️ in output
- **Composted** (60+ days): Move to \`_AUDIT/COMPOST.md\`

### Step 4: Check Research Freshness
Read \`_RESEARCH/*.md\` files and check ages:
- **Fresh** (0-14 days): Current and reliable
- **Aging** (15-30 days): Consider refreshing
- **Stale** (30+ days): Recommend update

### Step 5: Update FARMHOUSE.md
Update \`_AUDIT/FARMHOUSE.md\` with:
- Current date
- All metrics
- Score based on completeness
- Audit history entry

## Output Format
\`\`\`
## Farm Audit Complete

### Metrics
- Commands: X
- Agents: X
- Skills: X
- Tests: X files
- Completed Issues: X

### Idea Garden
- Active: X ideas
- Wilting: X ideas (list if any)
- Auto-composted: X ideas

### Research Library
- Fresh: X docs
- Aging: X docs
- Stale: X docs

### Score: X/10
\`\`\`
`,
      "checklist.md": `# Farm Audit Checklist

## Pre-Audit
- [ ] Ensure all files are saved
- [ ] Check git status is clean (optional)

## Audit Items
- [ ] Commands inventory
- [ ] Agents inventory
- [ ] Skills inventory
- [ ] Test file count
- [ ] Completed issues count
- [ ] Idea garden tending
- [ ] Research freshness check

## Post-Audit
- [ ] FARMHOUSE.md updated
- [ ] Score calculated
- [ ] Audit history entry added
`
    },

    "farm-inspect": {
      "SKILL.md": `---
name: farm-inspect
description: Run full code inspection with all audit agents in parallel. Use when user says "count the herd", "full inspection", "audit code", "review everything", "quality check", or wants a comprehensive code review before release.
allowed-tools: Bash(*), Task, Read, Edit, Glob, Grep
---

# Farm Inspect Skill

Full code inspection using all audit agents. Runs quality gates but does NOT push.

## When to Use
- Before releases
- After major changes
- Quality gate checks
- Comprehensive code review

## Workflow

### Step 1: Run Audit Agents (Parallel)
Launch these agents in parallel using the Task tool:

1. **code-quality** - Code review + smell detection
   - Updates \`_AUDIT/CODE_QUALITY.md\`

2. **security-auditor** - OWASP Top 10 scanning
   - Updates \`_AUDIT/SECURITY.md\`

3. **performance-auditor** - Performance anti-patterns
   - Updates \`_AUDIT/PERFORMANCE.md\`

4. **accessibility-auditor** - WCAG 2.1 compliance
   - Updates \`_AUDIT/ACCESSIBILITY.md\`

5. **code-cleaner** - Dead code + comment detection
   - Reports what would be cleaned (dry run)

### Step 1b: Knip Analysis (if enabled)
If knip is installed in the project, run dead code detection:

\\\`\\\`\\\`bash
npx knip --reporter compact
\\\`\\\`\\\`

Include findings:
- Unused files
- Unused dependencies
- Unused exports

### Step 1c: Knip Auto-Fix Prompt (if enabled)
If knip found issues, ask user:
"Would you like to run \\\`knip --fix --allow-remove-files\\\` to automatically fix issues?"

If confirmed, run:
\\\`\\\`\\\`bash
npx knip --fix --allow-remove-files
\\\`\\\`\\\`

**Warning:** This modifies/deletes files. Review changes with \\\`git diff\\\` after running.

### Step 2: Dry Run Quality Gates
Run these commands but do NOT commit or push:

1. **Lint**: Run the configured lint command
2. **Test**: Run the configured test command
3. **Build**: Run the configured build command

### Step 3: Generate Summary Report
Consolidate all findings:
- Critical issues (must fix)
- High priority issues
- Medium priority issues
- Low priority suggestions

## Output Format
\`\`\`
## Full Inspection Complete

### Code Quality
Score: X/10
Issues: X critical, X high, X medium

### Security
Score: X/10
Vulnerabilities: X found

### Performance
Score: X/10
Anti-patterns: X found

### Accessibility
Score: X/10
WCAG issues: X found

### Dead Code (Knip)
- Unused files: X
- Unused deps: X
- Unused exports: X

### Quality Gates
- Lint: ✓/✗
- Tests: ✓/✗
- Build: ✓/✗

### Next Steps
[List of recommended actions]
\`\`\`

## Important
This skill does NOT push changes. Use \`/push\` when ready to commit and push.
`,
      "audit-agents.md": `# Audit Agents Reference

## code-quality
Reviews code for DRY violations, complexity, naming issues, and best practices.

## security-auditor
Scans for OWASP Top 10 vulnerabilities including XSS, injection, and auth issues.

## performance-auditor
Finds memory leaks, unnecessary re-renders, and performance anti-patterns.

## accessibility-auditor
Checks WCAG 2.1 Level AA compliance including alt text, contrast, and keyboard nav.

## code-cleaner
Detects dead code, unused imports, comments, and console.logs.
`
    },

    "garden": {
      "SKILL.md": `---
name: garden
description: Manage the Idea Garden - plant new ideas, water the garden for fresh ideas, compost rejected ones. Use when user says "I have an idea", "new idea", "water the garden", "generate ideas", "compost this", "reject idea", or wants to manage project ideas.
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
2. Enter Plan Mode to create plan in \`_PLANS/\`
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
`
    },

    "research": {
      "SKILL.md": `---
name: research
description: Systematic research before planning - gather documentation, security concerns, tech stack analysis, and community insights. Use when user says "let's research", "research this", "investigate", "look into", or needs to understand a technology or feature before planning.
allowed-tools: Read, Edit, Glob, Grep, Task, WebFetch, WebSearch
---

# Research Skill

Conducts systematic research and creates living documents in \`_RESEARCH/\`.

## When to Use
- Before planning new features
- Evaluating technologies
- Security research
- Understanding dependencies

## Workflow

### Step 1: Parse Research Topic
1. Extract topic from user input
2. Normalize to SCREAMING_SNAKE_CASE for filename
3. Check if \`_RESEARCH/[TOPIC].md\` already exists

### Step 2: Spawn Parallel Research Tasks
Use Task tool to run these in parallel:

**Documentation Research:**
- Find official documentation
- Identify API references
- Locate getting started guides
- Check for migration guides

**Security Research:**
- Search for known CVEs
- Find security advisories
- Identify auth/authz concerns
- Check dependency vulnerabilities

**Tech Stack Analysis:**
- Identify required dependencies
- Check Node.js/browser compatibility
- Analyze bundle size implications
- Find TypeScript definitions

**Community Research:**
- Search GitHub issues for common problems
- Find Stack Overflow discussions
- Identify known gotchas
- Gather performance tips

### Step 3: Consolidate Findings
1. Merge findings into structured document
2. Identify conflicts between sources
3. Assign confidence levels
4. Highlight critical risks

### Step 4: Create/Update Research Document
Save to \`_RESEARCH/[TOPIC].md\` using the template format.

## Research Freshness
- **Fresh** (0-14 days): Current and reliable
- **Aging** (15-30 days): Consider refreshing for major decisions
- **Stale** (30+ days): Update before using in plans

## Output Format
\`\`\`
## Research Complete: [Topic]

### Key Findings
- Finding 1
- Finding 2
- Finding 3

### Critical Risks
- Risk 1 (if any)
- Risk 2 (if any)

### Confidence: High/Medium/Low

Document saved: _RESEARCH/[TOPIC].md

Next steps:
- Review full research document
- "make a plan for..." to create implementation plan
- "update research on..." to gather more information
\`\`\`
`,
      "research-template.md": `# Research Document Template

\`\`\`markdown
# Research: [Topic Name]

> Systematic research findings for informed decision-making.

**Created:** YYYY-MM-DD
**Last Researched:** YYYY-MM-DD
**Status:** Fresh | Aging | Stale
**Confidence:** High | Medium | Low

---

## Summary
[2-3 sentence executive summary]

---

## Official Documentation

| Resource | URL | Notes |
|----------|-----|-------|
| [Name] | [URL] | [Key insight] |

---

## Tech Stack Analysis

### Dependencies
- **package-name** - vX.X.X - [purpose]

### Compatibility
| Environment | Status | Notes |
|-------------|--------|-------|
| Node.js | vX.X+ | |
| Browser | [support] | |

---

## Security Concerns

### Known Vulnerabilities
| CVE/Issue | Severity | Status | Mitigation |
|-----------|----------|--------|------------|
| [ID] | High/Med/Low | Fixed/Open | [action] |

### Best Practices
- Practice 1
- Practice 2

---

## Risks & Gotchas

### Common Pitfalls
1. **[Name]** - Description and avoidance

### Edge Cases
- Case 1
- Case 2

---

## Implementation Recommendations

### Recommended Approach
[Based on research...]

### Alternatives
| Approach | Pros | Cons |
|----------|------|------|
| [Alt] | [pros] | [cons] |

---

## Research History

| Date | Areas Updated |
|------|---------------|
| YYYY-MM-DD | Initial research |
\`\`\`
`
    },

    "production": {
      "SKILL.md": `---
name: production
description: Production readiness check from UX perspective - update BROWNFIELD.md with implemented features, check GREENFIELD alignment, note documentation impacts. Use when user says "go to production", "production check", "ready to ship", "pre-release check", or wants to verify implementation status before deployment.
allowed-tools: Read, Edit, Glob, Grep, Task
---

# Production Skill

Production readiness check focusing on implementation status and strategy alignment.

## When to Use
- Before production deployment
- Feature completion verification
- Strategy alignment check
- Documentation impact assessment

## Workflow

### Step 1: Update BROWNFIELD.md
Scan codebase and update \`_OFFICE/BROWNFIELD.md\`:

1. Identify implemented features:
   - Check routes and pages
   - Find feature directories
   - Look for user-facing components

2. Compare against last production snapshot

3. Document changes:
   - **Added:** New features since last production
   - **Removed:** Features that were removed
   - **Modified:** Significant changes

4. Update Production History table

### Step 2: Check Documentation Impacts
Scan changes against documentation:

**USER_GUIDE.md:**
- List features needing documentation updates
- Identify new features without docs

**ONBOARDING.md:**
- Check if onboarding elements need updates
- Identify new flows without guidance

### Step 3: Check GREENFIELD Alignment
Compare vision against implementation:

1. Read \`_OFFICE/GREENFIELD.md\` (vision)
2. Read \`_OFFICE/BROWNFIELD.md\` (reality)
3. Assess alignment: High / Medium / Low
4. Ask user about any perceived misalignment
5. Document strategy changes if needed

### Step 4: Generate Readiness Report

\`\`\`
## Production Readiness: Implementation Check

### BROWNFIELD Status
- Last Updated: YYYY-MM-DD
- New Features: X added
- Removed Features: X removed
- Modified Features: X changed

### Documentation Impact
- USER_GUIDE.md needs updates: [list or "None"]
- ONBOARDING.md needs updates: [list or "None"]

### Strategy Alignment
- GREENFIELD vision: [summary]
- BROWNFIELD reality: [summary]
- Alignment: High/Medium/Low

### Recommendation
[Ready for production / Needs attention: ...]
\`\`\`

### Step 5: Confirm with User
Ask: "Production check complete. Ready to proceed with deployment?"
Wait for explicit confirmation.

## Important
This skill checks implementation status. Use \`/push\` for code quality gates and pushing to remote.
`,
      "checklist.md": `# Production Readiness Checklist

## Implementation Status
- [ ] All planned features implemented
- [ ] Removed features documented
- [ ] BROWNFIELD.md updated

## Documentation
- [ ] USER_GUIDE.md current
- [ ] ONBOARDING.md current
- [ ] New features documented

## Strategy Alignment
- [ ] GREENFIELD vision reviewed
- [ ] Implementation matches vision
- [ ] Any pivots documented

## Quality (handled by /push)
- [ ] Lint passing
- [ ] Tests passing
- [ ] Build succeeds
`
    },

    "market": {
      "SKILL.md": `---
name: market
description: Internationalization and accessibility audit - scan for hardcoded text, check i18n coverage, run WCAG 2.1 accessibility audit. Use when user says "go to market", "i18n check", "accessibility audit", "translation check", or wants to prepare app for international users.
allowed-tools: Read, Edit, Glob, Grep, Task
---

# Market Skill

Prepare the application for international markets with i18n and accessibility checks.

## When to Use
- Preparing for international launch
- Adding new language support
- Accessibility compliance check
- Before major releases

## Workflow

### Step 1: i18n Scan
1. Search for hardcoded text in components:
   - JSX text content
   - Placeholder attributes
   - Title attributes
   - Alt text (check if translatable)

2. Check for i18n usage patterns:
   - \`t()\` or \`useTranslation\` hooks
   - Translation file coverage
   - Missing translation keys

3. Report hardcoded strings that need i18n

### Step 2: Launch i18n Translator Agent
Spawn \`i18n-locale-translator\` agent to:
- Extract hardcoded text
- Create translation keys
- Generate locale files (en, jp, etc.)
- Update components with translation hooks

### Step 3: Accessibility Audit
Launch \`accessibility-auditor\` agent for WCAG 2.1 Level AA:
- Alt text on images
- Color contrast ratios
- Keyboard navigation
- ARIA labels and roles
- Form accessibility
- Focus management

### Step 4: Update Audit Documents
Update \`_AUDIT/ACCESSIBILITY.md\` with findings.

## Output Format
\`\`\`
## Market Readiness Check

### i18n Status
- Hardcoded strings found: X
- Translation coverage: X%
- Missing translations: [list]

### Accessibility (WCAG 2.1 AA)
Score: X/10
- Critical issues: X
- High priority: X
- Medium priority: X

### Recommendations
- [Action items]

Updated: _AUDIT/ACCESSIBILITY.md
\`\`\`
`
    }
  };

  // Create each skill directory and files
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
description: Clean, stage, lint, test, build, commit, push, and update metrics
argument-hint: [optional: commit message override]
allowed-tools: Bash(find:*), Bash(git:*), Bash(${pm}:*), Bash(npx:*), Task
---

# Push Command

Run code cleanup, all quality gates, commit changes, and push to remote.

## Workflow

Execute these steps in order. **Stop immediately if any step fails.**

### Step 1: Clean Up System Files
Remove any .DS_Store files from the repository:
\`\`\`bash
find . -name '.DS_Store' -type f -delete
\`\`\`

### Step 2: Sync Packages
Clean and reinstall node_modules to ensure package-lock.json stays in sync:
\`\`\`bash
rm -rf node_modules && ${pm} install
\`\`\`
This prevents \`${pm} ci\` failures in CI/CD due to lock file drift.

If package-lock.json was modified, it will be staged in the next step.

### Step 3: Stage All Changes
\`\`\`bash
git add -A
\`\`\`

### Step 4: Check for Changes
Run \`git status\` to verify there are staged changes. If nothing to commit, inform the user and stop.

### Step 5: Clean Code

Run the code-cleaner agent on staged TypeScript files to remove comments and console.logs.

This removes:
- Line comments (\`//\`) and block comments (\`/* */\`)
- \`console.log\` statements

It preserves:
- JSDoc comments (\`/** */\`)
- \`console.error\`, \`console.warn\`, \`console.info\`

After cleaning, re-stage the modified files:
\`\`\`bash
git add -A
\`\`\`

### Step 6: Run Quality Gates (in order)

Run each check. If any fails, stop and report which check failed:

1. **Lint**: \`${answers.lintCommand}\`
2. **Unit Tests**: \`${answers.testCommand}\`
3. **Build**: \`${answers.buildCommand}\`

### Step 7: Generate Commit Message

If \`$ARGUMENTS\` is provided, use it as the commit message.

Otherwise, analyze the staged changes:
1. Run \`git diff --cached --stat\` to see changed files
2. Run \`git diff --cached\` to see actual changes
3. Run \`git log -5 --oneline\` to match the repository's commit style
4. Generate a concise, descriptive commit message that:
   - Starts with a type (feat, fix, refactor, docs, style, test, chore)
   - Summarizes the "why" not the "what"
   - Is 1-2 sentences maximum

### Step 8: Commit and Push

Create the commit with the message, including the standard footer:

\`\`\`
🌽 Generated with FARMWORK
\`\`\`

Then push to remote:
\`\`\`bash
git push
\`\`\`

### Step 9: Update Farmhouse Metrics

Run the-farmer agent to update \`_AUDIT/FARMHOUSE.md\` with current metrics:
- Commands and agents inventory
- Test counts (unit, e2e)
- Completed issues count

This keeps the harness documentation in sync with the codebase.

### Step 10: Report Success

Show a summary:
- Files changed
- Commit hash
- Push status
- Harness metrics updated
`;

  await fs.writeFile(
    path.join(cwd, ".claude", "commands", "push.md"),
    pushCommand,
  );

}

async function createSettings(cwd, answers) {
  // Create settings.local.json with skill activation hook
  const settingsPath = path.join(cwd, ".claude", "settings.local.json");

  // Read existing settings if present
  let settings = {};
  try {
    const existing = await fs.readFile(settingsPath, "utf-8");
    settings = JSON.parse(existing);
  } catch {
    // No existing settings, start fresh
  }

  // Ensure hooks object exists
  if (!settings.hooks) {
    settings.hooks = {};
  }

  // Add UserPromptSubmit hook for skill activation
  // This reminds Claude to check for applicable skills on each user prompt
  settings.hooks.UserPromptSubmit = [
    {
      type: "command",
      command: "echo 'FARMWORK: Check if any skills apply - farm-audit (open the farm), farm-inspect (count the herd), garden (ideas), research, production, market (go to market). Use matching skill if relevant.'"
    }
  ];

  await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));
}

async function createProduceConfig(cwd, answers) {
  const config = {
    version: "1.5.0",
    projectName: answers.projectName,
    commands: {
      test: answers.testCommand,
      build: answers.buildCommand,
      lint: answers.lintCommand,
    },
    features: {
      i18n: answers.includeI18n || false,
      knip: answers.includeKnip || false,
    },
    supplies: answers._selectedSupplies || [],
    audits: ["FARMHOUSE", "SECURITY", "PERFORMANCE", "ACCESSIBILITY", "CODE_QUALITY", "TESTS", "GARDEN", "COMPOST", "RESEARCH", "GREENFIELD", "BROWNFIELD", ...(answers.includeKnip ? ["KNIP"] : [])],
  };

  await fs.writeFile(
    path.join(cwd, ".farmwork.json"),
    JSON.stringify(config, null, 2),
  );
}
