<img src="/logo.png" alt="Farmwork - Developer Methodology" width="200" />

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
# Initialize in your project
cd your-project
farmwork init

# Check your setup
farmwork doctor

# View framework status
farmwork status
```

## Commands

### `farmwork init`

Initialize the Farmwork framework in your current directory. Runs an interactive setup wizard to configure your project for any tech stack.

```bash
farmwork init                    # Interactive setup wizard
farmwork init -f                 # Force overwrite existing files
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
  - `agents/` - Specialized subagents
  - `commands/` - User-invocable skills
- `_AUDIT/` - Living audit documents
  - `FARMHOUSE.md` - Framework command center
- `_PLANS/` - Implementation plans directory
- `justfile` - Navigation and task commands

### `farmwork add <type> <name>`

Add a new component to your Farmwork setup.

```bash
farmwork add agent code-reviewer     # Add a new agent
farmwork add command deploy          # Add a new command
farmwork add audit performance       # Add a new audit document
```

**Types:**
- `agent` - Creates `.claude/agents/<name>.md`
- `command` - Creates `.claude/commands/<name>.md`
- `audit` - Creates `_AUDIT/<NAME>.md`

### `farmwork status`

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

### `farmwork doctor`

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
- `till the land` - Audit systems, update metrics
- `inspect the farm` - Full inspection (code review, performance, security, quality)
- `go to market` - i18n translation check
- `harvest crops` - Full push workflow

**Plan Phrases**:
- `make a plan for...` - Create implementation plan
- `let's implement...` - Execute plan with issue tracking

### Recommended Workflow

1. **Start Session**: Run `till the land` to audit current state
2. **Plan Work**: Use `make a plan for...` for new features
3. **Implement**: Use `let's implement...` to execute with tracking
4. **Quality Check**: Run `inspect the farm`
5. **Ship**: Run `harvest crops` to push changes

## Directory Structure

```
your-project/
├── CLAUDE.md           # Main instructions & phrase commands
├── .claude/            # Claude Code configuration
│   ├── settings.json   # Project settings
│   ├── agents/         # Specialized subagents
│   │   ├── code-reviewer.md
│   │   ├── security-auditor.md
│   │   └── ...
│   └── commands/       # User-invocable skills
│       ├── push.md
│       └── ...
├── _AUDIT/             # Living audit documents
│   ├── FARMHOUSE.md    # Framework command center
│   ├── SECURITY.md
│   ├── PERFORMANCE.md
│   └── ...
├── _PLANS/             # Implementation plans
│   └── FEATURE_NAME.md
├── .beads/             # Issue tracking (optional)
└── justfile            # Navigation commands
```

## Requirements

- Node.js 18+
- [just](https://github.com/casey/just) (recommended for navigation)
- [beads](https://github.com/steveyegge/beads) (optional, for issue tracking)

## License

MIT

## Links

- [Farmwork Documentation](https://farmwork.wynter.ai)
- [GitHub Repository](https://github.com/wynterjones/farmwork)
