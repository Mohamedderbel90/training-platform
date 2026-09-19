#!/usr/bin/env bash
# Back up an Odoo database for this project (M10 deployment
# requirement: "Database backup schedule").
#
# Backs up two things, matching what Odoo's own Database Manager
# "Backup" action bundles together -- both are required to fully
# restore a working instance, not just the database:
#   1. The PostgreSQL database itself (pg_dump, custom/compressed format).
#   2. The filestore (env/odoo.conf's data_dir/filestore/<db_name>),
#      which holds ir.attachment binaries (approved report PDFs, Excel
#      exports, etc.) stored on disk, not in PostgreSQL.
#
# Usage:
#   ./scripts/backup_db.sh <db_name> [output_dir]
#
# See scripts/restore_db.sh for the matching restore procedure, and
# docs/RUNBOOK.md for the full backup/restore/monitoring runbook this
# script is one part of.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PG_BIN="/usr/lib/postgresql/12/bin"
DATA_DIR="$ROOT_DIR/.pgdata"
PG_PORT=5433

DB_NAME="${1:?Usage: backup_db.sh <db_name> [output_dir]}"
OUT_DIR="${2:-$ROOT_DIR/backups}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DB_DUMP="$OUT_DIR/${DB_NAME}_${TIMESTAMP}.dump"
FILESTORE_SRC="$ROOT_DIR/.odoo-data/filestore/$DB_NAME"
FILESTORE_DEST="$OUT_DIR/${DB_NAME}_${TIMESTAMP}_filestore.tar.gz"

mkdir -p "$OUT_DIR"

echo "Backing up database '$DB_NAME' -> $DB_DUMP"
"$PG_BIN/pg_dump" -h "$DATA_DIR" -p "$PG_PORT" -U "$(whoami)" -Fc -f "$DB_DUMP" "$DB_NAME"

if [ -d "$FILESTORE_SRC" ]; then
    echo "Backing up filestore '$FILESTORE_SRC' -> $FILESTORE_DEST"
    tar -czf "$FILESTORE_DEST" -C "$(dirname "$FILESTORE_SRC")" "$(basename "$FILESTORE_SRC")"
else
    echo "No filestore directory at $FILESTORE_SRC (nothing to back up -- fine for a database with no attachments yet)."
fi

echo "Backup complete:"
ls -la "$DB_DUMP" "$FILESTORE_DEST" 2>/dev/null || ls -la "$DB_DUMP"
