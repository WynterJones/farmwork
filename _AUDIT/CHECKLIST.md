# Project Checklist

> Human-readable big-picture standards, **big plans**, and **future roadmap** for **farmwork** (`mcp-node`). Keep concise (<=30 items) — granular execution tasks belong in Beads (`.beads/`). Use `[x]` done, `[ ]` pending, or `[-]` skipped (excluded from completion %).

## Foundation
- [x] Farmwork v3 initialized (`.farmwork.json` & `AGENTS.md`)
- [x] `justfile` maintained with accurate dev, lint, test, and build recipes
- [x] Active agent tasks & dependencies tracked in Beads (`bd ready` / `bd sync`)
- [x] README documents local setup and architecture
- [-] Environment variables documented in `.env.example`

## Quality & Testing
- [x] Automated test suite runs cleanly via `farmwork_gates`
- [x] Linter / static analysis passes with zero errors
- [x] Production build succeeds cleanly
- [x] Implicit state machines (boolean flag clusters, loose status strings) audited and modeled with native types/enums

## MCP Server Standards
- [x] Zero stdout pollution on stdio transport (logs go to stderr only)
- [x] All tool input schemas validated with strict types and clear descriptions
- [x] Tool failures return structured `isError` responses without crashing the server

## Security & Shipping
- [x] Secrets excluded via `.gitignore` and never committed
- [x] Error handling & logging verified for production paths
- [x] Deployment / release workflow verified

## Big Plans & Future Roadmap
<!-- Concise big plans & future roadmap items for humans. Link Beads epics with `(beads: <id>)`; keep granular task breakdowns in Beads. -->
