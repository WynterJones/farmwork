<img src="/logo.png" alt="Farmwork - Developer Methodology" width="500" />

# FARMWORK

> A workflow framework for Claude Code

...because building software should feel like tending a well-organized farm.

## Installation

```bash
npm install -g farmwork
```

Or run directly with npx:

```bash
npx farmwork init
```

## Quick Start

```bash
cd your-project
farmwork init
farmwork doctor
farmwork status
```

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
  - `settings.json` - Project settings
  - `agents/` - 9 specialized subagents
  - `commands/` - 2 user-invocable skills
- `_AUDIT/` - Living audit documents
  - `FARMHOUSE.md` - Framework command center
  - `SECURITY.md` - Security posture tracking
  - `PERFORMANCE.md` - Performance metrics
  - `CODE_QUALITY.md` - Code quality tracking
  - `TESTS.md` - Test coverage tracking
- `_PLANS/` - Implementation plans directory
- `justfile` - Navigation and task commands

### `farmwork status`

<img src="/status.png" alt="Farmwork Status" width="500" />

Display Farmwork status and metrics.

```bash
farmwork status
```

**Shows:**
- Component counts (agents, commands, audits, plans)
- Issue tracking status (if beads is configured)
- FARMHOUSE score and open items
- Configuration file status
- Project metrics (tests, stories)

<img src="/status2.png" alt="Farmwork Status Details" width="500" />

### `farmwork doctor`

<img src="/doctor.png" alt="Farmwork Doctor" width="500" />

Check your Farmwork setup and diagnose issues.

```bash
farmwork doctor
```

**Checks:**
- Core files (CLAUDE.md, .claude/, settings)
- Agents and commands configuration
- Audit system (_AUDIT/, FARMHOUSE.md, _PLANS/)
- Navigation (justfile, just command)
- Issue tracking (beads)
- Security (.gitignore settings)

## The Farmwork Method

### Core Concepts

1. **FARMHOUSE.md** - Central command for tracking framework metrics
2. **Phrase Commands** - Natural language triggers for workflows
3. **Agents** - Specialized AI subagents for specific tasks
4. **Commands** - User-invocable skills (triggered with `/command`)
5. **Issue Tracking** - Using beads (`bd`) for full visibility
6. **Living Audits** - Documents that track ongoing concerns

### Phrase Commands

**Farmwork Phrases** (Development Workflow):
| Phrase | Action |
|--------|--------|
| `till the land` | Audit systems, update FARMHOUSE.md metrics |
| `inspect the farm` | Full inspection (code review, performance, security, quality) |
| `go to market` | i18n translation check |
| `harvest crops` | Full push workflow (lint, test, build, commit, push) |
| `open the farm` | Full audit cycle, then ask to proceed |

**Plan Phrases**:
| Phrase | Action |
|--------|--------|
| `make a plan for...` | Create implementation plan in `_PLANS/` |
| `let's implement...` | Execute plan with issue tracking |

### Slash Commands

| Command | Description |
|---------|-------------|
| `/push` | Stage, lint, test, build, commit, push |
| `/open-the-farm` | Full audit cycle with summary report |

### Agents

9 specialized agents included:

| Agent | Purpose |
|-------|---------|
| `the-farmer` | Audit and update FARMHOUSE.md metrics |
| `code-reviewer` | Quality & security code review |
| `security-auditor` | OWASP vulnerability scanning |
| `performance-auditor` | Memory leaks, re-renders, anti-patterns |
| `code-smell-auditor` | DRY violations, complexity, naming |
| `unused-code-cleaner` | Detect and remove dead code |
| `code-cleaner` | Remove comments and console.logs |
| `i18n-locale-translator` | Translate UI text to locales |
| `storybook-maintainer` | Create/update Storybook stories |

### Recommended Workflow

1. **Start Session**: Run `till the land` to audit current state
2. **Plan Work**: Use `make a plan for...` for new features
3. **Implement**: Use `let's implement...` to execute with tracking
4. **Quality Check**: Run `inspect the farm` or `/open-the-farm`
5. **Ship**: Run `harvest crops` or `/push` to push changes

## Directory Structure

```
your-project/
├── CLAUDE.md           # Main instructions & phrase commands
├── .claude/            # Claude Code configuration
│   ├── agents/         # 9 specialized subagents
│   │   ├── the-farmer.md
│   │   ├── code-reviewer.md
│   │   ├── security-auditor.md
│   │   ├── performance-auditor.md
│   │   ├── code-smell-auditor.md
│   │   ├── unused-code-cleaner.md
│   │   ├── code-cleaner.md
│   │   ├── i18n-locale-translator.md
│   │   └── storybook-maintainer.md
│   └── commands/       # User-invocable skills
│       ├── push.md
│       └── open-the-farm.md
├── _AUDIT/             # Living audit documents
│   ├── FARMHOUSE.md    # Framework command center
│   ├── SECURITY.md     # Security posture
│   ├── PERFORMANCE.md  # Performance metrics
│   ├── CODE_QUALITY.md # Code quality tracking
│   └── TESTS.md        # Test coverage
├── _PLANS/             # Implementation plans
│   └── FEATURE_NAME.md
├── .beads/             # Issue tracking
└── justfile            # Navigation commands
```

## Requirements

- Node.js 18+
- [just](https://github.com/casey/just) (recommended for navigation)
- [beads](https://github.com/steveyegge/beads) (for issue tracking)

## License

MIT

## Links

- [Farmwork Documentation](https://farmwork.wynter.ai)
- [GitHub Repository](https://github.com/wynterjones/farmwork)
