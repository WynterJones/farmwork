# Farmwork Framework

> A reusable agentic development harness for AI-assisted software projects.
> Turn any project into a well-organized, self-documenting, continuously improving codebase.

**Version:** 1.0.0
**Author:** Wynter Jones
**Website:** https://farmwork.wynter.ai

---

## What is Farmwork?

Farmwork is an opinionated framework for organizing AI-assisted development workflows. It provides:

- **Phrase Commands** - Natural language triggers for complex workflows
- **Issue Tracking** - Beads CLI for lightweight, git-synced issues
- **Living Audits** - Self-updating documentation that tracks project health
- **Agentic Harness** - Specialized AI agents for code review, security, performance
- **Plan-First Development** - Plans saved before implementation
- **Quality Gates** - Automated lint, test, build pipelines

The farming metaphor makes workflows memorable:
- "open the farm" = audit your systems (update FARMHOUSE.md)
- "count the herd" = full code inspection + dry run (no push)
- "go to market" = i18n translations + accessibility audit
- "close the farm" = push to production

---

## Core Components

### 1. Folder Structure

```
your-project/
├── CLAUDE.md              # AI instructions + phrase commands
├── FARMHOUSE.md           # Framework center (metrics, inventory, health)
├── _AUDIT/                 # Living audit documents
│   ├── FARMHOUSE.md        # Agentic harness metrics
│   ├── SECURITY.md         # Security posture
│   ├── PERFORMANCE.md      # Performance metrics
│   ├── ACCESSIBILITY.md    # WCAG 2.1 compliance
│   ├── CODE_QUALITY.md     # Code quality tracking
│   └── TESTS.md            # Test coverage
├── _PLANS/                 # Implementation plans (temporary)
├── .beads/                 # Issue tracking (auto-created by bd)
├── .claude/                # Claude Code configuration
│   ├── commands/           # User-invocable skills (/command)
│   ├── agents/             # Specialized subagents
└── justfile                # Navigation & task commands
```

### 2. Required Tools

| Tool | Purpose | Install |
|------|---------|---------|
| **Claude Code** | AI coding assistant | `npm i -g @anthropic/claude-code` |
| **Beads (bd)** | Issue tracking | `cargo install beads` or via npm |
| **Just** | Command runner | `brew install just` or `cargo install just` |
| **Node.js** | Runtime | `nvm install 22` |

### 3. Phrase Commands

Farmwork defines three categories of phrase commands:

#### Farmwork Phrases (Development Workflow)
| Phrase | Action |
|--------|--------|
| `open the farm` | Audit systems, update FARMHOUSE.md metrics |
| `count the herd` | Full inspection + dry run: code review, cleanup, performance, security, code quality, accessibility |
| `go to market` | i18n translation scan + accessibility audit |
| `close the farm` | Push to production (lint, test, build, commit, push) |

#### Plan Phrases
| Phrase | Action |
|--------|--------|
| `make a plan for...` | Create plan in `_PLANS/` |
| `let's implement...` | Load plan, create Epic + issues, start work |

#### Project Phrases (Customizable)
Add project-specific phrases as needed.

---

## Setup Guide

### Step 1: Initialize Folder Structure

```bash
# Create required folders
mkdir -p _AUDIT _PLANS .claude/commands .claude/agents

# Initialize beads issue tracking
bd init
```

### Step 2: Create CLAUDE.md

Create `CLAUDE.md` in project root with:

```markdown
# Project Name

## MANDATORY: Issue-First Workflow

**ALWAYS create beads issues BEFORE starting work.**

### Single Task
1. Create issue: `bd create "Task description" -t bug|feature|task -p 0-4`
2. Claim it: `bd update <id> --status in_progress`
3. Do the work
4. Close it: `bd close <id> --reason "What was done"`

---

## Phrase Commands

[Copy phrase commands from Farmwork Framework]

---

## Plan Mode Protocol

**CRITICAL**: When Claude enters Plan Mode, ALL plans MUST:
1. Be saved to `_PLANS/<FEATURE_NAME>.md` before implementation
2. Create a beads Epic after user approval
3. Get explicit user confirmation before starting work

---

[Add project-specific instructions below]
```

