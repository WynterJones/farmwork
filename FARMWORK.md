# Farmwork Framework

> A reusable agentic development harness for AI-assisted software projects.
> Turn any project into a well-organized, self-documenting, continuously improving codebase.

**Version:** 2.0.0
**Author:** Wynter Jones
**Website:** https://farmwork.dev

---

## What is Farmwork?

Farmwork is an opinionated, deliberately small framework for organizing AI-assisted
development workflows. As of 2.0.0 it provides:

- **Skills** - 2 auto-activating workflows that respond to natural phrases
- **Agents** - 4 focused AI agents for auditing, reviewing, cleaning, and idea tracking
- **Slash Commands** - 1 explicit trigger, `/push`, for shipping
- **Living Audits** - Self-updating documentation that tracks project health
- **Plan-First Development** - Plans saved to `_PLANS/` before implementation
- **Idea Garden** - A lightweight, no-dependency way to capture and age ideas

The farming metaphor makes workflows memorable:
- "open the farm" = quick audit of your systems (farm-audit skill)
- "count the herd" = deep audit: quick audit + full code inspection (farm-audit skill)
- "I have an idea for..." / "water the garden" / "compost this..." = idea lifecycle (garden skill)
- `/push` = review, quality gate, commit, and push

Farmwork has **no external CLI dependencies**. There is no issue tracker to install, no
task runner, and no product-strategy scaffolding to fill in - just an AI coding
assistant and Node.js.

Farmwork works with Claude Code, Codex, and Gemini CLI. Claude Code gets native
auto-activating skills and subagents; other tools get the same workflow via
`AGENTS.md` - a plain-instructions file since they can't invoke `.claude/skills/`
directly.

---

## Core Components

### 1. Folder Structure

```
your-project/
├── CLAUDE.md              # AI instructions (lean - references skills)
├── AGENTS.md              # Same workflow, plain instructions for non-Claude tools
├── _AUDIT/                 # Living audit + idea documents
│   ├── FARMHOUSE.md         # Framework command center / metrics
│   ├── GARDEN.md            # Idea nursery (pre-plan stage)
│   └── COMPOST.md           # Rejected ideas archive
├── _PLANS/                 # Implementation plans
└── .claude/                # Claude Code configuration
    ├── skills/
    │   ├── farm-audit/       # "open the farm" (quick) / "count the herd" (deep)
    │   └── garden/           # idea management
    ├── agents/
    │   ├── the-farmer.md
    │   ├── code-reviewer.md
    │   ├── code-cleaner.md
    │   └── idea-gardener.md
    └── commands/
        └── push.md
```

### 2. Requirements

| Tool | Purpose | Install |
|------|---------|---------|
| **Claude Code** | AI coding assistant | `npm i -g @anthropic-ai/claude-code` |
| **Node.js 18+** | Runtime for the `farmwork` CLI | `nvm install 18` |

That's it. No issue tracker, no task runner, nothing else to install.

### 3. Skills (Auto-Activating Workflows)

Skills are Claude Code's auto-activating workflows. They respond to natural phrases and
handle multi-step processes. Workflow details live in `.claude/skills/[skill-name]/SKILL.md`.

#### farm-audit
| Phrase | Mode | What Happens |
|--------|------|---------------|
| `open the farm` | Quick | Update `_AUDIT/FARMHOUSE.md` metrics (commands, agents, skills, tests, plans) |
| `count the herd` | Deep | Quick audit, plus a full `code-reviewer` inspection and a dry-run of lint/test/build (no changes, no push) |

#### garden
| Phrase | Action |
|--------|--------|
| `I have an idea for...` | Add new idea to `_AUDIT/GARDEN.md` |
| `water the garden` | Generate 10 new ideas based on existing GARDEN and COMPOST |
| `compost this...` | Move idea to `_AUDIT/COMPOST.md` with a reason |
| `let's plan this idea...` | Graduate idea → create a plan in `_PLANS/` |

**Idea Lifecycle:**
- **Fresh** (0-44 days) - Ready to develop
- **Wilting** (45-60 days) - Needs attention ⚠️
- **Composted** (60+ days) - Auto-moved to COMPOST during "open the farm"

### 4. Slash Commands (Explicit Actions)

| Command | What It Does |
|---------|---------------|
| `/push` | Clean up, run `code-cleaner`, run quality gates, commit, push, update FARMHOUSE.md |

### 5. Agents

