#!/usr/bin/env bash
# Start the Odoo 19 backend against the project-local PostgreSQL
# cluster, with the training_management addon on the addons path.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONF="$ROOT_DIR/env/odoo.conf"

if [ ! -f "$CONF" ]; then
    echo "Missing $CONF. Copy env/odoo.conf.example to env/odoo.conf first."
    exit 1
fi

source "$ROOT_DIR/.venv/bin/activate"
cd "$ROOT_DIR"
python "$ROOT_DIR/.odoo-core/odoo-bin" -c "$CONF" "$@"
