#!/usr/bin/env bash
# Stop the project-local PostgreSQL cluster started by start_postgres.sh.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="$ROOT_DIR/.pgdata"
PG_BIN="/usr/lib/postgresql/12/bin"

"$PG_BIN/pg_ctl" -D "$DATA_DIR" stop
