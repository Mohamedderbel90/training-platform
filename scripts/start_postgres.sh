#!/usr/bin/env bash
# Start the project-local, user-space PostgreSQL cluster used for
# development. This is NOT the system PostgreSQL service (port 5432);
# it is a separate cluster owned by the current OS user, listening on
# port 5433, so local development never touches system-wide state.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="$ROOT_DIR/.pgdata"
PG_BIN="/usr/lib/postgresql/12/bin"

if [ ! -d "$DATA_DIR" ]; then
    echo "No data directory at $DATA_DIR. Run:"
    echo "  $PG_BIN/initdb -D $DATA_DIR -U \$(whoami) --auth=trust --encoding=UTF8"
    exit 1
fi

"$PG_BIN/pg_ctl" -D "$DATA_DIR" -o "-p 5433 -k $DATA_DIR" -l "$DATA_DIR/server.log" start
"$PG_BIN/pg_ctl" -D "$DATA_DIR" status