### Step 3: Create FARMHOUSE.md

Create `_AUDIT/FARMHOUSE.md`:

```markdown
# Farmwork Farmhouse

> Central command for the Farmwork agentic harness.

**Last Updated:** YYYY-MM-DD
**Score:** X/10
**Status:** X open items

---

## Quick Metrics

| Metric | Count |
|--------|-------|
| Commands | 0 |
| Agents | 0 |
| Justfile Recipes | 0 |
| Unit Tests | 0 |
| E2E Tests | 0 |
| Completed Issues | 0 |

---

## Phrase Commands

[Document active phrase commands]

---

## Commands (`.claude/commands/`)

[List /commands]

---

## Agents (`.claude/agents/`)

[List agents]

---

## Beads Issue History

**Total Completed Issues:** 0

---

## Audit History

| Date | Changes |
|------|---------|
| YYYY-MM-DD | Initial FARMHOUSE setup |
```

### Step 4: Create Justfile

Create `justfile` in project root:

```just
# Project navigation and task commands
# Run `just --list` to see all commands

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
    npm run lint

# Run tests
test:
    npm run test

# Build project
build:
    npm run build

# ============================================
# NAVIGATION
# ============================================

# Go to source directory
src:
    cd {{project_root}}/src && pwd

# Go to tests directory
tests:
    cd {{project_root}}/tests && pwd

# Go to audit folder
audit:
    cd {{project_root}}/_AUDIT && pwd

# Go to plans folder
plans:
    cd {{project_root}}/_PLANS && pwd

# ============================================
# UTILITIES
# ============================================

# Show project structure
overview:
    tree -L 2 -I 'node_modules|.git|dist|coverage'

# Search for files by name
search pattern:
    find . -name "*{{pattern}}*" -not -path "./node_modules/*"
```

### Step 5: Create Core Agents

#### `.claude/agents/the-farmer.md`

