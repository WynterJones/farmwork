#!/usr/bin/env bash
#
# Installs the Operator globally for Claude Code and Codex.
#
#   ./install.sh              install / update
#   ./install.sh --uninstall  remove everything it installed
#
set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OPERATOR_HOME="${OPERATOR_HOME:-$HOME/.operator}"
CLAUDE_HOME="${CLAUDE_HOME:-$HOME/.claude}"
CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"

SKILL_DIR="$CLAUDE_HOME/skills/operator"
CLAUDE_CMD="$CLAUDE_HOME/commands/operator.md"
CODEX_PROMPT="$CODEX_HOME/prompts/operator.md"
BIN="$OPERATOR_HOME/bin/operator"

green() { printf '\033[32m%s\033[0m\n' "$1"; }
gray()  { printf '\033[90m%s\033[0m\n' "$1"; }
warn()  { printf '\033[33m%s\033[0m\n' "$1"; }

if [ "${1:-}" = "--uninstall" ]; then
  rm -rf "$SKILL_DIR"
  rm -f "$CLAUDE_CMD" "$CODEX_PROMPT" "$BIN"
  for dir in /usr/local/bin "$HOME/.local/bin"; do
    [ -L "$dir/operator" ] && rm -f "$dir/operator"
  done
  green "Operator removed."
  gray  "Your farm registry at $OPERATOR_HOME/config.json was left in place."
  exit 0
fi

command -v node >/dev/null 2>&1 || { warn "Node 18+ is required but not on PATH."; exit 1; }

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 18 ]; then
  warn "Node 18+ is required (found $(node -v)) - the CLI uses built-in fetch."
  exit 1
fi

# CLI
mkdir -p "$OPERATOR_HOME/bin"
cp "$SRC/bin/operator.mjs" "$BIN"
chmod +x "$BIN"

# Claude Code: skill + slash command
mkdir -p "$SKILL_DIR/reference" "$CLAUDE_HOME/commands"
cp "$SRC/SKILL.md" "$SKILL_DIR/SKILL.md"
cp "$SRC/reference/api.md" "$SKILL_DIR/reference/api.md"
cp "$SRC/commands/operator.md" "$CLAUDE_CMD"

# Codex: slash prompt
mkdir -p "$CODEX_HOME/prompts"
cp "$SRC/codex/operator.md" "$CODEX_PROMPT"

# Put `operator` on PATH if we can do it without sudo.
LINKED=""
for dir in "$HOME/.local/bin" /usr/local/bin; do
  if [ -d "$dir" ] && [ -w "$dir" ]; then
    ln -sf "$BIN" "$dir/operator"
    LINKED="$dir/operator"
    break
  fi
done

# Registry - only ever created, never overwritten. Seeded empty rather than from
# config.example.json, so a fresh install doesn't report a farm that isn't there.
if [ ! -f "$OPERATOR_HOME/config.json" ]; then
  OPERATOR_HOME="$OPERATOR_HOME" node "$BIN" init >/dev/null
  CREATED_CONFIG=1
fi

green "Operator installed."
echo
gray "  CLI            $BIN"
[ -n "$LINKED" ] && gray "  on PATH        $LINKED"
gray "  Claude skill   $SKILL_DIR/SKILL.md"
gray "  Claude command $CLAUDE_CMD"
gray "  Codex prompt   $CODEX_PROMPT"
gray "  Registry       $OPERATOR_HOME/config.json"
echo

if [ -z "$LINKED" ]; then
  warn "Could not link 'operator' onto your PATH."
  gray "  Add this to your shell profile:"
  gray "    export PATH=\"\$PATH:$OPERATOR_HOME/bin\""
  echo
fi

if [ -n "${CREATED_CONFIG:-}" ]; then
  echo "Next:"
  gray "  1. Register a farm:  operator add MyApp ~/code/my-app --group Products"
  gray "  2. Connect FarmFactory: put baseUrl + apiKey in $OPERATOR_HOME/config.json"
  gray "  3. In Claude Code or Codex, run: /operator"
else
  gray "Existing registry left untouched. Run /operator to use it."
fi
