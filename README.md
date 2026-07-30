<img src="logo.png" alt="Farmwork - Developer Methodology" width="300" />

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

`farmwork init` auto-detects your package manager and test/build/lint commands from
`package.json` - there's nothing else to configure.

----

## The Farmwork Method

Farmwork is intentionally small: **7 commands, 4 agents**. No issue tracker, no task
runner, no product-strategy scaffolding - just the practices that pull their weight.

### Core Concepts

1. **Slash Commands** - Every workflow is an explicit command. Nothing fires on its own.
2. **Agents** - 4 focused AI subagents the commands delegate to
3. **Living Audits** - `_AUDIT/FARMHOUSE.md` tracks metrics over time
4. **Plan & Implement** - Plans are saved before implementation
5. **Idea Garden** - Pre-plan creative stage with natural aging

### Commands

Type `/` in Claude Code to see them all. Each does exactly one thing.

| Command | What It Does |
|---------|--------------|
| `/audit` | Refresh FARMHOUSE.md metrics and tend the Idea Garden |
| `/inspect` | Everything in `/audit`, plus a full code review and dry-run quality gates |
| `/add-idea` | Plant a new idea in GARDEN.md |
| `/new-ideas` | Generate 10 fresh ideas and plant the ones you pick |
| `/compost` | Retire an idea to COMPOST.md with a reason |
| `/plan-idea` | Graduate an idea into a plan in `_PLANS/` |
| `/push` | Clean, review, test, build, commit, push, update metrics |

`/audit` and `/inspect` never commit. Use `/push` to ship.

### Agents

4 focused agents included:

| Agent | Purpose |
|-------|---------|
| `the-farmer` | Audit and update FARMHOUSE.md metrics |
| `code-reviewer` | Quality, security (OWASP-lite), performance, code smells, and basic accessibility - reports inline |
| `code-cleaner` | Remove comments (except JSDoc), console.logs, and obvious dead code |
| `idea-gardener` | Manage the Idea Garden and Compost |

### Recommended Workflow

1. **Start Session**: `/audit` to see where things stand
2. **Capture Ideas**: `/add-idea` as they occur to you, `/new-ideas` when you're stuck
3. **Plan Work**: `/plan-idea` to turn one into a plan in `_PLANS/`
4. **Implement**: Build the feature
5. **Quality Check**: `/inspect` for a full review before shipping
6. **Ship**: `/push` to clean, gate, commit, and push

## Directory Structure

```
your-project/
├── CLAUDE.md              # Lean instructions (points at the commands)
├── AGENTS.md              # Points other AI tools at the same command files
├── _AUDIT/                 # Living audit + idea documents
│   ├── FARMHOUSE.md         # Framework command center / metrics
│   ├── GARDEN.md            # Idea nursery
│   └── COMPOST.md           # Rejected ideas archive
├── _PLANS/                 # Implementation plans
└── .claude/                # Claude Code configuration
    ├── commands/            # 7 slash commands - the workflows themselves
    │   ├── audit.md
    │   ├── inspect.md
    │   ├── add-idea.md
    │   ├── new-ideas.md
    │   ├── compost.md
    │   ├── plan-idea.md
    │   └── push.md
    └── agents/              # 4 subagents the commands delegate to
        ├── the-farmer.md
        ├── code-reviewer.md
        ├── code-cleaner.md
        └── idea-gardener.md
```

## Commands

### `farmwork init`

Set up your farm. Close to non-interactive - Farmwork detects your package manager
(from lockfiles) and test/build/lint commands (from `package.json` scripts) on its own.

```bash
farmwork init                    # Auto-detects everything, confirms and goes
```

**Options:**
- `-f, --force` - Overwrite existing files without prompting

**Creates:**
- `CLAUDE.md` - Lean instructions pointing at the commands
- `AGENTS.md` - Points Codex, Gemini CLI, and other tools at those same command files
- `.claude/` - Claude Code configuration directory
  - `commands/` - 7 slash commands
  - `agents/` - 4 focused subagents
- `_AUDIT/` - Living audit documents: `FARMHOUSE.md`, `GARDEN.md`, `COMPOST.md`
- `_PLANS/` - Implementation plans directory

### `farmwork status`

Display Farmwork status and metrics.

```bash
farmwork status
```

**Shows:**
- Component counts (commands, agents, audits, plans)
- FARMHOUSE score
- Configuration file status
- Test file count

### `farmwork doctor`

Check your Farmwork setup and diagnose issues.

```bash
farmwork doctor
```

**Checks:**
- Core files (CLAUDE.md, `.claude/`)
- Agents and commands configuration
- Audit system (`_AUDIT/FARMHOUSE.md`, `_AUDIT/GARDEN.md`, `_AUDIT/COMPOST.md`, `_PLANS/`)
- Security (`.gitignore` settings)

## Cross-Tool Support

Because every workflow is a plain markdown file in `.claude/commands/`, Farmwork
travels. Codex reads command files directly - copy them into `~/.codex/prompts/` and
`/audit`, `/push`, and the rest work there too. For anything else, the generated
`AGENTS.md` points at those same files rather than restating them, so the instructions
can't drift out of sync with what Claude Code actually runs.

## Managing Many Farms

Farmwork operates inside one repo. When you have a dozen, [the Operator](operator/)
sits above them all - a globally-installed skill that sweeps every farm's git state,
groups them by purpose, and tracks checklist progress. See [`operator/`](operator/).

## Requirements

- [Claude Code](https://claude.com/claude-code), or another AI coding assistant that
  reads `AGENTS.md` (Codex, Gemini CLI, etc.)
- Node.js 18+

No other tools required - Farmwork has no external CLI dependencies.

## License

MIT

## Links

- [Farmwork Website](https://farmwork.dev)
- [Wynter Jones](https://wynter.ai)
