#!/bin/bash
# Turns on FitnessNav's nightly run (10:00 PM every day). Undo with:  ./install-daily.sh remove
#
# macOS doesn't let a background job read ~/Desktop, so this copies the job to ~/.fitnessnav-job and the schedule runs it from there.
# Run this script again after changing anything in this folder (it re-copies the files; the job's results stay).
set -e
LABEL="com.tapandlaunch.fitnessnav"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
SRC="$(cd "$(dirname "$0")" && pwd)"
DEST="$HOME/.fitnessnav-job"
if [ "${1:-}" = "remove" ]; then
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  rm -f "$PLIST"
  echo "FitnessNav nightly run removed. (The copy in $DEST is still there; delete it if you like.)"
  exit 0
fi
mkdir -p "$DEST" "$HOME/Library/LaunchAgents"
for f in read.mjs gen.mjs save.mjs classify.mjs template.html studios.json daily.sh package.json; do cp "$SRC/$f" "$DEST/$f"; done
[ -f "$SRC/.env" ] && cp "$SRC/.env" "$DEST/.env" && chmod 600 "$DEST/.env"
[ -f "$SRC/package-lock.json" ] && cp "$SRC/package-lock.json" "$DEST/package-lock.json"
chmod +x "$DEST/daily.sh"
echo "Copied the job to $DEST; installing its packages…"
(cd "$DEST" && if [ -f package-lock.json ]; then npm ci --no-audit --no-fund --silent; else npm install --no-audit --no-fund --silent; fi)
cat > "$PLIST" <<PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array><string>/bin/bash</string><string>$DEST/daily.sh</string></array>
  <key>StartCalendarInterval</key><dict><key>Hour</key><integer>22</integer><key>Minute</key><integer>0</integer></dict>
  <key>RunAtLoad</key><false/>
  <key>StandardErrorPath</key><string>$HOME/Library/Logs/fitnessnav.launchd.log</string>
</dict></plist>
PLISTEOF
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "FitnessNav nightly run is on: every day at 10:00 PM (log: ~/Library/Logs/fitnessnav.log)."
echo "If the Mac is asleep at 10 PM it runs when it next wakes (the page stays a day old until then). Turn off with: ./install-daily.sh remove"
