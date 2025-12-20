import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');

const QUESTIONS = [
  {
    type: 'input',
    name: 'projectName',
    message: 'Project name:',
    default: path.basename(process.cwd())
  },
  {
    type: 'list',
    name: 'projectType',
    message: 'Project type:',
    choices: ['nextjs', 'rails', 'python', 'node', 'other']
  },
  {
    type: 'list',
    name: 'packageManager',
    message: 'Package manager:',
    choices: ['npm', 'yarn', 'pnpm', 'bun', 'none'],
    when: (answers) => ['nextjs', 'node'].includes(answers.projectType)
  },
  {
    type: 'input',
    name: 'testCommand',
    message: 'Test command:',
    default: (answers) => {
      const pm = answers.packageManager || 'npm';
      switch (answers.projectType) {
        case 'nextjs':
        case 'node':
          return `${pm} run test`;
        case 'rails':
          return 'bundle exec rspec';
        case 'python':
          return 'pytest';
        default:
          return 'echo "No tests configured"';
      }
    }
  },
  {
    type: 'input',
    name: 'buildCommand',
    message: 'Build command:',
    default: (answers) => {
      const pm = answers.packageManager || 'npm';
      switch (answers.projectType) {
        case 'nextjs':
          return `${pm} run build`;
        case 'node':
          return `${pm} run build`;
        case 'rails':
          return 'bundle exec rails assets:precompile';
        case 'python':
          return 'python -m build';
        default:
          return 'echo "No build configured"';
      }
    }
  },
  {
    type: 'input',
    name: 'lintCommand',
    message: 'Lint command:',
    default: (answers) => {
      const pm = answers.packageManager || 'npm';
      switch (answers.projectType) {
        case 'nextjs':
        case 'node':
          return `${pm} run lint`;
        case 'rails':
          return 'bundle exec rubocop';
        case 'python':
          return 'ruff check .';
        default:
          return 'echo "No linting configured"';
      }
    }
  },
  {
    type: 'confirm',
    name: 'includeStorybook',
    message: 'Include Storybook support? (React/Vue component docs)',
    default: false,
    when: (answers) => ['nextjs', 'node'].includes(answers.projectType)
  },
  {
    type: 'confirm',
    name: 'includeI18n',
    message: 'Include i18n support? (multi-language translations)',
    default: false
  }
];

