#!/bin/bash
# ship.sh — Backup + deploy + auto-package for user to drop into GitHub repo
set -e
cd "$(dirname "$0")"

TS=$(date +%Y-%m-%d-%H%M)
BACKUP=".backups/index-${TS}.html"

# 1. Save backup
mkdir -p .backups
cp index.html "$BACKUP"
SIZE=$(du -h "$BACKUP" | cut -f1)
echo "✓ Backup: $BACKUP ($SIZE)"

# 2. Trim to 20 most recent
COUNT=$(ls -1 .backups/index-*.html 2>/dev/null | wc -l)
if [ "$COUNT" -gt 20 ]; then
  ls -1t .backups/index-*.html | tail -n +21 | xargs rm -f
fi

# 3. Copy to outputs
mkdir -p /mnt/user-data/outputs
cp index.html /mnt/user-data/outputs/ticket_organizer.html

# 4. Package CHANGELOG + index.html together for one-click drop-in
TMP=/tmp/github-drop-${TS}
mkdir -p "$TMP"
cp index.html "$TMP/index.html"
cp CHANGELOG.md "$TMP/CHANGELOG.md" 2>/dev/null || true
cd /tmp && zip -q -r "github-drop-${TS}.zip" "github-drop-${TS}/"
cp "/tmp/github-drop-${TS}.zip" /mnt/user-data/outputs/

echo "✓ Shipped: ticket_organizer.html"
echo "✓ Drop-in zip: github-drop-${TS}.zip"
echo ""
echo "📝 Don't forget to update CHANGELOG.md"
