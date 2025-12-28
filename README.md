<img src="/images/init.png" alt="Farmwork - Developer Methodology" width="500" />

> A workflow framework for Claude Code by Wynter Jones

## Quick Start

```bash
npm install -g farmwork
```

```bash
cd your-project
farmwork init
farmwork doctor
farmwork status
```

Or run directly with npx:

```bash
npx farmwork init
```

----

## The Farmwork Method

### Core Concepts

1. **FARMHOUSE.md** - Central command for tracking framework metrics
2. **Phrase Commands** - Natural language triggers for workflows
3. **Agents** - Specialized AI subagents for specific tasks
4. **Autonomously Issue Tracking** - Using beads (`bd`) for full visibility
5. **Living Audits** - Documents that track ongoing concerns
6. **Plan & Implement** - You describe the outcome, the rest is handled, tracked and audited
7. **Idea Garden & Compost** - Pre-plan creative stage with natural aging (ideas older than 60 days auto-compost)

### Phrase Commands

**Farmwork Phrases** (Development Workflow):
| Phrase | Action |
|--------|--------|
| `open the farm` | Audit systems, update FARMHOUSE.md metrics |
| `count the herd` | Full inspection and audit |
| `go to market` | i18n translation check + accessibility audit |
| `close the farm` | Full push workflow (lint, test, build, commit, push) |

**Plan Phrases**:
| Phrase | Action |
|--------|--------|
| `make a plan for...` | Create implementation plan in `_PLANS/` |
| `let's implement...` | Execute plan with issue tracking |

**Idea Phrases** (Pre-Plan Stage):
| Phrase | Action |
|--------|--------|
| `I have an idea for...` | Add new idea to `_AUDIT/GARDEN.md` with planted date |
| `let's plan this idea...` | Graduate idea from GARDEN → create plan |
| `compost this...` | Move rejected idea to `_AUDIT/COMPOST.md` |
| `water the garden` | Generate 10 new ideas based on GARDEN and COMPOST |

**Idea Lifecycle:**
- **Fresh** (0-44 days) - New ideas ready to develop
- **Wilting** (45-60 days) - Ideas aging, marked ⚠️ during audits
- **Composted** (60+ days) - Auto-moved to COMPOST during "open the farm"

**Research Phrases** (Pre-Plan Stage):
| Phrase | Action |
|--------|--------|
| `let's research...` | Create or update research document in `_RESEARCH/` |
| `update research on...` | Refresh existing research with new findings |
| `show research on...` | Display research summary and staleness status |

**Research Lifecycle:**
- **Fresh** (0-14 days) - Research is current and reliable
- **Aging** (15-30 days) - Consider refreshing for major decisions
- **Stale** (30+ days) - Recommend updating before using for plans

**Office Phrases** (Product Strategy & UX):
| Phrase | Action |
|--------|--------|
| `go to production` | UX production check: update `_OFFICE/` docs with audit trail |

### Slash Commands

| Command | Description |
|---------|-------------|
| `/push` | Clean, stage, lint, test, build, commit, push, update metrics (11 steps) |
| `/office` | Interactive strategy and UX command - updates CORE_LOOP, ONBOARDING, USER_GUIDE |

### Agents

15 specialized agents included:

| Agent | Purpose |
|-------|---------|
| `the-farmer` | Audit and update FARMHOUSE.md metrics |
| `code-reviewer` | Quality & security code review |
| `security-auditor` | OWASP vulnerability scanning |
| `performance-auditor` | Memory leaks, re-renders, anti-patterns |
| `code-smell-auditor` | DRY violations, complexity, naming |
| `accessibility-auditor` | WCAG 2.1 compliance, alt text, contrast |
| `unused-code-cleaner` | Detect and remove dead code |
| `code-cleaner` | Remove comments and console.logs |
| `i18n-locale-translator` | Translate UI text to locales |
| `storybook-maintainer` | Create/update Storybook stories |
| `idea-gardener` | Manage Idea Garden and Compost |
| `researcher` | Systematic research before planning |
| `strategy-agent` | Core loop strategy (what/stopping/why) |
| `onboarding-agent` | Tours, tooltips, modals, empty states |
| `user-guide-agent` | Feature documentation for help docs |

### Recommended Workflow

1. **Start Session**: Run `open the farm` to audit current state
2. **Capture Ideas**: Use `I have an idea for...` to plant ideas in GARDEN
3. **Research**: Use `let's research...` to gather information before planning
4. **Plan Work**: Use `make a plan for...` for new features
5. **Implement**: Use `let's implement...` to execute with tracking
6. **Quality Check**: Run `count the herd` for full audit + dry run
7. **Ship**: Run `close the farm` or `/push` to push changes

You can `go to market` when you have a production-ready app with international users.

## Directory Structure

