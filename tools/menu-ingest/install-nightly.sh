#!/bin/bash
# Turns on the nightly menu job (about 2:30 AM). Undo with:  ./install-nightly.sh remove
set -e
LABEL="com.tapandlaunch.menu-ingest"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
DIR="$(cd "$(dirname "$0")" && pwd)"
if [ "${1:-}" = "remove" ]; then
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  rm -f "$PLIST"
  echo "Nightly menu job removed."
  exit 0
fi
[ -f "$DIR/.env" ] || { echo "Create $DIR/.env first (see README.md)."; exit 1; }
mkdir -p "$HOME/Library/LaunchAgents"
cat > "$PLIST" <<PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array><string>/bin/bash</string><string>$DIR/nightly.sh</string></array>
  <key>StartCalendarInterval</key><dict><key>Hour</key><integer>2</integer><key>Minute</key><integer>30</integer></dict>
  <key>RunAtLoad</key><false/>
</dict></plist>
PLISTEOF
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "Nightly menu job is on: every night at 2:30 AM (log: ~/Library/Logs/menu-ingest.log)."
echo "If the Mac is asleep at 2:30 it runs when it wakes. Turn off with: ./install-nightly.sh remove"
