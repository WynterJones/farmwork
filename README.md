<img src="logo.png" alt="Farmwork - Agent-First Standards & MCP" width="260" />

> **Farmwork v3** — Agent-first engineering standards, an MCP server any AI agent can use natively, and a zero-server Local Farm Viewer for your Markdown docs and checklists.

Built for **real projects beyond prototypes** where you want Claude Code, Gemini CLI, Codex, Cursor, or Antigravity to follow consistent planning, auditing, checklist, and quality-gate standards without prompt drift or hosted dashboards.

---

## Quick Start

```bash
npm install -g farmwork
```

Initialize any repo (Node/TS, Ruby/Rails, Python, Rust, or Go):

```bash
cd your-project
farmwork init
```

Open the **Local Farm Viewer** for one project or a folder full of projects:

```bash
farmwork view            # view current project
farmwork view ~/Work     # view all local Farmwork projects in ~/Work
```

---

## Connect Any AI Agent via MCP

`farmwork init` writes a `.mcp.json` automatically so Claude Code, Cursor, and Antigravity discover Farmwork out of the box.

To register Farmwork globally for any MCP-capable agent:

```json
{
  "mcpServers": {
    "farmwork": {
      "command": "npx",
      "args": ["-y", "farmwork", "mcp"]
    }
  }
}
```

Or in **Claude Code**:

```bash
claude mcp add farmwork -- npx -y farmwork mcp
```

Or in **Gemini CLI** (`~/.gemini/settings.json`) / **Codex** (`~/.codex/config.toml`): point an MCP server entry at `npx -y farmwork mcp` (or `farmwork mcp` if installed globally).

---

## What the MCP Server Gives Your Agents

### 6 Lean Deterministic Tools

| Tool | What It Does |
|---|---|
| `farmwork_status` | Deterministic health score (0–10), pillar scores, stack, polyglot test count, verified gate status, checklist %, garden, plans, git state |
| `farmwork_audit` | Age Idea Garden & refresh `_AUDIT/FARMHOUSE.md`, OR run/save lazy pillar audits (`security`, `performance`, `accessibility`, `code-quality`) |
| `farmwork_gates` | Run detected `lint`, `test`, `build`, and local `security` secrets check, saving verified results |
| `farmwork_checklist` | Read or idempotently `complete`, `pending`, `skip`, or `add` items in `_AUDIT/CHECKLIST.md` |
| `farmwork_garden` | `list`, `plant`, or `compost` pre-plan ideas in `_AUDIT/GARDEN.md` (lazily creates `_AUDIT/COMPOST.md`) |
| `farmwork_plan` | `list`, `create` (graduates linked garden ideas), or `complete` plans in `_PLANS/` |

### 5 Live Resources
- `farmwork://standards` — Universal agent engineering standards
- `farmwork://farmhouse` — `_AUDIT/FARMHOUSE.md`
- `farmwork://checklist` — `_AUDIT/CHECKLIST.md`
- `farmwork://garden` — `_AUDIT/GARDEN.md`
- `farmwork://compost` — `_AUDIT/COMPOST.md`

### 7 Workflow Prompts
`audit`, `inspect`, `security`, `performance`, `plan`, `new-ideas`, and `ship` — exposed natively via MCP so you never copy-paste slash-command files across tools.

---

## Repo Structure

```text
your-project/
├── .farmwork.json         # Manifest: detected stack + lint/test/build commands
├── .mcp.json              # Auto-wires the Farmwork MCP server
├── AGENTS.md              # Lean universal instructions for any AI agent
├── CLAUDE.md              # Lean pointer to AGENTS.md + MCP
├── _AUDIT/
│   ├── FARMHOUSE.md       # Deterministic health report & audit history
│   ├── CHECKLIST.md       # Stack-aware living standards ([x], [ ], [-] skip)
│   └── GARDEN.md          # Pre-plan ideas with natural 45d/60d aging (COMPOST.md created on demand)
└── _PLANS/
    └── FEATURE_NAME.md    # Plan-before-implement specs
```

---

## CLI Reference

```bash
farmwork init [-f] [-y] [--reinstall] [--npx] [--no-mcp]  # Set up Farmwork v3 in current repo
farmwork mcp [--cwd <path>]                               # Run MCP server over stdio
farmwork view [path] [-p 4174]                            # Open Local Farm Viewer (1 repo or folder of repos)
farmwork status [--json]                                  # Deterministic health score & pillar scores
farmwork audit [--json]                                   # Refresh FARMHOUSE.md & tend Idea Garden
farmwork gates [--only lint,test,build,security]          # Run quality & security gates
farmwork security [--skip-deps] [--json]                  # Deterministic secrets & dependency vulnerability scan
farmwork doctor [--json]                                  # Diagnose configuration issues
```

---

## Past Farmwork Projects (v1 / v2)

Farmwork v3 **never auto-updates or modifies past Farmwork v1/v2 projects**.
- `farmwork view ~/Work` opens legacy repos in **read-only mode** so you can browse their docs without risking accidental edits.
- `farmwork init`, `farmwork audit`, and mutating MCP tools refuse to modify legacy v1/v2 repos.
- To explicitly move an older project to v3, run **`farmwork init --reinstall`** inside that repo (replaces `.farmwork.json`, `AGENTS.md`, `CLAUDE.md`, and `_AUDIT/FARMHOUSE.md`, safely merges `.mcp.json`, and preserves `_PLANS/`, `GARDEN.md`, and `COMPOST.md`).

---

## What Changed in v3.0.0

- **Agent-First MCP Server:** Replaced static Claude-only `.claude/commands` & `.claude/agents` markdown prompts with a real MCP server (`farmwork mcp`) usable by Claude, Gemini, Codex, Cursor, and Antigravity.
- **Local Farm Viewer (`farmwork view`):** Replaced hosted FarmFactory with a zero-database local viewer that reads and writes your `.md` files and checklists straight on disk.
- **Removed unnecessary bloat:** Dropped `operator/`, legacy v1 phrase triggers, hardcoded `model: opus` prompts, destructive comment-stripping rules, and JS-only test counting.
- **True Polyglot & Deterministic:** Auto-detects Node/TS, Ruby/Rails, Python, Rust, and Go, counts real test files across languages, and computes a transparent 0–10 health score.

---

## License

MIT · Created by [Wynter Jones](https://wynter.ai) · [farmwork.dev](https://farmwork.dev)
