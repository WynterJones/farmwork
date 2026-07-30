---
description: Sweep every farm, report what needs attention, and manage FarmFactory checklists
argument-hint: [group | farm | "checklist <farm>" | "complete <item> in <farm>"]
allowed-tools: Bash, Read, Grep, Glob
---

Use the **operator** skill.

Arguments: $ARGUMENTS

With no arguments, run `operator status --json` and give the user a short digest
grouped by farm group — problems first, clean farms collapsed into one line — followed
by 3–5 concrete suggestions ranked by value.

With arguments, read them as intent: a group name scopes the sweep, a farm name
focuses on that farm, and anything else is a request to answer using the `operator`
CLI. Ask before any write (complete, skip, delete).
