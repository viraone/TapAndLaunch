#!/bin/bash
# Daily run (10 AM) of the menu + happy hour job (started by launchd, see install-nightly.sh). Keeps the Mac awake while it works,
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
  # caffeinate -i keeps the Mac from sleeping while the job runs; each step stops itself.
  [ -x "$NODE" ] || { echo "node not found"; exit 1; }
  [ -d node_modules/playwright ] || { echo "Packages missing in $(pwd): run ./install-nightly.sh again."; exit 1; }
  # One run does, in order (each step carries on even if an earlier one failed):
  #  1. seed.mjs     open the next not-yet-covered Seattle neighborhoods in the app (budget-capped), so their restaurants exist
  #  2. run.mjs --happy-only   quick pass over every place with a website: bars first, chains skipped (~10-20 s a place)
  #  3. run.mjs      the slow menu pass (menus + happy hours) for what is due
  #  4. report.mjs   push notification to the owner's phone with how it went
  # caffeinate -i keeps the Mac from sleeping while it works; the steps stop themselves (about 3.5 hours in all).
  caffeinate -i bash -c '
    "$0" seed.mjs --limit "${SEED_LIMIT:-8}"; echo "seed finished with code $?"
    "$0" run.mjs --write --happy-only --limit "${HAPPY_LIMIT:-200}" --max-minutes 120; echo "happy hour pass finished with code $?"
    "$0" run.mjs --write --limit "${MENU_LIMIT:-40}" --max-minutes 90; echo "menu pass finished with code $?"
    "$0" report.mjs; echo "report finished with code $?"
  ' "$NODE"
  echo "finished"
} >> "$LOG" 2>&1