export async function init(options) {
  const cwd = process.cwd();

  console.log(chalk.cyan('\n🌾 Farmwork Framework Initialization\n'));

  let answers;

  if (options.interactive) {
    answers = await inquirer.prompt(QUESTIONS);
  } else {
    answers = {
      projectName: path.basename(cwd),
      projectType: options.template || 'node',
      packageManager: 'npm',
      testCommand: 'npm run test',
      buildCommand: 'npm run build',
      lintCommand: 'npm run lint',
      includeStorybook: false,
      includeI18n: false
    };
  }

  const spinner = ora('Creating Farmwork structure...').start();

  try {
    // Create folder structure
    await fs.ensureDir(path.join(cwd, '_AUDIT'));
    await fs.ensureDir(path.join(cwd, '_PLANS'));
    await fs.ensureDir(path.join(cwd, '.claude', 'commands'));
    await fs.ensureDir(path.join(cwd, '.claude', 'agents'));

    spinner.text = 'Creating CLAUDE.md...';
    await createClaudeMd(cwd, answers);

    spinner.text = 'Creating FARMHOUSE.md...';
    await createFarmhouseMd(cwd, answers);

    spinner.text = 'Creating audit documents...';
    await createAuditDocs(cwd, answers);

    spinner.text = 'Creating justfile...';
    await createJustfile(cwd, answers);

    spinner.text = 'Creating core agents...';
    await createAgents(cwd, answers);

    spinner.text = 'Creating core commands...';
    await createCommands(cwd, answers);

    spinner.text = 'Creating settings...';
    await createSettings(cwd, answers);

    spinner.text = 'Creating .produce.json...';
    await createProduceConfig(cwd, answers);

    spinner.text = 'Initializing beads issue tracking...';
    try {
      const { execSync } = await import('child_process');
      execSync('bd init', { cwd, stdio: 'ignore' });
    } catch (e) {
      console.log(chalk.yellow('\n⚠️  Could not initialize beads. Install with: cargo install beads'));
    }

    spinner.succeed(chalk.green('Farmwork framework initialized!'));

    console.log(chalk.cyan('\n📁 Created structure:'));
    console.log(`   ${chalk.green('✓')} _AUDIT/`);
    console.log(`   ${chalk.green('✓')} _PLANS/`);
    console.log(`   ${chalk.green('✓')} .claude/commands/`);
    console.log(`   ${chalk.green('✓')} .claude/agents/`);
    console.log(`   ${chalk.green('✓')} CLAUDE.md`);
    console.log(`   ${chalk.green('✓')} justfile`);
    console.log(`   ${chalk.green('✓')} .produce.json`);

    console.log(chalk.cyan('\n🚀 Next steps:'));
    console.log(`   1. Run ${chalk.yellow('just --list')} to see available commands`);
    console.log(`   2. Say ${chalk.yellow('"till the land"')} to Claude to audit your setup`);
    console.log(`   3. Say ${chalk.yellow('"make a plan for <feature>"')} to start planning`);
    console.log('');

  } catch (error) {
    spinner.fail(chalk.red('Failed to initialize Farmwork'));
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

- **Type:** ${answers.projectType}
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

  await fs.writeFile(path.join(cwd, 'CLAUDE.md'), content);
}

async function createFarmhouseMd(cwd, answers) {
  const today = new Date().toISOString().split('T')[0];

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

  await fs.writeFile(path.join(cwd, '_AUDIT', 'FARMHOUSE.md'), content);
}

async function createAuditDocs(cwd, answers) {
  const today = new Date().toISOString().split('T')[0];

  const audits = [
    {
      name: 'SECURITY.md',
      title: 'Security Audit',
      description: 'Security posture and vulnerability tracking'
    },
    {
      name: 'PERFORMANCE.md',
      title: 'Performance Audit',
      description: 'Performance metrics and optimization tracking'
    },
    {
      name: 'CODE_QUALITY.md',
      title: 'Code Quality Audit',
      description: 'Code quality and standards tracking'
    },
    {
      name: 'TESTS.md',
      title: 'Test Coverage Audit',
      description: 'Test coverage and gaps tracking'
    }
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

    await fs.writeFile(path.join(cwd, '_AUDIT', audit.name), content);
  }
}

async function createJustfile(cwd, answers) {
  const content = `# ${answers.projectName} - Farmwork Framework
# Run \`just --list\` to see all commands

# Variables
project_root := justfile_directory()

# ============================================
# DEVELOPMENT
# ============================================

# Start development server
dev:
    ${answers.projectType === 'nextjs' ? 'npm run dev' :
      answers.projectType === 'rails' ? 'bin/rails server' :
      answers.projectType === 'python' ? 'python -m flask run' :
      'echo "Configure dev command"'}

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

  await fs.writeFile(path.join(cwd, 'justfile'), content);
}

async function createAgents(cwd, answers) {
  const agents = {
    'the-farmer.md': `---
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
    'code-reviewer.md': `---
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
    'security-auditor.md': `---
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
    'performance-auditor.md': `---
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
`
  };

  for (const [filename, content] of Object.entries(agents)) {
    await fs.writeFile(path.join(cwd, '.claude', 'agents', filename), content);
  }
}

async function createCommands(cwd, answers) {
  const pushCommand = `---
description: Clean, lint, test, build, commit, and push
allowed-tools: Bash(git:*), Bash(${answers.packageManager || 'npm'}:*)
---

# Push Command

Run quality gates, commit changes, and push to remote.

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
🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
\`\`\`

Then push: \`git push\`

### Step 6: Report Success

Show summary:
- Files changed
- Commit hash
- Push status
`;

  await fs.writeFile(path.join(cwd, '.claude', 'commands', 'push.md'), pushCommand);
}

async function createSettings(cwd, answers) {
  const settings = {
    permissions: {
      allow: [],
      deny: [],
      ask: []
    }
  };

  await fs.writeFile(
    path.join(cwd, '.claude', 'settings.json'),
    JSON.stringify(settings, null, 2)
  );
}

async function createProduceConfig(cwd, answers) {
  const config = {
    version: '1.0.0',
    projectName: answers.projectName,
    projectType: answers.projectType,
    packageManager: answers.packageManager || null,
    commands: {
      test: answers.testCommand,
      build: answers.buildCommand,
      lint: answers.lintCommand
    },
    features: {
      storybook: answers.includeStorybook || false,
      i18n: answers.includeI18n || false
    },
    audits: [
      'FARMHOUSE',
      'SECURITY',
      'PERFORMANCE',
      'CODE_QUALITY',
      'TESTS'
    ]
  };

  await fs.writeFile(
    path.join(cwd, '.produce.json'),
    JSON.stringify(config, null, 2)
  );
}
