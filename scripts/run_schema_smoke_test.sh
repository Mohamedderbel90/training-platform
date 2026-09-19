#!/usr/bin/env bash
# Milestone M0 deliverable: run the standard-schema smoke test
# (custom_addons/training_management/tests/test_schema_smoke.py)
# against a real Odoo 19 runtime and a throwaway database.
#
# This installs training_management (currently a near-empty skeleton
# depending on base/mail/survey) into a fresh database and runs only
# the smoke test tag, then drops the database.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONF="$ROOT_DIR/env/odoo.conf"
DB_NAME="training_management_smoke_$$"
PG_BIN="/usr/lib/postgresql/12/bin"
DATA_DIR="$ROOT_DIR/.pgdata"

if [ ! -f "$CONF" ]; then
    echo "Missing $CONF. Copy env/odoo.conf.example to env/odoo.conf first."
    exit 1
fi

source "$ROOT_DIR/.venv/bin/activate"
cd "$ROOT_DIR"

cleanup() {
    "$PG_BIN/dropdb" -h "$DATA_DIR" -p 5433 -U "$(whoami)" "$DB_NAME" 2>/dev/null || true
}
trap cleanup EXIT

"$PG_BIN/createdb" -h "$DATA_DIR" -p 5433 -U "$(whoami)" "$DB_NAME"

python "$ROOT_DIR/.odoo-core/odoo-bin" -c "$CONF" \
    -d "$DB_NAME" \
    -i training_management \
    --test-enable \
    --test-tags /training_management \
    --stop-after-init \
    --without-demo=all \
    --log-level=test
