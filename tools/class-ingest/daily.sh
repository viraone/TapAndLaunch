#!/bin/bash
# FitnessNav's nightly run (started by launchd at 10 PM, see install-daily.sh): reads every studio's class schedule,
# then rebuilds the preview page. Keeps the Mac awake while it works, starts Ollama if needed, logs to ~/Library/Logs/fitnessnav.log.
set -u
cd "$(dirname "$0")"
LOG="$HOME/Library/Logs/fitnessnav.log"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
NODE="$(command ls -d "$HOME"/.nvm/versions/node/*/bin/node 2>/dev/null | sort -V | tail -1)"
[ -n "$NODE" ] || NODE="$(command -v node || true)"
{
  echo "=== $(date) ==="
  # A date (YYYY-MM-DD) in a file named skip-until pauses the nightly run until that day; a run started by hand with
  # FN_FORCE=1 ignores it. The file goes away by itself once the day has come.
  if [ -f skip-until ] && [ -z "${FN_FORCE:-}" ]; then
    until_day="$(tr -d '[:space:]' < skip-until)"
    if [ "$(date +%F)" \< "$until_day" ]; then echo "Skipped on request until $until_day."; exit 0; fi
    rm -f skip-until
  fi
  [ -x "$NODE" ] || { echo "node not found"; exit 1; }
  [ -d node_modules/playwright ] || { echo "Packages missing in $(pwd): run ./install-daily.sh again."; exit 1; }
  if ! curl -s -m 3 http://localhost:11434/api/tags >/dev/null; then
    echo "Starting Ollama…"
    open -a Ollama 2>/dev/null || (nohup ollama serve >/dev/null 2>&1 &)
    for i in $(seq 1 30); do sleep 2; curl -s -m 3 http://localhost:11434/api/tags >/dev/null && break; done
  fi
  # A fresh folder each run, so a studio that fails today doesn't keep yesterday's classes.
  rm -rf out.new && mkdir out.new
  ONLY=()
  [ -n "${FN_ONLY:-}" ] && ONLY=(--only "$FN_ONLY")
  # macOS ships bash 3.2, where an empty array breaks under `set -u`: expand it only when it has something in it.
  caffeinate -i "$NODE" read.mjs studios.json out.new ${ONLY[@]+"${ONLY[@]}"}
  code=$?
  if [ $code -eq 0 ]; then
    rm -rf out && mv out.new out
    "$NODE" gen.mjs . && echo "Preview rebuilt: $(pwd)/fitnessnav.html"
    # To the live app (fitnessnav.tapandlaunch.com) when .env has the keys and the app id.
    [ -f .env ] && "$NODE" save.mjs out
  fi
  echo "finished with code $code"
} >> "$LOG" 2>&1
