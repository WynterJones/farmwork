# farmwork — Agent Instructions

Uses **Farmwork v3** (`.mcp.json` → `farmwork mcp`), **Beads** (`.beads/`), and a maintained **`justfile`**.

## Workflow Rules
1. **Checklists = Humans & Big Picture (`_AUDIT/CHECKLIST.md`):** Keep concise (<=30 items) so humans can scan standards, **big plans**, and **future plans** at a glance. When the user says "big plan" or mentions a future plan, add one concise item under `## Big Plans & Future Roadmap` and link its Beads epic (`beads: <id>`). NEVER put granular tasks in the checklist.
2. **Beads = Agents & Execution (`.beads/`):** Break active work into granular tasks and dependencies in Beads (`bd ready` → claim → close → `bd sync`, or `farmwork_beads`). Graduate plan steps via `farmwork_plan` (`to-beads`), which links the Beads epic back to the checklist; closing that epic checks the item off.
3. **Plan first:** Save non-trivial specs to `_PLANS/` via `farmwork_plan` (`create`) and confirm before large edits.
4. **Maintain `justfile`:** Run `just --list` / `just check`; update `justfile` whenever scripts change.
5. **Explicit state machines:** Avoid boolean flag explosions (`isLoading`/`isError`/`isSaving`) and loose status strings. Model lifecycles with native language types/enums and guarded transitions — no state-machine library required.
6. **Verify before shipping:** Run `farmwork_gates` (lint, test, build, security), keep modules under 700 lines, preserve "why" comments, plant tangents in `_AUDIT/GARDEN.md`, and refresh `_AUDIT/FARMHOUSE.md` with `farmwork_audit`.

## Commands (`mcp-node`)
- **Justfile:** `just --list` · `just check` · `just ready`
- **Lint:** `npm run lint`
- **Test:** `npm run test`
- **Build:** `npm run build`

## MCP Tools (`farmwork`)
`farmwork_status` · `farmwork_audit` (incl. lazy `security`/`performance`/`accessibility`/`code-quality` pillars) · `farmwork_gates` · `farmwork_beads` (agent tasks) · `farmwork_checklist` (human big plans & standards) · `farmwork_just` · `farmwork_garden` · `farmwork_plan`

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