| Agent | Purpose |
|-------|---------|
| `the-farmer` | Audits and updates `_AUDIT/FARMHOUSE.md` with current metrics |
| `code-reviewer` | Single comprehensive reviewer: quality, security (OWASP-lite), performance, code smells, and basic accessibility. Reports findings inline with severity - no separate audit docs per concern |
| `code-cleaner` | Removes comments (except JSDoc), console.logs, and obvious dead code before pushing |
| `idea-gardener` | Manages `_AUDIT/GARDEN.md` and `_AUDIT/COMPOST.md` idea lifecycle |

### 6. AGENTS.md (Cross-Tool Support)

Codex, Gemini CLI, and other AI coding assistants don't support Claude Code's native
skills/subagents, so they can't auto-invoke `.claude/skills/`. `AGENTS.md` documents
the same core workflow - folder structure, the "open the farm" / "count the herd"
audit phrases, the Idea Garden phrases, and plan-first development - as plain
instructions the assistant follows directly instead of an auto-activating skill.

---

## Setup Guide

The fastest path is `npx farmwork init`, which generates everything below automatically.
This section documents what gets created, for reference or manual setup.

### Step 1: Initialize Folder Structure

```bash
mkdir -p _AUDIT _PLANS .claude/commands .claude/agents .claude/skills
```

### Step 2: Create CLAUDE.md

Create `CLAUDE.md` in the project root with:

```markdown
# Project Name

## Skills (Auto-Activate on Phrases)

| Phrase | Skill | What Happens |
|--------|-------|---------------|
| open the farm | farm-audit | Quick audit: update FARMHOUSE.md metrics |
| count the herd | farm-audit | Deep audit: quick audit + full inspection (no changes) |
| I have an idea for... | garden | Plant idea in GARDEN.md |
| water the garden | garden | Generate 10 new ideas |
| compost this... | garden | Move idea to COMPOST.md |
| let's plan this idea... | garden | Graduate idea → create a plan in _PLANS/ |

## Slash Commands

| Command | What It Does |
|---------|---------------|
| /push | Clean, review, test, build, commit, push, update metrics |

## Plan Mode Protocol

For any non-trivial feature:
1. Save the plan to `_PLANS/<FEATURE_NAME>.md` before implementation
2. Get explicit user confirmation before starting work

## Project Configuration

- Test: [your test command]
- Build: [your build command]
- Lint: [your lint command]

[Add project-specific instructions below]
```

### Step 3: Create FARMHOUSE.md

Create `_AUDIT/FARMHOUSE.md`:

```markdown
# Farmwork Farmhouse

> Central command for the Farmwork agentic harness.

**Last Updated:** YYYY-MM-DD
**Score:** X/10
**Status:** Initial setup

---

## Quick Metrics

| Metric | Count |
|--------|-------|
| Commands | 0 |
| Agents | 0 |
| Skills | 0 |
| Unit Tests | 0 |
| Total Plans | 0 |
| Completed Plans | 0 |

---

## Audit History

| Date | Changes |
|------|---------|
| YYYY-MM-DD | Initial FARMHOUSE setup |
```

### Step 4: Create GARDEN.md and COMPOST.md

```markdown
# Idea Garden

**Last Updated:** YYYY-MM-DD
**Active Ideas:** 0
**Wilting Ideas:** 0

## Idea Lifecycle
- Fresh (0-44 days) - Ready to develop
- Wilting (45-60 days) - Needs attention ⚠️
- Composted (60+ days) - Auto-moved during "open the farm"

## Ideas

_No ideas planted yet._
```

```markdown
# Idea Compost

**Last Updated:** YYYY-MM-DD
**Composted Ideas:** 0
**Auto-Composted:** 0

## Composted Ideas

_No composted ideas yet._
```

### Step 5: Create Agents

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
3. Count skills: `ls -d .claude/skills/*/ | wc -l`
4. Count tests: `find . -name "*.test.*" | wc -l`
5. Count total/completed plans in `_PLANS/`
6. Tend the Idea Garden (age-based wilting/composting)
7. Update FARMHOUSE.md with fresh metrics and score
```

#### `.claude/agents/code-reviewer.md`

```markdown
---
name: code-reviewer
description: Comprehensive review for quality, security, performance, code smells, and accessibility
tools: Read, Grep, Glob, Bash
model: opus
---

# Code Reviewer Agent

Reviews code for:
- Quality: readability, maintainability, error handling, API design
- Security (OWASP-lite): XSS, injection, auth/authz, secrets
- Performance: memory leaks, unnecessary re-renders, hot-path costs
- Code smells: DRY violations, complexity, naming, magic values
- Accessibility (basic): alt text, contrast, keyboard nav, ARIA

