#!/usr/bin/env bash
# Restore an Odoo database (and its filestore) from a backup created by
# scripts/backup_db.sh (M10 deployment requirement: "Restore test").
#
# Restores into a NEW database name by default -- it never overwrites
# an existing database -- so this is safe to run as a drill against a
# running system; point Odoo at the restored name to verify it, then
# rename/promote it explicitly if this really is a disaster-recovery
# restore, rather than this script silently clobbering anything.
#
# Usage:
#   ./scripts/restore_db.sh <db_dump_file> <new_db_name> [filestore_tar_gz]
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PG_BIN="/usr/lib/postgresql/12/bin"
DATA_DIR="$ROOT_DIR/.pgdata"
PG_PORT=5433

DUMP_FILE="${1:?Usage: restore_db.sh <db_dump_file> <new_db_name> [filestore_tar_gz]}"
NEW_DB_NAME="${2:?Usage: restore_db.sh <db_dump_file> <new_db_name> [filestore_tar_gz]}"
FILESTORE_TAR="${3:-}"

if "$PG_BIN/psql" -h "$DATA_DIR" -p "$PG_PORT" -U "$(whoami)" -lqt | cut -d '|' -f1 | grep -qw "$NEW_DB_NAME"; then
    echo "Database '$NEW_DB_NAME' already exists -- refusing to overwrite it. Choose a different name." >&2
    exit 1
fi

echo "Creating database '$NEW_DB_NAME'"
"$PG_BIN/createdb" -h "$DATA_DIR" -p "$PG_PORT" -U "$(whoami)" "$NEW_DB_NAME"

echo "Restoring '$DUMP_FILE' -> '$NEW_DB_NAME'"
"$PG_BIN/pg_restore" -h "$DATA_DIR" -p "$PG_PORT" -U "$(whoami)" \
    -d "$NEW_DB_NAME" --no-owner --no-privileges "$DUMP_FILE"

if [ -n "$FILESTORE_TAR" ]; then
    FILESTORE_DEST="$ROOT_DIR/.odoo-data/filestore/$NEW_DB_NAME"
    echo "Restoring filestore -> $FILESTORE_DEST"
    mkdir -p "$(dirname "$FILESTORE_DEST")"
    tar -xzf "$FILESTORE_TAR" -C "$(dirname "$FILESTORE_DEST")"
    # The archive's top-level directory is named after the ORIGINAL
    # db_name (see backup_db.sh); rename it to match $NEW_DB_NAME only
    # if they differ.
    # tar's full output is captured first, then processed as a plain
    # string -- piping it directly into `head -1` would let `head` exit
    # (and close the pipe) before tar finishes writing, which under
    # `set -o pipefail` kills the script on tar's resulting SIGPIPE.
    FILESTORE_TAR_LISTING="$(tar -tzf "$FILESTORE_TAR")"
    EXTRACTED_NAME="$(echo "$FILESTORE_TAR_LISTING" | head -1 | cut -d/ -f1)"
    if [ "$EXTRACTED_NAME" != "$NEW_DB_NAME" ]; then
        mv "$(dirname "$FILESTORE_DEST")/$EXTRACTED_NAME" "$FILESTORE_DEST"
    fi
fi

echo "Restore complete. Verify with:"
echo "  ./scripts/run_odoo.sh -d $NEW_DB_NAME"
echo "then confirm the expected data is present before treating this as production."
