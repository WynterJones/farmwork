import inquirer from "inquirer";
import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import { farmTerm, emojis } from "./terminal.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function detectPackageJson() {
  try {
    const pkgPath = path.join(process.cwd(), "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    return {
      scripts: pkg.scripts || {},
      hasStorybook: !!(
        pkg.devDependencies?.storybook ||
        pkg.dependencies?.storybook ||
        pkg.devDependencies?.["@storybook/react"] ||
        pkg.scripts?.storybook
      ),
    };
  } catch {
    return { scripts: {}, hasStorybook: false };
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
    name: "includeStorybook",
    message: "🐄 Include Storybook support?",
    default: () => detectPackageJson().hasStorybook,
  },
  {
    type: "confirm",
    name: "includeI18n",
    message: "🌻 Include i18n support?",
    default: false,
  },
];

const STORYBOOK_QUESTIONS = [
  {
    type: "input",
    name: "storybookUrl",
    message: "🌿 Storybook URL:",
    default: "storybook.example.com",
  },
  {
    type: "input",
    name: "netlifyAuthToken",
    message: "🗝️ Netlify Auth Token:",
    validate: (input) =>
      input.length > 0 || "Auth token is required for deployment",
  },
  {
    type: "input",
    name: "netlifySiteId",
    message: "🏷️ Netlify Site ID:",
    validate: (input) =>
      input.length > 0 || "Site ID is required for deployment",
  },
  {
    type: "confirm",
    name: "passwordProtect",
    message: "🐕 Password protect Storybook?",
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

  const isAlreadyInstalled =
    fs.existsSync(claudeDir) &&
    (fs.existsSync(farmworkConfig) || fs.existsSync(claudeMd));

  if (isAlreadyInstalled && !options.force) {
    farmTerm.warn("Farmwork is already installed in this project!");
    farmTerm.nl();

    // Show what's detected
    farmTerm.gray("  Detected:\n");
    if (fs.existsSync(claudeDir)) farmTerm.gray("    • .claude/ directory\n");
    if (fs.existsSync(claudeMd)) farmTerm.gray("    • CLAUDE.md\n");
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

  // Storybook configuration
  if (answers.includeStorybook) {
    farmTerm.nl();
    farmTerm.section("Storybook Deployment", "🐄");
    farmTerm.gray(
      "  We recommend deploying Storybook to Netlify with password protection.\n",
    );
    farmTerm.gray(
      "  This keeps your component docs private but accessible to your team.\n\n",
    );

    const storybookAnswers = await inquirer.prompt(STORYBOOK_QUESTIONS);
    Object.assign(answers, storybookAnswers);

    if (answers.passwordProtect) {
      farmTerm.nl();
      farmTerm.warn("Remember to enable password protection in Netlify:");
      farmTerm.gray("  Site settings → Access control → Password protection\n");
    }
  }

  // Check for existing files
  const existingFiles = [];
  const filesToCheck = [
    {
      path: path.join(cwd, "CLAUDE.md"),
      name: "CLAUDE.md",
      backup: "OLD_CLAUDE.md",
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
        },
      },
      { name: "Planting CLAUDE.md", fn: () => createClaudeMd(cwd, answers) },
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
      { name: "Setting up commands", fn: () => createCommands(cwd, answers) },
      { name: "Configuring settings", fn: () => createSettings(cwd, answers) },
      {
        name: "Writing .farmwork.json",
        fn: () => createProduceConfig(cwd, answers),
      },
    ];

    for (const step of steps) {
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

      // Clean up beads-generated files
      const beadsAgentFiles = ["AGENTS.md", "@AGENTS.md"];
      for (const file of beadsAgentFiles) {
        try {
          await fs.remove(path.join(cwd, file));
        } catch {
          // File doesn't exist
        }
      }
    });

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
| **close the farm** | Execute \`/push\` (lint, test, build, commit, push) |

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
| **go to production** | UX production check: update ONBOARDING.md, USER_GUIDE.md, audit CORE_LOOP.md changes |

---

### Farmwork Phrase Details

**open the farm**
1. Launch \`the-farmer\` agent to audit all systems
2. Run \`bd list --status closed | wc -l\` to get total completed issues
3. Updates \`_AUDIT/FARMHOUSE.md\` with current metrics

**count the herd** (Full Audit Cycle)
Runs all inspection agents in parallel, then dry run quality gates. No push.

1. **Code Review & Cleanup** - \`code-reviewer\` + \`unused-code-cleaner\`
2. **Performance Audit** - \`performance-auditor\`, updates \`_AUDIT/PERFORMANCE.md\`
3. **Security Audit** - \`security-auditor\` for OWASP Top 10, updates \`_AUDIT/SECURITY.md\`
4. **Code Quality** - \`code-smell-auditor\` for DRY violations, updates \`_AUDIT/CODE_QUALITY.md\`
5. **Accessibility** - \`accessibility-auditor\` for WCAG 2.1, updates \`_AUDIT/ACCESSIBILITY.md\`
6. **Dry Run** - lint, tests, build (but NOT commit/push)
7. **Summary Report** - Consolidate findings, ask user next steps

**go to market**
1. Scan for hardcoded text not using i18n
2. Launch \`i18n-locale-translator\` agent
3. Launch \`accessibility-auditor\` for WCAG 2.1 compliance
4. Updates \`_AUDIT/ACCESSIBILITY.md\`

**close the farm**
- Invoke the \`push\` skill immediately

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
3. Create plan in \`_PLANS/\` using plan mode
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
5. If ref.tools MCP available: Use \`mcp__Ref__ref_search_documentation\` for docs lookup
6. Consolidate findings into \`_RESEARCH/[TOPIC_NAME].md\`
7. Display summary and suggest next steps

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

**go to production**

Production readiness check from a user experience perspective. Separate from "close the farm" (which handles code quality/push).

1. **Update ONBOARDING.md**
   - Spawn \`onboarding-agent\` to scan for onboarding elements
   - Check for incomplete or missing onboarding flows
   - Update Last Updated date
   - Add changelog entry if changes found

2. **Update USER_GUIDE.md**
   - Spawn \`user-guide-agent\` to scan for undocumented features
   - Check for placeholder text or incomplete sections
   - Update feature count
   - Add changelog entry if changes found

3. **Audit CORE_LOOP.md**
   - Spawn \`strategy-agent\` to check if CORE_LOOP.md has changed since last production check
   - If changed, add audit trail entry to Strategy Changelog
   - Report strategy evolution summary

4. **Generate Production Readiness Report**
   \`\`\`
   ## Production Readiness: User Experience

   ### Strategy Status
   - Last Updated: YYYY-MM-DD
   - Changes Since Last Deploy: Yes/No
   - Confidence: High/Medium/Low

   ### Onboarding Status
   - Elements: X documented
   - Gaps: X identified
   - Empty States: X complete

   ### Documentation Status
   - Features Documented: X
   - Quick Start: Complete/Incomplete
   - FAQ: X entries

   ### Recommendation
   [Ready for production / Needs attention: ...]
   \`\`\`

5. **Ask for Confirmation**
   - "UX production check complete. Ready to proceed with deployment?"
   - Wait for user confirmation before any further action

**Note:** This phrase focuses on UX readiness. Use "close the farm" for code quality gates and pushing to remote.

---

## Plan Mode Protocol

**CRITICAL**: When Claude enters Plan Mode, ALL plans MUST:

### Step 1: Save Plan to \`_PLANS/\`
Before exiting plan mode, the plan MUST be saved to \`_PLANS/<FEATURE_NAME>.md\`:
- Use SCREAMING_SNAKE_CASE for filename
- Include: overview, technical approach, files to modify, implementation steps, risks

### Step 2: Exit Plan Mode & Create Epic
After user approves:
1. Exit plan mode
2. Create a beads Epic
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

## Tips for Claude Code

### When Working on Features
- Always check justfile: \`just --list\`
- Create issues before starting work
- Use "make a plan for..." for non-trivial features

### Before Committing
\`\`\`bash
${answers.lintCommand}    # Check code quality
${answers.buildCommand}   # Verify compilation
\`\`\`
`;

  await fs.writeFile(path.join(cwd, "CLAUDE.md"), content);
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
| Agents | 15 |
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
| \`/office\` | Interactive strategy and UX command - updates CORE_LOOP, ONBOARDING, USER_GUIDE |

---

## Agents (\`.claude/agents/\`)

| Agent | Purpose |
|-------|---------|
| \`the-farmer\` | Audit and update FARMHOUSE.md metrics |
| \`code-reviewer\` | Quality & security code review |
| \`security-auditor\` | OWASP vulnerability scanning |
| \`performance-auditor\` | Performance anti-patterns |
| \`code-smell-auditor\` | DRY violations, complexity, naming |
| \`accessibility-auditor\` | WCAG 2.1 compliance, alt text, contrast |
| \`unused-code-cleaner\` | Detect and remove dead code |
| \`code-cleaner\` | Remove comments and console.logs |
| \`i18n-locale-translator\` | Translate UI text to locales |
| \`storybook-maintainer\` | Create/update Storybook stories |
| \`idea-gardener\` | Manage Idea Garden and Compost |
| \`researcher\` | Systematic research before planning |
| \`strategy-agent\` | Analyze core loop strategy (what/stopping/why) |
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
| \`go to production\` | UX production check: update _OFFICE/ docs |

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
}

async function createOfficeDocs(cwd, answers) {
  const today = new Date().toISOString().split("T")[0];

  // Create CORE_LOOP.md - Strategy document
  const coreLoopContent = `# Core Loop Strategy

> Treat your product like a game. Define what users are doing, what's stopping them, and why they're doing it.
> This is a living strategy document - update it as your understanding evolves.

**Last Updated:** ${today}
**Status:** Initial setup
**Confidence:** Low

---

## The Three Questions

### 1. What are they doing?
_What is the primary action or loop your users engage in?_

**Current Understanding:**
[Describe the core user action/loop]

### 2. What's stopping them?
_What friction, obstacles, or pain points prevent users from succeeding?_

**Current Blockers:**
- [Blocker 1]
- [Blocker 2]

### 3. Why are they doing it?
_What motivates users? What's the deeper goal or reward?_

**User Motivation:**
[Describe the underlying motivation]

---

## Core Loop Diagram

\`\`\`
[Entry Point] → [Core Action] → [Reward/Feedback] → [Loop Back]
\`\`\`

---

## Strategy Changelog

| Date | Change | Previous | Reason |
|------|--------|----------|--------|
| ${today} | Initial strategy setup | - | Created via farmwork init |

---

## Related Documents

- [ONBOARDING.md](./_OFFICE/ONBOARDING.md) - First-time user experience
- [USER_GUIDE.md](./_OFFICE/USER_GUIDE.md) - Feature documentation
`;

  await fs.writeFile(path.join(cwd, "_OFFICE", "CORE_LOOP.md"), coreLoopContent);

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

_No features documented yet. Run \`/office\` to add features._

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
    "code-reviewer.md": `---
name: code-reviewer
description: Review code for quality, security, and maintainability
tools: Read, Grep, Glob, Bash
model: opus
---

# Code Reviewer Agent

Reviews staged/modified files for:
- Security vulnerabilities
- Performance issues
- Code quality problems
- Best practice violations

Reports findings with severity (CRITICAL, HIGH, MEDIUM, LOW) and remediation steps.
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
    "code-smell-auditor.md": `---
name: code-smell-auditor
description: Detect DRY violations, complexity issues, naming problems, and technical debt
tools: Read, Grep, Glob, Edit
model: opus
---

# Code Smell Auditor Agent

Scans for code quality issues:
- DRY violations (duplicated code)
- Complexity issues (functions > 50 lines, deep nesting)
- Naming issues (misleading names, abbreviations)
- Magic values (hardcoded numbers/strings)
- Technical debt (TODO, FIXME, HACK comments)

Reports code health as GOOD / FAIR / NEEDS ATTENTION.
Updates \`_AUDIT/CODE_QUALITY.md\` with results.
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
    "unused-code-cleaner.md": `---
name: unused-code-cleaner
description: Detect and remove unused code (imports, functions, variables)
tools: Read, Write, Edit, Bash, Grep, Glob
model: opus
---

# Unused Code Cleaner Agent

Detects and removes unused code:
- Unused imports
- Unused functions and classes
- Unused variables
- Dead code paths
- Console.log statements (optional)
- Comments (preserves JSDoc)

Use after refactoring, when removing features, or before production deployment.
`,
    "code-cleaner.md": `---
name: code-cleaner
description: Fast removal of comments, console.logs, and debug code while preserving JSDoc
tools: Read, Edit, Glob, Grep
model: opus
---

# Code Cleaner Agent

Fast cleanup of TypeScript/JavaScript files:

## Removes
- Line comments (\`//\`)
- Block comments (\`/* */\`)
- \`console.log\` statements

## Preserves
- JSDoc comments (\`/** */\`)
- \`console.error\`, \`console.warn\`, \`console.info\`
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
    "storybook-maintainer.md": `---
name: storybook-maintainer
description: Create and update Storybook stories for UI components
tools: Read, Write, Edit, Glob, Grep
model: opus
---

# Storybook Maintainer Agent

Manages Storybook stories for UI components:
- Analyze component props and variants
- Create comprehensive story files
- Document component usage
- Add controls for interactive props

Use when adding new components or when existing components change significantly.
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
description: Analyze and update the core loop strategy - what users do, what stops them, why they do it
tools: Read, Edit, Glob, Grep, Task
model: opus
---

# Strategy Agent

Maintains \`_OFFICE/CORE_LOOP.md\` - the living strategy document for product thinking.

## Core Responsibility

Treat the product like a game and answer three fundamental questions:
1. **What are they doing?** - The primary user action/loop
2. **What's stopping them?** - Friction and obstacles
3. **Why are they doing it?** - Underlying motivation and rewards

## Instructions

### When Invoked via /office

1. Read \`_OFFICE/CORE_LOOP.md\` to understand current strategy
2. Read the codebase to understand the product (components, routes, features)
3. Ask the user probing questions:
   - "What's the main thing users do in your app?"
   - "Where do users get stuck or confused?"
   - "What's the 'aha moment' for users?"
   - "What brings users back?"
4. Update CORE_LOOP.md with insights
5. Add entry to Strategy Changelog table

### When Checking for Production ("go to production")

1. Read \`_OFFICE/CORE_LOOP.md\`
2. Compare current date to Last Updated date
3. If changed since last production push:
   - Summarize strategy changes
   - Add audit entry to changelog
4. Report strategy status

## Output Format

\`\`\`
## Strategy Analysis

### Core Loop
[Describe the identified core loop]

### Key Friction Points
- [Friction 1]
- [Friction 2]

### User Motivation
[Describe why users engage]

### Recommendations
- [Recommendation 1]
- [Recommendation 2]

Updated _OFFICE/CORE_LOOP.md
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

### When Invoked via /office

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

### When Invoked via /office

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

async function createCommands(cwd, answers) {
  const pm = answers.packageManager || "npm";

  const storybookSteps = answers.includeStorybook
    ? `

### Step 9: Deploy Storybook to Netlify

Deploy the Storybook documentation site:
\`\`\`bash
npx netlify deploy --dir=storybook-static --site=$NETLIFY_STORYBOOK_SITE_ID --prod
\`\`\`

Note: Requires \`NETLIFY_AUTH_TOKEN\` and \`NETLIFY_STORYBOOK_SITE_ID\` in \`.claude/settings.local.json\`.
If not configured, skip this step and inform the user to add the env vars.

Storybook URL: https://${answers.storybookUrl || "storybook.example.com"}
${answers.passwordProtect ? "**Note:** This Storybook is password protected." : ""}
`
    : "";

  const pushCommand = `---
description: Clean, stage, lint, test, build, commit, push, and update metrics
argument-hint: [optional: commit message override]
allowed-tools: Bash(find:*), Bash(git:*), Bash(${pm}:*), Bash(npx:*)${answers.includeStorybook ? ", Bash(npx netlify:*)" : ""}, Task
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

1. **Lint**: \`${answers.lintCommand}\`${answers.includeStorybook ? `\n2. **Storybook**: \`${pm} run build-storybook\`` : ""}
${answers.includeStorybook ? "3" : "2"}. **Unit Tests**: \`${answers.testCommand}\`
${answers.includeStorybook ? "4" : "3"}. **Build**: \`${answers.buildCommand}\`

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
${storybookSteps}
### Step 10: Update Farmhouse Metrics

Run the-farmer agent to update \`_AUDIT/FARMHOUSE.md\` with current metrics:
- Commands and agents inventory
- Test counts (unit, e2e)
- Completed issues count

This keeps the harness documentation in sync with the codebase.

### Step 11: Report Success

Show a summary:
- Files changed
- Commit hash
- Push status${answers.includeStorybook ? "\n- Storybook deploy status (if deployed)" : ""}
- Harness metrics updated
`;

  await fs.writeFile(
    path.join(cwd, ".claude", "commands", "push.md"),
    pushCommand,
  );

  // Create /office command
  const officeCommand = `---
description: Interactive strategy and user experience command - updates CORE_LOOP, ONBOARDING, and USER_GUIDE
argument-hint: [optional: focus area - strategy|onboarding|guide|all]
allowed-tools: Read, Edit, Glob, Grep, Task
---

# Office Command

Interactive command for product strategy and user experience documentation.
Updates all three \`_OFFICE/\` documents based on user answers.

## Usage

\`\`\`
/office           # Run full office check (all areas)
/office strategy  # Focus on core loop strategy
/office onboarding # Focus on onboarding elements
/office guide     # Focus on user documentation
\`\`\`

## Workflow

### Step 1: Determine Focus Area

If \`$ARGUMENTS\` is provided, focus on that area:
- \`strategy\` or \`core\` or \`loop\` → Core loop only
- \`onboarding\` or \`tour\` or \`welcome\` → Onboarding only
- \`guide\` or \`docs\` or \`help\` → User guide only
- \`all\` or empty → All three areas

### Step 2: Run Strategy Analysis (if applicable)

Spawn \`strategy-agent\` subagent to:
1. Read current \`_OFFICE/CORE_LOOP.md\`
2. Analyze the codebase to understand the product
3. Ask user questions about the core loop:
   - "What is the main action users take in your app?"
   - "What prevents users from succeeding?"
   - "What motivates users to return?"
4. Update CORE_LOOP.md with findings
5. Add changelog entry

### Step 3: Run Onboarding Analysis (if applicable)

Spawn \`onboarding-agent\` subagent to:
1. Read current \`_OFFICE/ONBOARDING.md\`
2. Scan codebase for onboarding elements:
   - Tour libraries (react-joyride, shepherd.js, intro.js)
   - Modal/popup components
   - Tooltip implementations
   - Empty state components
3. Ask user questions:
   - "What should new users see first?"
   - "What's the key 'aha moment'?"
   - "Any existing tours or tooltips?"
4. Update ONBOARDING.md tables
5. Add changelog entry

### Step 4: Run User Guide Analysis (if applicable)

Spawn \`user-guide-agent\` subagent to:
1. Read current \`_OFFICE/USER_GUIDE.md\`
2. Scan codebase for features:
   - Routes and pages
   - User-facing components
   - Keyboard shortcuts
3. Ask user questions:
   - "What are the main features?"
   - "Common user questions?"
   - "Any shortcuts to document?"
4. Create/update feature documentation blocks
5. Add changelog entry

### Step 5: Generate Summary Report

Display a summary of all updates:

\`\`\`
## Office Update Complete

### Core Loop Strategy
- Updated: Yes/No
- Confidence: High/Medium/Low
- Changes: [summary of changes]

### Onboarding
- Elements Found: X
- Gaps Identified: X
- Changes: [summary of changes]

### User Guide
- Features Documented: X
- Missing: X
- Changes: [summary of changes]

### Next Steps
- [ ] Review _OFFICE/CORE_LOOP.md
- [ ] Add missing onboarding elements
- [ ] Document new features
\`\`\`

## Interactive Question Flow

The /office command uses a conversational approach:

1. **Introduction**: "Let's update your product office documents. I'll ask some questions about your product strategy and user experience."

2. **Strategy Questions** (if running strategy):
   - "In one sentence, what do users primarily DO in your app?"
   - "What's the biggest friction point or obstacle for users?"
   - "What's the core reward or motivation that keeps users engaged?"

3. **Onboarding Questions** (if running onboarding):
   - "Describe what a new user sees on their first visit"
   - "What's the 'aha moment' you want to guide new users to?"
   - "Do you have any guided tours, tooltips, or welcome modals?"

4. **Guide Questions** (if running guide):
   - "What are the top 3-5 features users should know about?"
   - "What questions do users commonly ask?"
   - "Are there keyboard shortcuts or power-user features?"

5. **Confirmation**: Ask user to confirm updates before writing to files.
`;

  await fs.writeFile(
    path.join(cwd, ".claude", "commands", "office.md"),
    officeCommand,
  );
}