Reports every finding inline with severity (CRITICAL/HIGH/MEDIUM/LOW) and a fix.
Does not maintain separate audit documents per concern.
```

#### `.claude/agents/code-cleaner.md`

```markdown
---
name: code-cleaner
description: Remove comments (except JSDoc), console.logs, and obvious dead code before pushing
tools: Read, Write, Edit, Bash, Grep, Glob
model: opus
---

# Code Cleaner Agent

Removes line/block comments, console.log statements, and unambiguous dead code.
Preserves JSDoc, eslint/ts directive comments, and console.error/warn/info.
Purely cosmetic - never changes behavior.
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

Manages `_AUDIT/GARDEN.md` and `_AUDIT/COMPOST.md` for idea lifecycle tracking:
plant new ideas, graduate ideas into `_PLANS/`, compost rejected ideas, and
generate fresh ideas on request ("water the garden").
```

### Step 6: Create the Push Command

#### `.claude/commands/push.md`

```markdown
---
description: Clean up, review, run quality gates, commit, push, and update metrics
argument-hint: [optional: commit message override]
allowed-tools: Bash(find:*), Bash(git:*), Bash(npm:*), Bash(npx:*), Task
---

# Push Command

## Workflow

1. **Clean Up System Files** - remove `.DS_Store`
2. **Stage Changes** - `git add -A`
3. **Run code-cleaner** - strip comments/console.logs, re-stage
4. **Run Quality Gates** - lint, test, build (whichever scripts exist)
5. **Generate Commit Message** - analyze staged diff and recent log style
6. **Commit and Push** - with a FARMWORK footer
7. **Update Farmhouse Metrics** - run `the-farmer` agent
8. **Report Success** - summary of what changed
```

---

## CLI Tool Specification

The `farmwork` CLI bootstraps and maintains this structure in any project:

### Commands

```bash
# Initialize Farmwork in current directory (close to non-interactive)
farmwork init

# Force overwrite existing files
farmwork init -f

# Check health
farmwork status
farmwork doctor
```

### Init Flow

`farmwork init` auto-detects everything it can and only asks what it must:

```
🌱 Detected Configuration
  Project:         my-project        # from package.json "name", or folder name
  Package manager: npm               # from lockfile (bun/pnpm/yarn/npm)
  Test:            npm run test      # from package.json scripts
  Build:           npm run build     # from package.json scripts
  Lint:            npm run lint      # from package.json scripts

? Look good? (Y/n)                   # only prompt in interactive terminals

Creating Farmwork structure...
✓ Created _AUDIT/
✓ Created _PLANS/
✓ Created .claude/skills/, .claude/agents/, .claude/commands/
✓ Created CLAUDE.md
✓ Created _AUDIT/FARMHOUSE.md, GARDEN.md, COMPOST.md

Farmwork initialized!
Say "open the farm" to Claude to audit your setup.
```

There are no Storybook, i18n, or dead-code-detection questions - those setups are
outside Farmwork's scope. If you want them, add project-specific agents yourself
(Farmwork will happily suggest some if you ask Claude after `init`).

---

## Best Practices

### 1. Plan Before Implement
For any non-trivial work:
1. Say "make a plan for X"
2. Review the plan in `_PLANS/`
3. Confirm before Claude starts coding

### 2. Regular Audits
Run "open the farm" at the start of a session to keep FARMHOUSE.md current, and
"count the herd" before shipping something risky.

### 3. Living Documents
`_AUDIT/` files are living documents:
- Update them, don't delete them
- Include audit history for accountability

### 4. Let code-reviewer Report, Don't Archive
`code-reviewer` findings live in the conversation, not in a pile of separate audit
files. If something needs to persist, put it in `_PLANS/` or fix it immediately.

---

## Extending Farmwork

### Adding Custom Phrases

In `CLAUDE.md`, add a Project Phrases section:

```markdown
### Project Phrases

| Phrase | Action |
|--------|--------|
| `deploy staging` | Deploy to staging environment |
| `sync database` | Run database migrations |
```

### Adding Custom Agents

Create `.claude/agents/your-agent.md`:

```markdown
---
name: your-agent
description: What this agent does
tools: Read, Grep, Glob, Edit, Bash
model: opus|sonnet|haiku
---

# Your Agent Name

## Purpose
What the agent does.

