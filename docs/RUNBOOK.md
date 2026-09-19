# Production Runbook

**Milestone:** M10 (Hardening, E2E, Performance and Deployment)
**Status:** Deployment *preparation* only. Nothing in this document has
been applied to a real production system by this milestone's work —
see `docs/adr/ADR-010-hardening-and-deployment-readiness.md` for what
was and was not verified, and the explicit distinction between
locally-verified and infrastructure-dependent items.

This runbook covers what DEVELOPMENT_PLAN's M10 "Deployment" section
asks for: production environment variables/configuration, TLS,
database backup schedule, restore test, monitoring/logging, scheduled
-action monitoring, and frontend/backend health checks.

---

## 1. Production Topology

```
Browser --HTTPS--> [reverse proxy / TLS terminator] --HTTP (internal)--> Next.js --HTTP (internal)--> Odoo (this addon) --> PostgreSQL 13+
```

- The browser only ever talks to one public origin (ADR-005/ADR-006's
  same-origin requirement — Odoo's session cookie has no
  `SameSite`/`Secure` attribute of its own and its CORS mechanism
  cannot set `Access-Control-Allow-Credentials`, so genuine
  cross-origin cookie auth is not viable).
- TLS is terminated in front of Next.js (reverse proxy / load
  balancer), not inside Next.js or Odoo themselves.
- Next.js reverse-proxies `/api/v1/*` to Odoo internally
  (`next.config.ts`); nothing else about Odoo is exposed publicly.
- PostgreSQL is reachable only from the Odoo process, never from the
  public network.

## 2. Production Environment Variables / Configuration

### Odoo (`env/odoo.conf`, copy from `env/odoo.conf.example`)

| Setting | Local dev value | Production requirement |
|---|---|---|
| `db_host`/`db_port` | local `.pgdata` socket dir, port 5433 | real PostgreSQL **13 or later** host (see section 7 — ADR-002 verified this project's dev cluster is PG12, below Odoo 19's own minimum) |
| `db_password` | `False` (trust auth) | a real, secret password; trust auth is dev-only |
| `list_db` | `True` | **must be `False`** — never expose the database-selector/manager screen publicly |
| `admin_passwd` | unset | a strong, secret master password (protects `/web/database/manager`, which should also not be publicly reachable at all — see section 4) |
| `proxy_mode` | unset | **`True`** — required so Odoo trusts `X-Forwarded-*` headers from the TLS-terminating reverse proxy instead of the raw internal socket |
| `workers` | unset (dev single-process) | > 0 (e.g. `4`) to enable Odoo's multi-worker HTTP/cron model; `0` (dev default) runs everything in one process and cron runs inline, both wrong for production load |
| `limit_time_cpu` / `limit_time_real` | unset | set explicit request/report-render time limits appropriate to the deployment's report generation load |

None of these are set by this milestone; they are documented here as
the checklist for whoever provisions the real environment.

### Next.js (`frontend/.env.local` / real deployment env, copy from `env/frontend.env.example`)

| Setting | Local dev value | Production requirement |
|---|---|---|
| `ODOO_INTERNAL_BASE_URL` | `http://localhost:8069` | the real internal Odoo URL, still server-only (no `NEXT_PUBLIC_` prefix — the browser must never see or need it) |
| `NEXT_PUBLIC_DEFAULT_LOCALE` | `ar` | unchanged unless the business decides otherwise |

No new secrets were introduced by M8/M9/M10 (report generation, SMS/WhatsApp test adapters, and notification settings are all configured from Odoo Back-office `res.config.settings`/`ir.config_parameter`, never as frontend environment variables).

## 3. TLS

Not provisioned by this milestone (no real domain/certificate exists
in this development environment, and doing so requires production
infrastructure this task explicitly does not authorize touching).
Recommended approach for the topology in section 1: terminate TLS at
an nginx (or equivalent) reverse proxy in front of Next.js, e.g.:

```nginx
server {
    listen 443 ssl http2;
    server_name training.example.com;

    ssl_certificate     /etc/letsencrypt/live/training.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/training.example.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name training.example.com;
    return 301 https://$host$request_uri;
}
```

`proxy_set_header X-Forwarded-Proto $scheme` matters specifically
because Odoo's `proxy_mode = True` (section 2) reads it to know the
original request was HTTPS even though the internal Next.js->Odoo hop
is plain HTTP.