async function createSettings(cwd, answers) {
  if (answers.includeStorybook && answers.netlifyAuthToken) {
    const localSettings = {
      env: {
        NETLIFY_AUTH_TOKEN: answers.netlifyAuthToken,
        NETLIFY_STORYBOOK_SITE_ID: answers.netlifySiteId,
      },
    };

    await fs.writeFile(
      path.join(cwd, ".claude", "settings.local.json"),
      JSON.stringify(localSettings, null, 2),
    );

    const gitignorePath = path.join(cwd, ".gitignore");
    let gitignoreContent = "";
    try {
      gitignoreContent = await fs.readFile(gitignorePath, "utf-8");
    } catch {
      // .gitignore doesn't exist yet
    }

    const entriesToAdd = [".claude/settings.local.json", "storybook-static/"];

    const linesToAdd = entriesToAdd.filter(
      (entry) => !gitignoreContent.includes(entry),
    );

    if (linesToAdd.length > 0) {
      const newContent =
        gitignoreContent.trim() +
        (gitignoreContent.trim() ? "\n\n" : "") +
        "# Farmwork - Storybook deployment\n" +
        linesToAdd.join("\n") +
        "\n";
      await fs.writeFile(gitignorePath, newContent);
    }
  }
}

async function createProduceConfig(cwd, answers) {
  const config = {
    version: "1.2.0",
    projectName: answers.projectName,
    commands: {
      test: answers.testCommand,
      build: answers.buildCommand,
      lint: answers.lintCommand,
    },
    features: {
      storybook: answers.includeStorybook || false,
      i18n: answers.includeI18n || false,
    },
    audits: ["FARMHOUSE", "SECURITY", "PERFORMANCE", "ACCESSIBILITY", "CODE_QUALITY", "TESTS", "GARDEN", "COMPOST", "RESEARCH"],
  };

  if (answers.includeStorybook) {
    config.storybook = {
      url: answers.storybookUrl || null,
      passwordProtected: answers.passwordProtect || false,
      deployCommand:
        "npx netlify deploy --dir=storybook-static --site=$NETLIFY_STORYBOOK_SITE_ID --prod",
    };
  }

  await fs.writeFile(
    path.join(cwd, ".farmwork.json"),
    JSON.stringify(config, null, 2),
  );
}
