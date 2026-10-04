#!/bin/bash
# Nightly run of the menu job (started by launchd, see install-nightly.sh). Keeps the Mac awake while it works,
# starts Ollama if it isn't running, and logs to ~/Library/Logs/menu-ingest.log.
set -u
cd "$(dirname "$0")"
LOG="$HOME/Library/Logs/menu-ingest.log"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
# Find a real node (the terminal's `node` can be a lazy-loading wrapper that doesn't exist for launchd).
NODE="$(command ls -d "$HOME"/.nvm/versions/node/*/bin/node 2>/dev/null | sort -V | tail -1)"
[ -n "$NODE" ] || NODE="$(command -v node || true)"
{
  echo "=== $(date) ==="
  if [ ! -f .env ]; then echo "No tools/menu-ingest/.env (live database keys). See README.md."; exit 1; fi
  if ! curl -s -m 3 http://localhost:11434/api/tags >/dev/null; then
    echo "Starting Ollama…"
    open -a Ollama 2>/dev/null || (nohup ollama serve >/dev/null 2>&1 &)
    for i in $(seq 1 30); do sleep 2; curl -s -m 3 http://localhost:11434/api/tags >/dev/null && break; done
  fi
  # caffeinate -i keeps the Mac from sleeping while the job runs; the job stops itself after 4 hours.
  [ -x "$NODE" ] || { echo "node not found"; exit 1; }
  [ -d node_modules/playwright ] || { echo "Packages missing in $(pwd): run ./install-nightly.sh again."; exit 1; }
  caffeinate -i "$NODE" run.mjs --write --limit "${MENU_LIMIT:-60}" --max-minutes 240
  echo "finished with code $?"
} >> "$LOG" 2>&1