## 4. Network Exposure Checklist

- Only the reverse proxy's 443 (and a redirecting 80) should be
  reachable from the public internet.
- Odoo's own port (8069 in dev) and PostgreSQL's port must **not** be
  publicly reachable — Next.js reaches Odoo, and Odoo reaches
  PostgreSQL, over an internal network only.
- `/web/database/manager` (Odoo's database creation/drop/backup/restore
  UI) should be disabled or network-restricted in production
  (`list_db = False` per section 2 hides the selector; the manager
  routes themselves should additionally be blocked at the reverse
  proxy if reachable at all) — this project's own backup/restore
  procedure (section 6) does not depend on this UI being exposed.

## 5. Monitoring / Logging

- **Application logs:** Odoo logs to stdout/its configured `logfile`;
  ship these to the deployment's log aggregation (e.g. journald ->
  centralized logging) rather than relying on local files surviving a
  container restart.
- **Request correlation:** every `/api/v1/*` response carries
  `meta.request_id` (ADR-005) and the same ID in the `X-Request-ID`
  response header; the one `_logger.exception(...)` call for unmapped
  (500) errors includes it — grepping logs by request ID is the
  intended way to correlate a user-reported error with server logs.
- **Health checks (new in M10):** `GET /api/v1/health` (public,
  unauthenticated, checks DB connectivity via a trivial query) and
  `GET /api/health` on the Next.js origin (confirms the frontend
  process itself is up, independent of Odoo) — point the deployment's
  load balancer / uptime monitor at both, separately, so "frontend
  down" and "frontend up but Odoo unreachable" are distinguishable.
  Verified locally: both return `200 {"status": "ok"}` against the
  running dev instances (see ADR-010).
- **Error tracking:** consider forwarding 500-level `/api/v1/*`
  responses (which always carry a clean, traceback-free message —
  ADR-005 — plus the request ID) to an error-tracking service; nothing
  further was implemented here since no such service is provisioned in
  this environment.

## 6. Database Backup Schedule and Restore

### Backup

`scripts/backup_db.sh <db_name> [output_dir]` — backs up both the
PostgreSQL database (`pg_dump`, custom/compressed format) and the
filestore (`ir.attachment` binaries on disk — approved report PDFs,
Excel exports — which `pg_dump` alone does **not** capture). Both are
required to fully restore a working instance.

