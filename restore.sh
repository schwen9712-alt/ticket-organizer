#!/bin/bash
# restore.sh — Restore from a backup
# Usage:
#   bash restore.sh           # List available backups
#   bash restore.sh latest    # Restore from most recent backup
#   bash restore.sh 2026-05-23-0414   # Restore from specific timestamp
#
# Always creates a "pre-restore" snapshot before overwriting, so even
# the restore action itself is reversible.

set -e
cd "$(dirname "$0")"

if [ -z "$1" ]; then
  echo "Available backups:"
  ls -lht .backups/index-*.html 2>/dev/null | awk '{print $9, "("$5")"}'
  echo ""
  echo "Usage: bash restore.sh latest    (or specific timestamp)"
  exit 0
fi

if [ "$1" = "latest" ]; then
  BACKUP=$(ls -1t .backups/index-*.html 2>/dev/null | head -1)
else
  BACKUP=".backups/index-$1.html"
fi

if [ ! -f "$BACKUP" ]; then
  echo "❌ Backup not found: $BACKUP"
  exit 1
fi

# Snapshot current state before restoring (safety net)
PRE_RESTORE=".backups/pre-restore-$(date +%Y-%m-%d-%H%M).html"
cp index.html "$PRE_RESTORE"
echo "✓ Current state saved to: $PRE_RESTORE"

# Restore
cp "$BACKUP" index.html
echo "✓ Restored from: $BACKUP"
echo ""
echo "⚠️  Remember to add a CHANGELOG entry documenting the rollback and why"
