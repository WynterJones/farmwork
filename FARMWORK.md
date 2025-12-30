# Farmwork Framework

> A reusable agentic development harness for AI-assisted software projects.
> Turn any project into a well-organized, self-documenting, continuously improving codebase.

**Version:** 1.4.6
**Author:** Wynter Jones
**Website:** https://farmwork.dev

---

## What is Farmwork?

Farmwork is an opinionated framework for organizing AI-assisted development workflows. It provides:

- **Skills** - Auto-activating workflows that respond to natural phrases
- **Slash Commands** - Explicit triggers for actions like `/push`
- **Issue Tracking** - Beads CLI for lightweight, git-synced issues
- **Living Audits** - Self-updating documentation that tracks project health
- **Agentic Harness** - Specialized AI agents for code review, security, performance
- **Plan-First Development** - Plans saved before implementation
- **Quality Gates** - Automated lint, test, build pipelines

The farming metaphor makes workflows memorable:
- "open the farm" = audit your systems (farm-audit skill)
- "count the herd" = full code inspection (farm-inspect skill)
- "go to market" = i18n + accessibility (market skill)
- `/push` = commit and push to production

---

## Core Components

### 1. Folder Structure

```
your-project/
├── CLAUDE.md              # AI instructions (lean - references skills)
├── _AUDIT/                 # Living audit documents
│   ├── FARMHOUSE.md        # Agentic harness metrics
│   ├── SECURITY.md         # Security posture
│   ├── PERFORMANCE.md      # Performance metrics
│   ├── ACCESSIBILITY.md    # WCAG 2.1 compliance
│   ├── CODE_QUALITY.md     # Code quality tracking
│   ├── TESTS.md            # Test coverage
│   ├── GARDEN.md           # Idea nursery (pre-plan stage)
│   └── COMPOST.md          # Rejected ideas archive
├── _PLANS/                 # Implementation plans (temporary)
├── _RESEARCH/              # Research documents (living docs)
├── _OFFICE/                # Product strategy documents
│   ├── GREENFIELD.md       # Vision (where we want to go)
│   ├── BROWNFIELD.md       # Reality (what's implemented)
│   ├── ONBOARDING.md       # Onboarding documentation
│   └── USER_GUIDE.md       # User documentation
├── .beads/                 # Issue tracking (auto-created by bd)
├── .claude/                # Claude Code configuration
│   ├── skills/             # Auto-activating workflows (new!)
│   │   ├── farm-audit/     # "open the farm"
│   │   ├── farm-inspect/   # "count the herd"
│   │   ├── garden/         # idea management
│   │   ├── research/       # "let's research..."
│   │   ├── production/     # "go to production"
│   │   └── market/         # "go to market"
│   ├── commands/           # Explicit slash commands (/push)
│   └── agents/             # Specialized subagents (15+)
└── justfile                # Navigation & task commands
```

### 2. Required Tools

| Tool | Purpose | Install |
|------|---------|---------|
| **Claude Code** | AI coding assistant | `npm i -g @anthropic/claude-code` |
| **Beads (bd)** | Issue tracking | `cargo install beads` or via npm |
| **Just** | Command runner | `brew install just` or `cargo install just` |
| **Node.js** | Runtime | `nvm install 22` |

### 3. Skills (Auto-Activating Workflows)

Skills are Claude Code's auto-activating workflows. They respond to natural phrases and handle complex multi-step processes. Workflow details live in `.claude/skills/[skill-name]/SKILL.md`.

#### Development Skills
| Phrase | Skill | What Happens |
|--------|-------|--------------|
| `open the farm` | farm-audit | Audit systems, update FARMHOUSE.md metrics |
| `count the herd` | farm-inspect | Full code inspection (all audit agents, dry run) |
| `go to market` | market | i18n scan + WCAG 2.1 accessibility audit |
| `go to production` | production | Update BROWNFIELD, check strategy alignment |

#### Idea Management (garden skill)
| Phrase | Action |
|--------|--------|
| `I have an idea for...` | Add new idea to `_AUDIT/GARDEN.md` |
| `water the garden` | Generate 10 new ideas |
| `compost this...` | Move idea to COMPOST.md |
| `let's plan this idea...` | Graduate idea → create plan |

**Idea Lifecycle:**
- **Fresh** (0-44 days) - Ready to develop
- **Wilting** (45-60 days) - Needs attention ⚠️
- **Composted** (60+ days) - Auto-moved during audit

#### Research (research skill)
| Phrase | Action |
|--------|--------|
| `let's research...` | Create research doc in `_RESEARCH/` |
| `update research on...` | Refresh with new findings |

**Research Freshness:**
- **Fresh** (0-14 days) - Current
- **Aging** (15-30 days) - Consider refresh
- **Stale** (30+ days) - Update before planning

### 4. Slash Commands (Explicit Actions)

| Command | What It Does |
|---------|--------------|
| `/push` | Lint, test, build, commit, push |
| `/office` | Interactive strategy setup |

### 5. Skill Activation Hook

Farmwork adds a `UserPromptSubmit` hook that reminds Claude to check for applicable skills on each message. This improves activation reliability.

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
model: opus
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
model: opus
---

# Code Reviewer Agent

Reviews staged/modified files for:
- Security vulnerabilities
- Performance issues
- Code quality problems
- Best practice violations

Reports findings with severity and remediation steps.
```

#### `.claude/agents/idea-gardener.md`

```markdown
---
name: idea-gardener
description: Manage the Idea Garden and Compost - add, graduate, reject, or generate ideas
tools: Read, Edit, Glob, Grep
model: opus
---

# Idea Gardener Agent

