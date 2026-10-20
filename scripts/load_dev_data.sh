#!/usr/bin/env bash
# Load the unified development dataset into a LOCAL development database.
#
#   ./scripts/load_dev_data.sh [db_name] [--reset-passwords]
#
# Defaults to training_management_dev. The database must already exist with
# training_management installed (see scripts/run_odoo.sh); this script never
# creates, drops or recreates a database. Two steps, both idempotent:
#   1. scripts/seed_surveys.py  the approved survey questions (single source,
#                               docs/SURVEY_QUESTIONS.md)
#   2. scripts/dev_data.py      users of every role, program, courses, training
#                               days, enrollments and a realistic history
# Re-running adds only what is missing and never overwrites existing records,
# responses, passwords or UAT progress. New accounts (and the built-in admin on
# the first load) get the dev password Dev12345!; --reset-passwords explicitly
# sets it again on every account of the dataset and on the built-in admin. Not for production: only databases named
# training_management_dev* / training_management_demo* are accepted (checked
# here and again inside dev_data.py, which also rejects production-like
# Odoo configuration).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONF="$ROOT_DIR/env/odoo.conf"
DB_NAME="training_management_dev"
RESET_PASSWORDS=0
for arg in "$@"; do
    case "$arg" in
        --reset-passwords) RESET_PASSWORDS=1 ;;
        -*) echo "Unknown option: $arg" >&2; exit 1 ;;
        *) DB_NAME="$arg" ;;
    esac
done
export DEV_DATA_RESET_PASSWORDS="$RESET_PASSWORDS"

if [[ ! "$DB_NAME" =~ ^training_management_(dev|demo)(_[a-z0-9]+)*$ ]]; then
    echo "Refusing: '$DB_NAME' is not a development/demo database" \
         "(name must match training_management_dev* or training_management_demo*)." >&2
    exit 1
fi
if [ ! -f "$CONF" ]; then
    echo "Missing $CONF. Copy env/odoo.conf.example to env/odoo.conf first." >&2
    exit 1
fi

source "$ROOT_DIR/.venv/bin/activate"
cd "$ROOT_DIR"
# Report PDFs need wkhtmltopdf (ADR-010), same as scripts/run_odoo.sh.
if [ -x "$HOME/.local/opt/wkhtmltopdf/bin/wkhtmltopdf" ]; then
    export PATH="$HOME/.local/opt/wkhtmltopdf/bin:$PATH"
    export LD_LIBRARY_PATH="$HOME/.local/opt/wkhtmltopdf/lib:${LD_LIBRARY_PATH:-}"
fi

# --no-http: no port is needed, so this can run next to a running dev server.
# Each step stops the loader on failure (set -e). The preflight runs every
# dev_data.py guard (database name, production-like configuration, module
# installed, legacy demo data) before the first write of seed_surveys.py.
ODOO_SHELL=(python "$ROOT_DIR/.odoo-core/odoo-bin" shell -c "$CONF" -d "$DB_NAME" --no-http --log-level=warn)
DEV_DATA_PREFLIGHT=1 "${ODOO_SHELL[@]}" < "$ROOT_DIR/scripts/dev_data.py"
"${ODOO_SHELL[@]}" < "$ROOT_DIR/scripts/seed_surveys.py"
"${ODOO_SHELL[@]}" < "$ROOT_DIR/scripts/dev_data.py"
