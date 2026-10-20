#!/usr/bin/env bash
# Render entrypoint: builds odoo.conf from environment variables, then
# starts Odoo bound to $PORT. Database = external PostgreSQL (Neon).
#
# Required env: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, ADMIN_PASSWD
# Optional env: DB_PORT (5432), DB_SSLMODE (require), AUTO_INIT (1),
#               UPDATE_MODULES (e.g. training_management -> runs -u on boot)
set -euo pipefail

: "${DB_HOST:?DB_HOST is required}"
: "${DB_USER:?DB_USER is required}"
: "${DB_PASSWORD:?DB_PASSWORD is required}"
: "${DB_NAME:?DB_NAME is required}"
: "${ADMIN_PASSWD:?ADMIN_PASSWD is required}"
DB_PORT="${DB_PORT:-5432}"
DB_SSLMODE="${DB_SSLMODE:-require}"
PORT="${PORT:-8069}"
AUTO_INIT="${AUTO_INIT:-1}"

CONF=/tmp/odoo.conf
cat > "$CONF" <<EOF
[options]
addons_path = /mnt/extra-addons
data_dir = /var/lib/odoo
db_host = ${DB_HOST}
db_port = ${DB_PORT}
db_user = ${DB_USER}
db_password = ${DB_PASSWORD}
db_name = ${DB_NAME}
db_sslmode = ${DB_SSLMODE}
dbfilter = ^${DB_NAME}\$
list_db = False
admin_passwd = ${ADMIN_PASSWD}
http_port = ${PORT}
proxy_mode = True
workers = 0
max_cron_threads = 1
db_maxconn = 8
without_demo = True
log_level = info
EOF

export PGHOST="$DB_HOST" PGPORT="$DB_PORT" PGUSER="$DB_USER" \
       PGPASSWORD="$DB_PASSWORD" PGDATABASE="$DB_NAME" PGSSLMODE="$DB_SSLMODE"

installed() {
    psql -tAc "SELECT state FROM ir_module_module WHERE name='training_management'" 2>/dev/null | grep -qx installed
}

EXTRA_ARGS=()
if ! installed; then
    if [ "$AUTO_INIT" != "1" ]; then
        echo "training_management is not installed and AUTO_INIT!=1 -- set AUTO_INIT=1 for the first deploy." >&2
        exit 1
    fi
    echo "==> First boot: database not initialised yet."
    # Render kills a web service that does not bind $PORT within ~5 min, and
    # installing base on the free CPU takes longer. Serve a tiny placeholder
    # on $PORT while the slow init steps run; it is stopped before Odoo starts.
    python3 - "$PORT" <<'PYEOF' &
import sys, http.server
class H(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        body = b"Odoo is initialising, please retry in a few minutes."
        self.send_response(200 if self.path.startswith("/web/health") else 503)
        self.send_header("Content-Type", "text/plain")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
    do_HEAD = do_GET
    def log_message(self, *a):
        pass
http.server.HTTPServer(("0.0.0.0", int(sys.argv[1])), H).serve_forever()
PYEOF
    PLACEHOLDER_PID=$!
    trap 'kill "$PLACEHOLDER_PID" 2>/dev/null || true' EXIT
    # A previous boot may have been killed half-way through installing base:
    # start again from an empty schema in that case.
    base_state=$(psql -tAc "SELECT state FROM ir_module_module WHERE name='base'" 2>/dev/null || true)
    if [ "$base_state" != "installed" ] && \
       [ "$(psql -tAc "SELECT count(*) FROM pg_tables WHERE schemaname='public'")" != "0" ]; then
        echo "==> Partial install detected (base state: '${base_state}'), resetting schema public."
        psql -v ON_ERROR_STOP=1 -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
    fi
    # 1) Install base only, so we can switch attachment storage to the DB
    #    (Render free has no persistent disk: the filestore would be lost
    #    on every restart).
    if [ "$(psql -tAc "SELECT state FROM ir_module_module WHERE name='base'" 2>/dev/null || true)" != "installed" ]; then
        odoo -c "$CONF" -d "$DB_NAME" -i base --stop-after-init
    fi
    psql -c "INSERT INTO ir_config_parameter (key, value, create_date, write_date)
             VALUES ('ir_attachment.location', 'db', now(), now())
             ON CONFLICT (key) DO UPDATE SET value = 'db';"
    # Move the few attachments base created on disk into the database.
    echo "env['ir.attachment'].force_storage(); env.cr.commit()" \
        | odoo shell -c "$CONF" -d "$DB_NAME" --no-http
    # 2) Install the addon while the HTTP server is already listening.
    EXTRA_ARGS+=(-i training_management)
fi

if [ -n "${UPDATE_MODULES:-}" ] && installed; then
    EXTRA_ARGS+=(-u "$UPDATE_MODULES")
fi

if [ -n "${PLACEHOLDER_PID:-}" ]; then
    kill "$PLACEHOLDER_PID" 2>/dev/null || true
    wait "$PLACEHOLDER_PID" 2>/dev/null || true
    trap - EXIT
fi

echo "==> Starting Odoo on port ${PORT}"
exec odoo -c "$CONF" -d "$DB_NAME" "${EXTRA_ARGS[@]}"
