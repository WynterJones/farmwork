import inquirer from "inquirer";
import chalk from "chalk";
import ora from "ora";
import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMPLATES_DIR = path.join(__dirname, "..", "templates");

// Try to detect package.json info
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
    message: "Project name:",
    default: path.basename(process.cwd()),
  },
  {
    type: "list",
    name: "packageManager",
    message: "Package manager:",
    choices: ["npm", "yarn", "pnpm", "bun"],
  },
  {
    type: "input",
    name: "testCommand",
    message: "Test command:",
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
    message: "Build command:",
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
    message: "Lint command:",
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
    message: "Include Storybook support? (React/Vue component docs)",
    default: () => detectPackageJson().hasStorybook,
  },
  {
    type: "confirm",
    name: "includeI18n",
    message: "Include i18n support? (multi-language translations)",
    default: false,
  },
];

const STORYBOOK_QUESTIONS = [
  {
    type: "input",
    name: "storybookUrl",
    message: "Storybook URL (e.g., storybook.yoursite.com):",
    default: "storybook.example.com",
  },
  {
    type: "input",
    name: "netlifyAuthToken",
    message: "Netlify Auth Token (from netlify.com/user/applications):",
    validate: (input) =>
      input.length > 0 || "Auth token is required for deployment",
  },
  {
    type: "input",
    name: "netlifySiteId",
    message: "Netlify Site ID (from site settings):",
    validate: (input) =>
      input.length > 0 || "Site ID is required for deployment",
  },
  {
    type: "confirm",
    name: "passwordProtect",
    message: "Password protect Storybook? (Recommended for private components)",
    default: true,
  },
];