```markdown
---
name: the-farmer
description: Audit and update FARMHOUSE.md with current project metrics
tools: Read, Grep, Glob, Edit, Bash
model: haiku
---

# The Farmer Agent

Maintains `_AUDIT/FARMHOUSE.md` - the living document tracking all systems and health.

## Instructions

1. Count commands: `ls -1 .claude/commands/*.md | wc -l`
2. Count agents: `ls -1 .claude/agents/*.md | wc -l`
3. Count tests: `find . -name "*.test.*" | wc -l`
4. Count completed issues: `bd list --status closed | wc -l`
5. Update FARMHOUSE.md with fresh metrics
6. Update score based on completeness
```

#### `.claude/agents/code-reviewer.md`

```markdown
---
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

Reports findings with severity and remediation steps.
```

### Step 6: Create Core Commands

#### `.claude/commands/push.md`

```markdown
---
description: Clean, stage, lint, test, build, commit, push, and update metrics
argument-hint: [optional: commit message override]
allowed-tools: Bash(find:*), Bash(git:*), Bash(npm:*), Task
---

# Push Command

Run code cleanup, all quality gates, commit changes, and push to remote.

## Workflow (11 Steps)

1. **Clean Up System Files** - Remove .DS_Store files
2. **Sync Packages** - Clean reinstall node_modules for lock file sync
3. **Stage All Changes** - `git add -A`
4. **Check for Changes** - Verify staged changes exist
5. **Clean Code** - Run code-cleaner agent to remove comments/console.logs
6. **Run Quality Gates** - Lint, (Storybook), Tests, Build
7. **Generate Commit Message** - Analyze changes, create descriptive message
8. **Commit and Push** - Create commit with FARMWORK footer, push to remote
9. **Deploy Storybook** - (If configured) Deploy to Netlify
10. **Update Farmhouse Metrics** - Run the-farmer agent
11. **Report Success** - Show summary of changes
```

### Step 7: Create Audit Templates

Create these files in `_AUDIT/`:

#### `_AUDIT/SECURITY.md`
```markdown
# Security Audit

**Last Updated:** YYYY-MM-DD
**Score:** X/10
**Status:** X open items

---

## Open Items

_None currently_

---

## Audit History

| Date | Changes |
|------|---------|
```

#### `_AUDIT/PERFORMANCE.md`
```markdown
# Performance Audit

**Last Updated:** YYYY-MM-DD
**Score:** X/10
**Status:** X open items

---

## Open Items

_None currently_

---

## Audit History

| Date | Changes |
|------|---------|
```

#### `_AUDIT/CODE_QUALITY.md`
```markdown
# Code Quality Audit

**Last Updated:** YYYY-MM-DD
**Score:** X/10
**Status:** X open items

---

## Open Items

_None currently_

---

## Audit History

| Date | Changes |
|------|---------|
```

#### `_AUDIT/ACCESSIBILITY.md`
```markdown
# Accessibility Audit

> WCAG 2.1 Level AA compliance tracking.

**Last Updated:** YYYY-MM-DD
**Score:** X/10
**Status:** X open items

---

## How to get 10/10

All images have meaningful alt text, all interactive elements are keyboard accessible, color contrast meets WCAG AA standards, all forms have proper labels, and ARIA is used correctly.

---

## Open Items

_None currently_

---

## Audit History

| Date | Changes |
|------|---------|
```

#### `_AUDIT/TESTS.md`
```markdown
# Test Coverage Audit

**Last Updated:** YYYY-MM-DD
**Score:** X/10
**Status:** X open items

---

## Coverage Metrics

| Category | Count |
|----------|-------|
| Unit Tests | 0 |
| E2E Tests | 0 |
| Integration Tests | 0 |

---

## Open Items

_None currently_

---

## Audit History

| Date | Changes |
|------|---------|
```

---

## CLI Tool Specification

The `farmwork` CLI for bootstrapping new projects:

### Commands

```bash
# Initialize Farmwork in current directory (always interactive)
farmwork init

# Force overwrite existing files
farmwork init -f

# Add components
farmwork add agent <name>
farmwork add command <name>
farmwork add audit <name>

# Check health
farmwork status
farmwork doctor
```

### Interactive Setup Questions

```
? Project name: my-project
? Package manager: (npm / yarn / pnpm / bun)
? Test command: npm run test                        # Auto-detected from package.json
? Build command: npm run build                      # Auto-detected from package.json
? Lint command: npm run lint                        # Auto-detected from package.json
? Include Storybook support? (y/N)                  # Auto-detected if installed
? Include i18n support? (y/N)

# If Storybook is enabled:
📚 Storybook Deployment Configuration
? Storybook URL: storybook.yoursite.com
? Netlify Auth Token: ****
? Netlify Site ID: abc123
? Password protect Storybook? (Y/n)                 # Recommended

Creating Farmwork structure...
✓ Created _AUDIT/
✓ Created _PLANS/
✓ Created .claude/commands/
✓ Created .claude/agents/
✓ Created CLAUDE.md
✓ Created _AUDIT/FARMHOUSE.md
✓ Created justfile
✓ Created .claude/settings.local.json              # If Storybook enabled
✓ Initialized beads (bd init)
✓ Installed just (if missing)

Farmwork framework initialized!
Run `just --list` to see available commands.
Say "till the land" to Claude to audit your setup.
```

**Note:** Core features (beads, justfile, agents, audits) are always included. Storybook deployment config is optional and stores Netlify credentials in `.claude/settings.local.json` (gitignored).

### Configuration File

`.farmwork.json` for project-specific settings:

```json
{
  "version": "1.0.0",
  "projectName": "my-project",
  "commands": {
    "test": "npm run test",
    "build": "npm run build",
    "lint": "npm run lint"
  },
  "features": {
    "storybook": true,
    "i18n": false
  },
  "audits": [
    "FARMHOUSE",
    "SECURITY",
    "PERFORMANCE",
    "CODE_QUALITY",
    "TESTS"
  ],
  "storybook": {
    "url": "storybook.yoursite.com",
    "passwordProtected": true,
    "deployCommand": "npx netlify deploy --dir=storybook-static --site=$NETLIFY_STORYBOOK_SITE_ID --prod"
  }
}
```

---

## Best Practices

### 1. Issue-First Development
Always create a beads issue before starting work. This provides:
- Full visibility into what's being worked on
- Historical record of changes
- Ability to track epics and dependencies

### 2. Plan Before Implement
For any non-trivial work:
1. Say "make a plan for X"
2. Review the plan in `_PLANS/`
3. Say "let's implement X"
4. Confirm before Claude starts coding

### 3. Regular Audits
Run "open the farm" regularly to keep FARMHOUSE.md current. This helps:
- Track project health over time
- Identify documentation gaps
- Maintain accurate metrics

### 4. Living Documents
`_AUDIT/` files are living documents:
- Update them, don't delete them
- Only track open items (remove when resolved)
- Include audit history for accountability

### 5. Phrase Command Discipline
Use phrase commands consistently:
- "open the farm" to audit systems at start of session
- "count the herd" before major releases (full audit + dry run)
- "go to market" for i18n and accessibility checks
- "close the farm" when ready to push

---

## Extending Farmwork

### Adding Custom Phrases

In CLAUDE.md, add to the Project Phrases section:

```markdown
### Project Phrases

| Phrase | Action |
|--------|--------|
| `deploy staging` | Deploy to staging environment |
| `sync database` | Run database migrations |
| `generate docs` | Generate API documentation |
```

Then add corresponding phrase details below.

### Adding Custom Agents

Create `.claude/agents/your-agent.md`:

```markdown
---
name: your-agent
description: What this agent does
tools: Read, Grep, Glob, Edit, Bash
model: haiku|sonnet|opus
---

# Your Agent Name

## Purpose
What the agent does.

## Instructions
Step by step instructions for the agent.

## Output Format
How the agent should report results.
```

### Adding Custom Audits

Create `_AUDIT/YOUR_AUDIT.md` with the standard format:

```markdown
# Your Audit Name

**Last Updated:** YYYY-MM-DD
**Score:** X/10
**Status:** X open items

---

## Open Items

_None currently_

---

## Audit History

| Date | Changes |
|------|---------|
```

---

## Migration Guide

### From Existing Project

1. Create folder structure (don't overwrite existing files)
2. Move any TODO.md or ROADMAP.md content to beads issues
3. Create CLAUDE.md with project-specific instructions
4. Run "till the land" to populate FARMHOUSE.md
5. Create initial audit documents

### From Another Framework

Farmwork is designed to complement, not replace:
- Keep your existing test framework
- Keep your CI/CD pipeline
- Keep your deployment process
- Add Farmwork for AI-assisted development workflow

---

## Troubleshooting

### Beads not working
```bash
# Reinitialize beads
rm -rf .beads
bd init

# Sync with git
bd sync
```

### Phrase commands not triggering
- Ensure CLAUDE.md is in project root
- Check phrase spelling matches exactly
- Restart Claude Code session

### Agents failing
- Check agent has required tools in frontmatter
- Verify model is valid (haiku, sonnet, opus)
- Check file paths in agent instructions

---

## Changelog

### 1.0.0 (2024-12-20)
- Initial Farmwork framework release
- Core phrase commands (Farmwork, Plan, Project)
- Farming metaphor for memorable workflows
- Beads integration for issue tracking
- Living audit documents
- Justfile navigation system

---

## License

MIT License - Use freely in any project.

---

## Contributing

Farmwork is open source. Contributions welcome at:
https://github.com/wynterjones/farmwork
