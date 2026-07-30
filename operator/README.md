# The Operator

Farmwork manages one farm. The Operator manages **all of them**.

It's a global skill — installed once into `~/.claude` and `~/.codex`, not per-repo. It
keeps a registry of your farms grouped by purpose, sweeps their git state, pulls
checklist progress from FarmFactory, and tells you which farm to open next.

```
/operator
```

```
── Products ────────────────────────────────────
  DoTheseTasks         ████████░░  81%  main       3 uncommitted
  MakeThisVSL          ██████░░░░  62%  feat/hooks 2 unpushed
  OpenPaw              ██████████ 100%  main       clean

── Tools ───────────────────────────────────────
  Farmwork             ███████░░░  74%  main       clean
  FarmFactory                           main       behind 4, no CLAUDE.md

Suggestions
  1. DoTheseTasks has 3 uncommitted files — commit or stash before they rot.
  2. MakeThisVSL: feat/hooks is 2 commits ahead and unpushed.
  3. FarmFactory has no CLAUDE.md — run `npx farmwork init` to set it up.
```

## Install

```bash
git clone https://github.com/WynterJones/farmwork
cd farmwork/operator
./install.sh
```

Needs Node 18+. Installs to:

| Path | What |
|---|---|
| `~/.operator/bin/operator` | the CLI (symlinked onto PATH if possible) |
| `~/.operator/config.json` | your farm registry — **never overwritten on reinstall** |
| `~/.claude/skills/operator/` | the Claude Code skill |
| `~/.claude/commands/operator.md` | `/operator` in Claude Code |
| `~/.codex/prompts/operator.md` | `/operator` in Codex |

`./install.sh --uninstall` removes all of it and leaves your registry alone.

## Register your farms

```bash
operator add DoTheseTasks ~/Work/DoTheseTasks.com --group Products --slug dothesetasks
operator add Farmwork     ~/Work/farmwork         --group Tools    --desc "The harness CLI"
```

Or edit `~/.operator/config.json` directly:

```json
{
  "farmfactory": { "baseUrl": "https://farm.example.com", "apiKey": "…" },
  "groups": [
    {
      "name": "Products",
      "description": "Things with users",
      "farms": [
        {
          "name": "DoTheseTasks",
          "path": "/Users/you/Work/DoTheseTasks.com",
          "description": "Task extension + web app",
          "slug": "dothesetasks"
        }
      ]
    }
  ]
}
```

`slug` is optional — it's how a farm is matched to its FarmFactory checklist. Without
it the Operator falls back to matching on name.

## Connect FarmFactory

Create an API key in FarmFactory under **Admin → API Keys**, then either put
`baseUrl` and `apiKey` in the config, or export them:

```bash
export FARMFACTORY_URL="https://farm.example.com"
export FARMFACTORY_API_KEY="…"
```

Environment variables win over the config file, so you can keep the key out of the
file entirely. The git sweep works without any of this — only checklist commands need
the connection.

## Commands

The skill drives these for you, but they work standalone. Add `--json` to any of them.

```bash
operator status [group]              # git + checklist sweep
operator groups                      # groups with their farms
operator farms [group]               # registered farms and paths
operator add <name> <path> [--group G] [--slug S] [--desc D]
operator remove <name>

operator checklists                  # every checklist with progress
operator checklist <farm|id>         # one checklist, every item with its id
operator items                       # the checklist item catalog
operator new-checklist <farm>
operator delete-checklist <farm|id>
operator complete <farm|id> <itemId...>
operator skip <farm|id> <itemId>
operator reset <farm|id> <itemId>

operator config                      # resolved config, key redacted
```

Farm arguments accept a name, a slug, a directory name, or a numeric checklist id —
`operator checklist DoTheseTasks` and `operator checklist 7` are the same call.

`complete`, `skip`, and `reset` are idempotent. Completing an already-completed item
leaves it completed rather than toggling it off, so a retried request can't quietly
undo work.

## Talking to it

`/operator` alone gives the sweep. Everything else is prose:

```
/operator Tools
/operator what should I work on today
/operator checklist DoTheseTasks
/operator mark the CI item done in Farmwork
/operator add ~/Work/NewThing to Products
```

It asks before completing, skipping, or deleting anything — those change state that
other people see in FarmFactory.

See `reference/api.md` for the raw endpoints.