export async function init(options) {
  const cwd = process.cwd();

  console.log(chalk.cyan("\n🌽 Farmwork Initialization\n"));

  const answers = await inquirer.prompt(QUESTIONS);

  // Ask Storybook deployment questions if Storybook is enabled
  if (answers.includeStorybook) {
    console.log(chalk.cyan("\n🍇 Storybook Deployment Configuration\n"));
    console.log(
      chalk.gray(
        "We recommend deploying Storybook to Netlify with password protection.",
      ),
    );
    console.log(
      chalk.gray(
        "This keeps your component documentation private while accessible to your team.\n",
      ),
    );

    const storybookAnswers = await inquirer.prompt(STORYBOOK_QUESTIONS);
    Object.assign(answers, storybookAnswers);

    if (answers.passwordProtect) {
      console.log(
        chalk.yellow("\n🍋 Remember to enable password protection in Netlify:"),
      );
      console.log(
        chalk.gray("   Site settings → Access control → Password protection"),
      );
    }
  }

  // Check for existing files that would be overwritten
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
      path: path.join(cwd, ".claude", "settings.json"),
      name: ".claude/settings.json",
      backup: ".claude/OLD_settings.json",
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
    console.log(chalk.yellow("\n🍋 The following files/folders already exist:"));
    for (const file of existingFiles) {
      if (file.isDir) {
        console.log(chalk.gray(`   - ${file.name}`) + chalk.dim(" (will add new files)"));
      } else if (file.backup) {
        console.log(chalk.gray(`   - ${file.name}`) + chalk.dim(` (will backup to ${file.backup})`));
      } else {
        console.log(chalk.gray(`   - ${file.name}`) + chalk.dim(" (will overwrite)"));
      }
    }
    console.log("");

    const { overwriteChoice } = await inquirer.prompt([
      {
        type: "list",
        name: "overwriteChoice",
        message: "How would you like to proceed?",
        choices: [
          {
            name: "Continue (backup files, add to existing folders)",
            value: "overwrite",
          },
          { name: "Cancel installation", value: "cancel" },
        ],
      },
    ]);

    if (overwriteChoice === "cancel") {
      console.log(chalk.gray("\nInstallation cancelled."));
      process.exit(0);
    }

    // Backup files that have backup paths
    console.log("");
    for (const file of existingFiles) {
      if (file.backup) {
        const backupPath = path.join(cwd, file.backup);
        await fs.copy(file.path, backupPath);
        console.log(chalk.gray(`   Backed up ${file.name} → ${file.backup}`));
        if (file.name === "CLAUDE.md") {
          didBackupClaudeMd = true;
        }
      }
    }
    console.log("");
  }

  // Store for use in final output
  answers._didBackupClaudeMd = didBackupClaudeMd;

  const spinner = ora("Creating Farmwork structure...").start();

  try {
    // Create folder structure
    await fs.ensureDir(path.join(cwd, "_AUDIT"));
    await fs.ensureDir(path.join(cwd, "_PLANS"));
    await fs.ensureDir(path.join(cwd, ".claude", "commands"));
    await fs.ensureDir(path.join(cwd, ".claude", "agents"));

    spinner.text = "Creating CLAUDE.md...";
    await createClaudeMd(cwd, answers);

    spinner.text = "Creating FARMHOUSE.md...";
    await createFarmhouseMd(cwd, answers);

    spinner.text = "Creating audit documents...";
    await createAuditDocs(cwd, answers);

    spinner.text = "Creating justfile...";
    await createJustfile(cwd, answers);

    spinner.text = "Creating core agents...";
    await createAgents(cwd, answers);

    spinner.text = "Creating core commands...";
    await createCommands(cwd, answers);

    spinner.text = "Creating settings...";
    await createSettings(cwd, answers);

    spinner.text = "Creating .farmwork.json...";
    await createProduceConfig(cwd, answers);

    // Check and install just if needed
    spinner.text = "Checking for just command runner...";
    try {
      const { execSync } = await import("child_process");
      try {
        execSync("which just", { stdio: "ignore" });
      } catch {
        spinner.text = "Installing just...";
        try {
          // Try brew first (macOS), then cargo
          try {
            execSync("brew install just", { stdio: "inherit" });
            console.log(
              chalk.green("\n🌱 Just installed successfully via Homebrew"),
            );
          } catch {
            execSync("cargo install just", { stdio: "inherit" });
            console.log(
              chalk.green("\n🌱 Just installed successfully via Cargo"),
            );
          }
        } catch {
          console.log(
            chalk.yellow("\n🍋 Could not install just automatically."),
          );
          console.log(chalk.gray("   Install manually: brew install just"));
          console.log(chalk.gray("   Or see: https://github.com/casey/just"));
        }
      }
    } catch (e) {
      // Silently continue if check fails
    }

    spinner.text = "Setting up beads issue tracking...";
    try {
      const { execSync } = await import("child_process");

      // Check if bd is installed
      try {
        execSync("which bd", { stdio: "ignore" });
      } catch {
        // bd not found, try to install it (npm first, then brew, then cargo)
        spinner.text = "Installing beads (bd)...";
        let installed = false;

        // Try npm first (most common)
        try {
          execSync("npm install -g @beads/bd", { stdio: "inherit" });
          console.log(chalk.green("\n🌱 Beads installed successfully via npm"));
          installed = true;
        } catch {
          // Try homebrew
          try {
            execSync("brew install steveyegge/beads/bd", { stdio: "inherit" });
            console.log(
              chalk.green("\n🌱 Beads installed successfully via Homebrew"),
            );
            installed = true;
          } catch {
            // Try cargo as last resort
            try {
              execSync("cargo install beads", { stdio: "inherit" });
              console.log(
                chalk.green("\n🌱 Beads installed successfully via Cargo"),
              );
              installed = true;
            } catch {
              // All methods failed
            }
          }
        }

        if (!installed) {
          console.log(
            chalk.yellow("\n🍋 Could not install beads automatically."),
          );
          console.log(
            chalk.gray("   Install manually: npm install -g @beads/bd"),
          );
          console.log(chalk.gray("   Or: brew install steveyegge/beads/bd"));
          console.log(
            chalk.gray("   Or see: https://github.com/steveyegge/beads"),
          );
        }
      }

      // Initialize beads in the project
      spinner.text = "Initializing beads...";
      try {
        execSync("bd init", { cwd, stdio: "ignore" });
      } catch {
        // bd init might fail if already initialized or not installed
      }

      // Clean up beads-generated agent files (we use CLAUDE.md instead)
      spinner.text = "Cleaning up beads defaults...";
      const beadsAgentFiles = ["AGENTS.md", "@AGENTS.md"];
      for (const file of beadsAgentFiles) {
        const filePath = path.join(cwd, file);
        try {
          await fs.remove(filePath);
        } catch {
          // File doesn't exist, ignore
        }
      }
    } catch (e) {
      console.log(
        chalk.yellow(
          "\n🍋 Could not set up beads. Install with: cargo install beads",
        ),
      );
    }

    spinner.succeed(chalk.green("Farmwork initialized!"));

    console.log(chalk.cyan("\n🌱 Created structure:"));
    console.log(`   ${chalk.green("🌱")} _AUDIT/`);
    console.log(`   ${chalk.green("🌱")} _PLANS/`);
    console.log(`   ${chalk.green("🌱")} .claude/commands/`);
    console.log(`   ${chalk.green("🌱")} .claude/agents/`);
    console.log(`   ${chalk.green("🌱")} CLAUDE.md`);
    console.log(`   ${chalk.green("🌱")} justfile`);
    console.log(`   ${chalk.green("🌱")} .farmwork.json`);

    console.log(chalk.cyan("\n🥕 Next steps:"));
    console.log(
      `   1. Run ${chalk.yellow("just --list")} to see available commands`,
    );
    console.log(
      `   2. Say ${chalk.yellow('"till the land"')} to Claude to audit your setup`,
    );
    console.log(
      `   3. Say ${chalk.yellow('"make a plan for <feature>"')} to start planning`,
    );

    console.log(chalk.cyan("\n🌾 Now let Claude Code get comfortable!"));
    console.log(chalk.gray("   Copy and paste this prompt to Claude Code:\n"));
    console.log(
      chalk.white(
        "   ┌─────────────────────────────────────────────────────────────────────────┐",
      ),
    );
    console.log(
      chalk.white("   │") +
        chalk.yellow(
          " Hey Claude, I am using the Farmwork framework, please go through the    ",
        ) +
        chalk.white("│"),
    );
    console.log(
      chalk.white("   │") +
        chalk.yellow(
          " justfile and create project-specific commands, and go through my app    ",
        ) +
        chalk.white("│"),
    );
    console.log(
      chalk.white("   │") +
        chalk.yellow(
          " and suggest any project-specific subagents that would work well.        ",
        ) +
        chalk.white("│"),
    );
    console.log(
      chalk.white(
        "   └─────────────────────────────────────────────────────────────────────────┘",
      ),
    );

    // Show merge prompt if we backed up CLAUDE.md
    if (answers._didBackupClaudeMd) {
      console.log(chalk.cyan("\n🥬 Merge your old instructions!"));
      console.log(
        chalk.gray(
          "   Your old CLAUDE.md was backed up. Use this prompt to merge:\n",
        ),
      );
      console.log(
        chalk.white(
          "   ┌─────────────────────────────────────────────────────────────────────────┐",
        ),
      );
      console.log(
        chalk.white("   │") +
          chalk.yellow(
            " Hey Claude, look at my CLAUDE.md file and merge the project-specific   ",
          ) +
          chalk.white("│"),
      );
      console.log(
        chalk.white("   │") +
          chalk.yellow(
            " instructions from OLD_CLAUDE.md into it, so I have one file with all   ",
          ) +
          chalk.white("│"),
      );
      console.log(
        chalk.white("   │") +
          chalk.yellow(
            " the Farmwork framework instructions plus my original project setup.    ",
          ) +
          chalk.white("│"),
      );
      console.log(
        chalk.white("   │") +
          chalk.yellow(
            " Then delete OLD_CLAUDE.md when done. Same for OLD_justfile. Thank you.                                   ",
          ) +
          chalk.white("│"),
      );
      console.log(
        chalk.white(
          "   └─────────────────────────────────────────────────────────────────────────┘",
        ),
      );
    }

    console.log("");
  } catch (error) {
    spinner.fail(chalk.red("Failed to initialize Farmwork"));
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
| **till the land** | Audit systems, update \`_AUDIT/FARMHOUSE.md\` with current metrics |
| **inspect the farm** | Full inspection: code review, cleanup, performance, security, code quality |
| **go to market** | i18n scan + translator for missing translations |
| **harvest crops** | Execute \`/push\` (lint, test, build, commit, push) |
| **open the farm** | Full audit cycle (everything except push), then ask to proceed |

---

### Plan Phrases

| Phrase | Action |
|--------|--------|
| **make a plan for...** | Investigate codebase, create plan, save to \`_PLANS/*.md\` |
| **let's implement...** | Load plan from \`_PLANS/*.md\`, create Epic + issues, confirm, start work |

---

### Farmwork Phrase Details

**till the land**
1. Launch \`the-farmer\` agent to audit all systems
2. Run \`bd list --status closed | wc -l\` to get total completed issues
3. Updates \`_AUDIT/FARMHOUSE.md\` with current metrics

**inspect the farm** (Full Inspection)
Runs all inspection agents in parallel:
1. **Code Review & Cleanup** - \`code-reviewer\` + \`unused-code-cleaner\`
2. **Performance Audit** - Tests + \`performance-auditor\`, updates \`_AUDIT/PERFORMANCE.md\`
3. **Security Audit** - \`security-auditor\` for OWASP Top 10, updates \`_AUDIT/SECURITY.md\`
4. **Code Quality** - \`code-smell-auditor\` for DRY violations, updates \`_AUDIT/CODE_QUALITY.md\`
5. **Summary Report** - Consolidate findings

**harvest crops**
- Invoke the \`push\` skill immediately

**open the farm** (Full Audit Cycle)
1. **Till the Land** - Run \`the-farmer\` agent
2. **Inspect the Farm** - Full inspection (code review, cleanup, performance, security, code quality)
3. **Dry Run Harvest** - Run lint, tests, build (but NOT commit/push)
4. **Summary Report** - Present consolidated findings
5. **Ask User** - Ready to harvest (push)?

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
> Updated automatically by \`the-farmer\` agent during \`/push\` or via "till the land" phrase.

**Last Updated:** ${today}
**Score:** 5.0/10
**Status:** Initial setup

---

## Quick Metrics

| Metric | Count |
|--------|-------|
| Commands | 1 |
| Agents | 4 |
| Justfile Recipes | 10 |
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
| \`/push\` | Clean, lint, test, build, commit, push |

---

## Agents (\`.claude/agents/\`)

| Agent | Purpose |
|-------|---------|
| \`the-farmer\` | Audit and update FARMHOUSE.md metrics |
| \`code-reviewer\` | Quality & security code review |
| \`security-auditor\` | OWASP vulnerability scanning |
| \`performance-auditor\` | Performance anti-patterns |

---

## Phrase Commands

### Farmwork Phrases

| Phrase | Action |
|--------|--------|
| \`till the land\` | Audit systems, update FARMHOUSE.md |
| \`inspect the farm\` | Full inspection: code review, cleanup, performance, security, code quality |
| \`go to market\` | i18n scan + translator |
| \`harvest crops\` | Execute /push |
| \`open the farm\` | Full audit cycle |

### Plan Phrases

| Phrase | Action |
|--------|--------|
| \`make a plan for...\` | Create plan in _PLANS/ |
| \`let's implement...\` | Load plan, create Epic |

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
model: haiku
---

# The Farmer Agent

Maintains \`_AUDIT/FARMHOUSE.md\` - the living document tracking all systems and health.

## Instructions

1. Count commands: \`ls -1 .claude/commands/*.md | wc -l\`
2. Count agents: \`ls -1 .claude/agents/*.md | wc -l\`
3. Count tests: \`find . -name "*.test.*" | wc -l\`
4. Count completed issues: \`bd list --status closed | wc -l\`
5. Update FARMHOUSE.md with fresh metrics
6. Update score based on completeness

## Output Format

\`\`\`
## Farmhouse Audit Complete

### Metrics Updated
- Commands: X total
- Agents: X total
- Tests: X files
- Completed Issues: X total

### Score: X/10
\`\`\`
`,
    "code-reviewer.md": `---
name: code-reviewer
description: Review code for quality, security, and maintainability
tools: Read, Grep, Glob, Bash
model: sonnet
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
tools: Read, Grep, Glob
model: sonnet
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
tools: Read, Grep, Glob
model: sonnet
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
  };

  for (const [filename, content] of Object.entries(agents)) {
    await fs.writeFile(path.join(cwd, ".claude", "agents", filename), content);
  }
}

async function createCommands(cwd, answers) {
  const pm = answers.packageManager || "npm";

  // Build Storybook deployment steps if enabled
  const storybookSteps = answers.includeStorybook
    ? `

### Step 6: Build & Deploy Storybook

Build Storybook for production:
\`\`\`bash
${pm} run build-storybook
\`\`\`

Deploy to Netlify (requires NETLIFY_AUTH_TOKEN and NETLIFY_STORYBOOK_SITE_ID in .claude/settings.local.json):
\`\`\`bash
npx netlify deploy --dir=storybook-static --site=$NETLIFY_STORYBOOK_SITE_ID --prod
\`\`\`

Storybook URL: https://${answers.storybookUrl || "storybook.example.com"}
${answers.passwordProtect ? "**Note:** This Storybook is password protected." : ""}
`
    : "";

  const finalStep = answers.includeStorybook
    ? "### Step 7: Report Success"
    : "### Step 6: Report Success";
  const reportContent = answers.includeStorybook
    ? `
Show summary:
- Files changed
- Commit hash
- Push status
- Storybook deploy status
`
    : `
Show summary:
- Files changed
- Commit hash
- Push status
`;

  const pushCommand = `---
description: Clean, lint, test, build, commit, and push${answers.includeStorybook ? " (+ deploy Storybook)" : ""}
allowed-tools: Bash(git:*), Bash(${pm}:*), Bash(npx:*)
---

# Push Command

Run quality gates, commit changes, and push to remote.${answers.includeStorybook ? " Then deploy Storybook." : ""}

## Workflow

Execute these steps in order. **Stop immediately if any step fails.**

### Step 1: Stage All Changes
\`\`\`bash
git add -A
\`\`\`

### Step 2: Check for Changes
Run \`git status\` to verify there are staged changes. If nothing to commit, stop.

### Step 3: Run Quality Gates

1. **Lint**: \`${answers.lintCommand}\`
2. **Tests**: \`${answers.testCommand}\`
3. **Build**: \`${answers.buildCommand}\`

### Step 4: Generate Commit Message

Analyze staged changes and generate a concise commit message:
- Starts with a type (feat, fix, refactor, docs, style, test, chore)
- Summarizes the "why" not the "what"
- 1-2 sentences maximum

### Step 5: Commit and Push

Create the commit with footer:

\`\`\`
🌽 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
\`\`\`

Then push: \`git push\`
${storybookSteps}
${finalStep}
${reportContent}`;

  await fs.writeFile(
    path.join(cwd, ".claude", "commands", "push.md"),
    pushCommand,
  );
}

async function createSettings(cwd, answers) {
  const settings = {
    permissions: {
      allow: [],
      deny: [],
      ask: [],
    },
  };

  await fs.writeFile(
    path.join(cwd, ".claude", "settings.json"),
    JSON.stringify(settings, null, 2),
  );

  // Create local settings for sensitive data (gitignored)
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

    // Ensure settings.local.json is gitignored
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
    version: "1.0.0",
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
    audits: ["FARMHOUSE", "SECURITY", "PERFORMANCE", "CODE_QUALITY", "TESTS"],
  };

  // Add Storybook configuration if enabled
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
