#!/usr/bin/env bash
# Load development-only demo data (dev_data.py) for manually exercising
# the M5 Next.js Operational UI against a real Odoo instance.
#
# NOT for production: this creates/updates a handful of clearly-named
# demo users, a demo program/course/training day, and three demo
# surveys, keyed by fixed logins/names so re-running it is safe
# (updates in place rather than duplicating). It is never loaded by
# module installation -- see scripts/dev_data.py's own docstring.
#
# Usage:
#   ./scripts/load_dev_data.sh [db_name]
# Defaults to training_management_dev if no db name is given. The
# database must already have training_management installed (see
# scripts/run_odoo.sh).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONF="$ROOT_DIR/env/odoo.conf"
DB_NAME="${1:-training_management_dev}"

if [ ! -f "$CONF" ]; then
    echo "Missing $CONF. Copy env/odoo.conf.example to env/odoo.conf first."
    exit 1
fi

source "$ROOT_DIR/.venv/bin/activate"
cd "$ROOT_DIR"

python "$ROOT_DIR/.odoo-core/odoo-bin" shell -c "$CONF" -d "$DB_NAME" --no-http \
    < "$ROOT_DIR/scripts/dev_data.py"