```
your-project/
├── CLAUDE.md           # Main instructions & phrase commands
├── .claude/            # Claude Code configuration
│   ├── agents/         # 15 specialized subagents
│   │   ├── the-farmer.md
│   │   ├── code-reviewer.md
│   │   ├── security-auditor.md
│   │   ├── performance-auditor.md
│   │   ├── code-smell-auditor.md
│   │   ├── accessibility-auditor.md
│   │   ├── unused-code-cleaner.md
│   │   ├── code-cleaner.md
│   │   ├── i18n-locale-translator.md
│   │   ├── storybook-maintainer.md
│   │   ├── idea-gardener.md
│   │   ├── researcher.md
│   │   ├── strategy-agent.md      # Core loop strategy
│   │   ├── onboarding-agent.md    # UX onboarding
│   │   └── user-guide-agent.md    # Feature documentation
│   └── commands/       # User-invocable skills
│       ├── push.md
│       └── office.md   # Interactive strategy command
├── _AUDIT/             # Living audit documents
│   ├── FARMHOUSE.md    # Framework command center
│   ├── SECURITY.md     # Security posture
│   ├── PERFORMANCE.md  # Performance metrics
│   ├── ACCESSIBILITY.md # WCAG 2.1 compliance
│   ├── CODE_QUALITY.md # Code quality tracking
│   ├── TESTS.md        # Test coverage
│   ├── GARDEN.md       # Idea nursery (pre-plan stage)
│   └── COMPOST.md      # Rejected ideas archive
├── _OFFICE/            # Product strategy & UX docs
│   ├── CORE_LOOP.md    # What/Stopping/Why strategy
│   ├── ONBOARDING.md   # Tours, tooltips, modals
│   └── USER_GUIDE.md   # Feature documentation
├── _PLANS/             # Implementation plans
│   └── FEATURE_NAME.md
├── _RESEARCH/          # Research documents (living docs)
│   └── TOPIC_NAME.md
├── .beads/             # Issue tracking
└── justfile            # Navigation commands
```

<img src="/images/logo.png" alt="Farmwork - Developer Methodology" width="300" />

## Commands

### `farmwork init`

Start setting up the new digital farm:

```bash
farmwork init                    # Interactive setup wizard
```

**Options:**
- `-f, --force` - Overwrite existing files

**Storybook Support:**
If you enable Storybook (for React/Vue projects), the wizard will also ask for:
- Storybook URL (e.g., storybook.yoursite.com)
- Netlify Auth Token (for deployment)
- Netlify Site ID
- Password protection preference (recommended)

**Creates:**
- `CLAUDE.md` - Main instructions and phrase commands
- `.claude/` - Claude Code configuration directory
  - `agents/` - 15 specialized subagents
  - `commands/` - 2 user-invocable skills (/push, /office)
- `_AUDIT/` - Living audit documents
  - `FARMHOUSE.md` - Framework command center
  - `SECURITY.md` - Security posture tracking
  - `PERFORMANCE.md` - Performance metrics
  - `ACCESSIBILITY.md` - WCAG 2.1 compliance
  - `CODE_QUALITY.md` - Code quality tracking
  - `TESTS.md` - Test coverage tracking
  - `GARDEN.md` - Idea nursery (pre-plan stage)
  - `COMPOST.md` - Rejected ideas archive
- `_OFFICE/` - Product strategy & UX documents
  - `CORE_LOOP.md` - What/Stopping/Why strategy
  - `ONBOARDING.md` - Tours, tooltips, modals
  - `USER_GUIDE.md` - Feature documentation
- `_PLANS/` - Implementation plans directory
- `_RESEARCH/` - Research documents directory
- `justfile` - Navigation and task commands

### `farmwork status`

<img src="/images/status.png" alt="Farmwork Status" width="500" />

Display Farmwork status and metrics.

```bash
farmwork status
```

**Shows:**
- Component counts (agents, commands, audits, plans)
- Office documents status
- Issue tracking status (if beads is configured)
- FARMHOUSE score and open items
- Configuration file status
- Project metrics (tests, stories)

<img src="/images/status2.png" alt="Farmwork Status Details" width="500" />

### `farmwork doctor`

<img src="/images/doctor.png" alt="Farmwork Doctor" width="500" />

Check your Farmwork setup and diagnose issues.

```bash
farmwork doctor
```

**Checks:**
- Core files (CLAUDE.md, .claude/, settings)
- Agents and commands configuration
- Audit system (_AUDIT/, FARMHOUSE.md, _PLANS/)
- Research system (_RESEARCH/)
- Office system (_OFFICE/, CORE_LOOP.md, ONBOARDING.md, USER_GUIDE.md)
- Navigation (justfile, just command)
- Issue tracking (beads)
- Security (.gitignore settings)


## Requirements

- Node.js 18+
- [just](https://github.com/casey/just) (recommended for navigation)
- [beads](https://github.com/steveyegge/beads) (for issue tracking)

## License

MIT

## Links

- [Farmwork Website](https://farmwork.dev)
- [Wynter Jones](https://wynter.ai)
