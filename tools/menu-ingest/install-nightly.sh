#!/bin/bash
# Turns on the nightly menu job (about 2:30 AM). Undo with:  ./install-nightly.sh remove
#
# macOS doesn't let a background job read ~/Desktop, ~/Documents or ~/Downloads, so the job can't run from the repo
# when the repo lives there. This copies the job to ~/.livebites-menu-job and the schedule runs it from there.
# Run this script again after any change to the job's files here (it re-copies them; the saved .env stays).
set -e
LABEL="com.tapandlaunch.menu-ingest"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
SRC="$(cd "$(dirname "$0")" && pwd)"
DEST="$HOME/.livebites-menu-job"
if [ "${1:-}" = "remove" ]; then
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  rm -f "$PLIST"
  echo "Nightly menu job removed. (The copy in $DEST is still there; delete it if you like.)"
  exit 0
fi
[ -f "$SRC/.env" ] || [ -f "$DEST/.env" ] || { echo "Create $SRC/.env first (see README.md)."; exit 1; }
mkdir -p "$DEST" "$HOME/Library/LaunchAgents"
for f in run.mjs lib.mjs nightly.sh package.json package-lock.json; do cp "$SRC/$f" "$DEST/$f"; done
[ -f "$SRC/.env" ] && cp "$SRC/.env" "$DEST/.env" && chmod 600 "$DEST/.env"
chmod +x "$DEST/nightly.sh"
echo "Copied the job to $DEST; installing its packages…"
(cd "$DEST" && npm ci --no-audit --no-fund --silent)
cat > "$PLIST" <<PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array><string>/bin/bash</string><string>$DEST/nightly.sh</string></array>
  <key>StartCalendarInterval</key><dict><key>Hour</key><integer>2</integer><key>Minute</key><integer>30</integer></dict>
  <key>RunAtLoad</key><false/>
  <key>StandardErrorPath</key><string>$HOME/Library/Logs/menu-ingest.launchd.log</string>
</dict></plist>
PLISTEOF
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "Nightly menu job is on: every night at 2:30 AM (log: ~/Library/Logs/menu-ingest.log)."
echo "If the Mac is asleep at 2:30 it runs when it wakes. Turn off with: ./install-nightly.sh remove"