Manages `_AUDIT/GARDEN.md` and `_AUDIT/COMPOST.md` for idea lifecycle tracking.

## Commands

### Plant an Idea (from "I have an idea for...")
1. Parse the idea title from user input
2. Ask user for short description and key bullet points
3. Add to GARDEN.md with format:
   ```
   ### [Idea Title]
   **Planted:** YYYY-MM-DD
   [Short description]
   - Bullet point 1
   ```
4. Update counts

### Graduate an Idea (from "let's plan this idea...")
1. Find idea in GARDEN.md
2. Create plan file in _PLANS/ using plan mode
3. Move idea to "Graduated to Plans" table with date and plan link
4. Remove from ## Ideas section

### Compost an Idea (from "compost this..." / "I dont want...")
1. Find idea in GARDEN.md (or accept new rejection)
2. Ask for rejection reason
3. Add to COMPOST.md with format:
   ```
   ### [Idea Title]
   **Composted:** YYYY-MM-DD
   **Reason:** [User's reason]
   ```
4. Remove from GARDEN.md if it was there

### Water the Garden (from "water the garden")
1. Read GARDEN.md and COMPOST.md to understand context
2. Generate 10 creative ideas that extend existing themes and avoid rejected patterns
3. Present as numbered list with title and one-line description
4. Ask user which to plant (e.g., "1, 3, 5")
5. Add selected ideas to GARDEN.md with planted date
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

#### `_AUDIT/GARDEN.md`
```markdown
# Idea Garden

> Nursery for new ideas and concepts. The pre-plan creative thinking stage.
> Ideas older than 60 days without action will naturally compost during "open the farm".

**Last Updated:** YYYY-MM-DD
**Active Ideas:** 0
**Wilting Ideas:** 0

---

## Idea Lifecycle

Ideas have a natural lifecycle:
- **Fresh** (0-44 days) - New ideas, ready to be developed
- **Wilting** (45-60 days) - Ideas aging without action, marked with ⚠️
- **Composted** (60+ days) - Auto-moved to COMPOST during "open the farm"

---

## Ideas

### Example Idea
**Planted:** 2024-12-01
Short description of the idea.
- Key point 1
- Key point 2

---

## Graduated to Plans

| Idea | Plan | Date |
|------|------|------|
```

#### `_AUDIT/COMPOST.md`
```markdown
# Idea Compost

> Archive of rejected ideas. Reference to avoid re-proposing and remember why we didn't pursue something.
> Ideas that age 60+ days in the Garden are automatically composted during "open the farm".

**Last Updated:** YYYY-MM-DD
**Composted Ideas:** 0
**Auto-Composted:** 0

---

## Composted Ideas

### Example Composted Idea
**Composted:** 2024-12-20
**Reason:** Auto-composted: aged 60+ days without action
Original description of the idea.
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
  "version": "1.1.0",
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
    "TESTS",
    "GARDEN",
    "COMPOST"
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
model: opus|sonnet|opus
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

### 1.4.6 (2025-12-29)
- **Major Architecture Change**: Migrated from phrase commands to **Skills**
- Added **6 Skills** in `.claude/skills/`:
  - `farm-audit` - "open the farm" workflow
  - `farm-inspect` - "count the herd" full inspection
  - `garden` - idea management (plant, water, compost)
  - `research` - systematic research
  - `production` - "go to production" readiness check
  - `market` - "go to market" i18n + accessibility
- Added **UserPromptSubmit hook** for reliable skill activation
- **Simplified CLAUDE.md** from ~340 lines to ~75 lines
- Skills auto-activate on natural phrases (same UX, better reliability)
- Workflow details moved from CLAUDE.md to individual SKILL.md files
- Skills support progressive disclosure (supporting files loaded on demand)

### 1.3.0 (2024-12-27)
- Added **Research Phase** - systematic research before planning with `_RESEARCH/` folder
- Added **"let's research..."** phrase - creates research documents with docs, security, tech stack, gotchas
- Added **"update research on..."** phrase - refreshes existing research with new findings
- Added **"show research on..."** phrase - displays research summary and staleness status
- Added **`researcher` agent** - spawns parallel subagents for comprehensive research
- Added optional **ref.tools MCP integration** for enhanced documentation lookup
- Research documents track freshness: Fresh (0-14 days) → Aging (15-30 days) → Stale (30+ days)
- Updated `the-farmer` agent to check research staleness during audits
- Updated `farmwork status` and `farmwork doctor` to include research documents
- Agents count increased from 11 to 12

### 1.2.0 (2024-12-23)
- Added **"water the garden"** phrase - generates 10 new ideas based on existing GARDEN and COMPOST
- Ideas now have a **Planted:** date when added to the Garden
- Added idea aging lifecycle: Fresh (0-44 days) → Wilting (45-60 days) → Composted (60+ days)
- "open the farm" now automatically composts ideas older than 60 days
- Wilting ideas (45-60 days) are marked with ⚠️ and reported during audits
- Updated GARDEN.md and COMPOST.md templates with lifecycle documentation
- Updated `the-farmer` agent to tend the Idea Garden during audits
- Updated `idea-gardener` agent to add planted dates and generate ideas

### 1.1.0 (2024-12-22)
- Added `_AUDIT/GARDEN.md` for idea nursery (pre-plan creative thinking stage)
- Added `_AUDIT/COMPOST.md` for rejected ideas archive
- Added `idea-gardener` agent to manage idea lifecycle
- Added Idea Phrases: "I have an idea for...", "let's plan this idea...", "compost this...", etc.
- Ideas can now graduate to plans or be composted for reference

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