Production schedule (not automated by this milestone — wire this into
the deployment's own cron/systemd-timer/orchestrator):

- Daily full backup, retained for at least the last 14 days.
- Optionally, more frequent (e.g. every 4-6 hours) incremental/WAL
  -based backups if the RPO (recovery point objective) requires
  finer granularity than 24 hours — PostgreSQL's continuous archiving
  (`archive_mode`/`archive_command` + a base backup) is the standard
  mechanism for this; not configured here since it depends on the
  actual production storage target (S3-compatible bucket, etc.), which
  is not provisioned in this environment.
- Backups must be stored off the database host itself.

### Restore

`scripts/restore_db.sh <db_dump_file> <new_db_name> [filestore_tar_gz]`
— always restores into a **new** database name (never overwrites an
existing one), so it is safe to run as a drill against a live system;
promote/rename explicitly only after verifying the restored data.

**Demonstrated in this milestone** (see ADR-010 for the full
transcript): a real database with test data was backed up via
`scripts/backup_db.sh`, the original database was dropped (simulating
a disaster), restored into a new database via `scripts/restore_db.sh`,
and the restored data was verified both via direct SQL and via a real
running Odoo instance reading it back through the ORM. This was run
against this project's local PostgreSQL **12** development cluster —
see section 7 for why this specific point (the backup/restore
*mechanism*) is expected to work identically on PostgreSQL 13+, and
why that hasn't been independently confirmed on 13+ itself.

## 7. PostgreSQL Version

ADR-002 (M1) already found, from Odoo 19 source
(`odoo/release.py: MIN_PG_VERSION = 13`), that this project's local
development cluster (PostgreSQL 12.22 — the only version installable
without root on the development machine) is **below Odoo 19's own
minimum supported version**. This was already a known, documented
constraint before M10; M10's job was to verify actual PostgreSQL 13+
compatibility where possible.

**What was attempted and found (see ADR-010 for the full account):** a
genuine PostgreSQL 13.23 server binary was obtained and made to run
(`postgres --version` succeeds) in this sandboxed, no-root environment
by extracting a Debian package's binaries and resolving their dynamic
library dependencies by hand — the same technique that successfully
produced a **real, working `wkhtmltopdf`** for this milestone's PDF
verification. Initializing an actual PostgreSQL 13 *cluster* was
ultimately blocked: the Debian-built `postgres`/`initdb` binaries have
their shared-data directory (`PGSHAREDIR`) compiled in as the fixed
path `/usr/share/postgresql/13`, which requires real root to create,
and the specific unprivileged-namespace tooling that could work around
this (`newuidmap`/`newgidmap`, standard on many rootless-container
setups) is not installed in this environment.

**Consequence:** the addon's own SQL usage was reviewed instead
(`_table_query`-based reporting views, ordinary ORM-generated SQL,
`models.Constraint`-based uniqueness constraints — ADR-002/ADR-004) and
found to use no PostgreSQL-12-specific behavior; nothing in this
codebase's own SQL or ORM usage is expected to behave differently on
13+. This is a **code-level review, not an executed test run**,
against the actual target version. **Before production go-live,
running this project's full test suite (`scripts/run_schema_smoke_test.sh`)
against a real PostgreSQL 13+ instance is a required, outstanding step**
— see "Remaining Blockers" in the M10 report.

## 8. Scheduled Action (`ir.cron`) Monitoring

This addon defines one `ir.cron` job:
`ir_cron_training_notification_reminders`
(`data/cron.xml`, hourly, runs `training.notification.log.cron_send_reminders()`
as `base.user_root` — ADR-009). Production monitoring should watch:

- **Odoo's own Scheduled Actions list** (Settings > Technical >
  Scheduled Actions, admin-only) for this job's `Last Execution
  Date`/failure state — a cron job that silently stops running (e.g.
  after an unhandled exception in a future code change) would
  otherwise fail invisibly.
- **`training.notification.log` itself** (Training Management >
  Notifications, admin-only) is the addon's own traceable-results
  record for every reminder attempt — a growing count of `status =
  'failed'` entries with `retry_count` at the configured maximum
  (`res.config.settings`) is the actionable signal that a channel
  (email/SMS/WhatsApp) is systematically failing, distinct from a
  one-off recipient data problem (missing email/phone).
- **`training.audit.log`** (Training Management > Audit, admin-only,
  new in M10) records every training-day reopen, report approval, and
  training-role permission change — reviewing this periodically is the
  operational side of "Security/privacy review is signed off" staying
  true on an ongoing basis, not just at initial launch.

## 9. Frontend/Backend Health Checks

See section 5. `GET /api/v1/health` and `GET /api/health` (new in
M10) — wire both into the deployment's load balancer/uptime monitor as
two independent checks.

## 10. Deployment Checklist Before Go-Live

- [ ] Real PostgreSQL 13+ instance provisioned; full test suite run
      against it (see section 7 — not yet done).
- [ ] `env/odoo.conf` production values set per section 2
      (`list_db=False`, `proxy_mode=True`, real `db_password`, strong
      `admin_passwd`, `workers > 0`).
- [ ] TLS terminated in front of Next.js per section 3; only 443/80
      reachable publicly per section 4.
- [ ] Backup schedule automated (section 6) and a **real** restore
      drill repeated against the production-equivalent environment
      (this milestone's drill used the local PG12 dev cluster only).
- [ ] Health checks (section 9) wired into monitoring.
- [ ] `ir.cron` monitoring (section 8) wired into monitoring/alerting.
- [ ] SMS/WhatsApp providers: still `test` mode by default
      (ADR-009) — a real provider must be explicitly configured (and
      approved) before any production reminder is expected to actually
      reach a recipient by SMS/WhatsApp; this was intentionally not
      done in M9 or M10 per the task's own instruction not to use real
      providers without approval.
- [ ] Outgoing mail server configured (`ir.mail_server`) — without one,
      the M9 email channel and the M10 password-reset email both queue
      /attempt but cannot actually deliver, exactly as in this
      development environment.