## Instructions
Step by step instructions for the agent.
```

### Adding Custom Skills

Create `.claude/skills/your-skill/SKILL.md` with frontmatter describing the trigger
phrases in `description`, then document the workflow in the body. Extra reference
files in the same directory are loaded on demand (progressive disclosure).

---

## Migration Guide

### From Farmwork 1.x

Farmwork 2.0.0 is a breaking simplification release. If you're upgrading an existing
project:

1. Remove `.beads/`, `justfile`, `_OFFICE/`, and `_RESEARCH/` - they're no longer used
2. Run `farmwork init -f` to regenerate `.claude/` with the new 4 agents / 2 skills / 1 command
3. Merge any project-specific instructions from your old `CLAUDE.md`/`AGENTS.md` into
   the new lean `CLAUDE.md`
4. If you relied on `SECURITY.md`, `PERFORMANCE.md`, `ACCESSIBILITY.md`,
   `CODE_QUALITY.md`, or `TESTS.md`, those concerns now live in `code-reviewer`'s
   inline findings instead of persistent files
5. If you used the i18n or Storybook setup questions, those are gone - manage those
   workflows with your own project-specific agents/commands

### From Another Framework

Farmwork is designed to complement, not replace:
- Keep your existing test framework
- Keep your CI/CD pipeline
- Keep your deployment process
- Add Farmwork for the AI-assisted workflow layer only

---

## Troubleshooting

### Phrase commands not triggering
- Ensure `CLAUDE.md` is in the project root
- Check phrase spelling matches exactly
- Restart the Claude Code session

### Agents failing
- Check the agent has the required tools in its frontmatter
- Verify the model is valid (haiku, sonnet, opus)
- Check file paths in the agent's instructions

### `farmwork doctor` reports failures
- Run `farmwork init` again (without `-f`) to see what's missing and add it
- `.gitignore` should include `.claude/settings.local.json`

---

## Changelog

### 2.0.0 (2026-07-26)
- **Breaking simplification release.** Farmwork is cut down to "the best process that
  is useful" - less ceremony, no external tool dependencies, no unused scaffolding.
- **Agents: 15 → 4.** Kept `the-farmer`, and merged `code-reviewer` + `security-auditor`
  + `performance-auditor` + `code-smell-auditor` + `accessibility-auditor` into a single
  comprehensive `code-reviewer`. Kept `code-cleaner` (now also handles simple dead-code
  cleanup) and `idea-gardener`. Removed `i18n-locale-translator`, `storybook-maintainer`,
  `researcher`, `strategy-agent`, `brownfield-agent`, `onboarding-agent`, `user-guide-agent`.
- **Skills: 6 → 2.** Merged `farm-audit` + `farm-inspect` into one `farm-audit` skill with
  a quick mode ("open the farm") and a deep mode ("count the herd"). Kept `garden`
  unchanged. Removed `research`, `production`, and `market` (the i18n half of `market`
  is gone entirely; the accessibility half now lives in `code-reviewer`).
- **Commands: 2 → 1.** `/push` simplified from an 11-step pipeline to 8 steps. Removed
  `/office` and the Storybook/Netlify deploy step.
- **Removed hard dependencies on `beads` and `just`.** No more issue-tracker CLI,
  no more task runner. `farmwork init` no longer installs anything on your system.
- **Removed `_OFFICE/` and `_RESEARCH/`** and everything that referenced them
  (GREENFIELD/BROWNFIELD/ONBOARDING/USER_GUIDE docs, the research skill/agent).
- **Removed the Storybook, i18n, and Knip setup questions.** `farmwork init` is now
  close to non-interactive: it auto-detects your package manager and test/build/lint
  commands and only confirms before proceeding.
- **Consolidated 5+ separate audit docs down to 3**: `FARMHOUSE.md`, `GARDEN.md`,
  `COMPOST.md`. `SECURITY.md`, `PERFORMANCE.md`, `ACCESSIBILITY.md`, `CODE_QUALITY.md`,
  and `TESTS.md` are gone - those findings now surface inline from `code-reviewer`.
- Deleted the unused, untracked `templates/` directory (dead weight left over from an
  earlier templating approach - `src/init.js` has always generated everything inline).
- `farmwork status` and `farmwork doctor` updated to only check what still exists:
  `CLAUDE.md`, `.claude/{agents,commands,skills}/`, `_AUDIT/{FARMHOUSE,GARDEN,COMPOST}.md`,
  `_PLANS/`.

### 1.4.6 (2025-12-29)
- **Major Architecture Change**: Migrated from phrase commands to **Skills**
- Added **6 Skills** in `.claude/skills/`:
  - `farm-audit` - "open the farm" workflow
  - `farm-inspect` - "count the herd" full inspection
  - `garden` - idea management (plant, water, compost)
  - `research` - systematic research
  - `production` - "go to production" readiness check
  - `market` - "go to market" i18n + accessibility

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
