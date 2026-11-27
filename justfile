# farmwork — Maintained Justfile (https://just.systems)
# Keep these recipes accurate whenever scripts or workflows evolve.

set shell := ["bash", "-cu"]
set dotenv-load

# Show all available recipes
[default]
help:
    @just --list --unsorted

# Run linter / static checks
lint:
    npm run lint

# Run automated test suite
test:
    npm run test

# Build the project
build:
    npm run build

# Run full quality & security verification gates
check:
    farmwork gates

# Run deterministic secrets & dependency security scan
security:
    farmwork security

# Refresh _AUDIT/FARMHOUSE.md and tend the Idea Garden
audit:
    farmwork audit

# Show project health score & status
status:
    farmwork status

# Open the Local Farm Viewer in your browser
view:
    farmwork view

# Show unblocked Beads issues ready to work on
ready:
    bd ready

# List open Beads issues
issues:
    bd list --status open

# Sync Beads issue graph with git/remote
sync:
    bd sync
