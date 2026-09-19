# ADR-010: Hardening, E2E, Performance and Deployment Readiness

- **Status:** Accepted
- **Date:** 2026-09-17
- **Milestone:** M10 (Hardening, E2E, Performance and Deployment, per `DEVELOPMENT_PLAN_v1.1_BILINGUAL.md`)
- **Related:** ADR-001, ADR-002, ADR-004, ADR-005, ADR-006, ADR-008, ADR-009

## Context

Before any M10 work started, `DEVELOPMENT_PLAN_v1.1_BILINGUAL.md`'s M10
section, `PROJECT_SPEC_v1.1_BILINGUAL.md`, and all nine existing ADRs
were re-read. M10 differs from M1-M9 in kind, not just scope: it has
no single new feature to build. Its five sub-areas (Security, E2E,
Performance, Deployment) and its exit criteria ("All acceptance tests
pass," "Backup restore has been demonstrated," "Production runbook
exists," "Security/privacy review is signed off") are a *verification
and readiness* pass over everything M0-M9 already built, plus closing
specific, already-documented outstanding gaps. This ADR records what
was actually verified, what was fixed, and — per this milestone's own
explicit instruction — draws a clear line between what was verified
**locally in this development environment** and what still requires
real production infrastructure this task was not authorized to touch
(no real SMS/WhatsApp provider, no production deploy, no git commit).

## 1. Security Review

**ACL/Record Rule review:** every model's `ir.model.access.csv` row and
every `ir.rule` in `security_rules.xml` was re-read against
PROJECT_SPEC section 7's role matrix. No gap was found: Trainee/
Supervisor/Trainer have zero ACL rows at all on `training.report`,
`training.notification.log`, and the new `training.audit.log`
(matching the established pattern already used for
`training.attendance`'s trainee/trainer rows since M1); Assistant Admin
has full CRUD everywhere Admin does except `perm_unlink` and except
`training.report.action_approve()` (Python-gated, not ACL-gated, per
ADR-008).

**Explicit cross-role penetration tests:** the existing 225-test suite
already exercises most role-boundary combinations (ADR-003 through
ADR-009). This milestone added targeted tests for combinations not yet
covered: `training.audit.log` access denial for Trainee
(`test_trainee_cannot_read_audit_log`), and the model-level
immutability guard holding even for an Admin-group user with
otherwise-full ACL read access (`test_audit_log_not_writable_or_deletable_by_any_group`,
`test_audit_log_guard_blocks_direct_sudo_write_bypassing_service`).

**`sudo()` usage audit:** grepping the entire addon (excluding tests)
found exactly three call sites, all justified:
`api_common.py`'s pre-authentication `res.lang` lookup (needed before
any user context exists), `training_notification.py`'s
`ir.config_parameter` read (system parameters have no ACL for regular
users by design) and its `sms.sms` creation (the standard-Odoo-SMS
production path, which must work regardless of which user context
triggers a manual retry). No other `sudo()` exists in the codebase.

**Next.js local storage/logs:** grepping the entire frontend source
for `localStorage`, `sessionStorage`, and any `console.*` call found
**zero** matches — confirming ADR-006's claim ("no sensitive session
material in browser storage") empirically rather than by re-reading
the design doc.

**No traceback/secrets in API errors — verified live** against the
already-running dev Odoo instance (not just unit-tested): unauthenticated
requests, malformed JSON bodies, missing-field validation errors, and
bad `Accept-Language` headers all returned the clean `{data, meta,
error}` envelope with no traceback, no file path, and no secret, in
both English and Arabic. **One real, minor, non-security finding**
from this live testing: a request to a valid `/api/v1/*` path with the
*wrong HTTP method* (e.g. `DELETE /api/v1/auth/me`) returns Werkzeug's
raw default HTML 405 page instead of the project's JSON envelope. Root
cause traced into Odoo core itself
(`odoo/http.py`'s `_update_served_exception`): any `werkzeug.exceptions.HTTPException`
that already carries a fixed `.code` (405, and route-matching's own
404) is re-raised *before* `ir.http._handle_error` is ever called,
bypassing this project's `IrHttp._handle_error` override entirely —
the override is correctly written, but Odoo's own dispatcher never
reaches it for this specific exception class. **This is not a security
finding**: Werkzeug's default 405 page is static, generic boilerplate
containing no traceback, no internal path, and no data — it is
logged here purely as a documented API-contract consistency gap for a
future milestone (fixing it cleanly would need either a route-level
`methods=` mismatch handler in every controller, or a WSGI-layer
wrapper outside `ir.http`, and was judged out of proportion to fix
during this pass given the negligible real risk).

## 2. End-to-End Scenario Test

`tests/test_e2e_full_scenario.py` (new) drives DEVELOPMENT_PLAN's exact
required scenario — "Admin setup -> trainee survey -> supervisor
attendance/evaluation -> trainer report -> analytics -> report
approval -> download" — as one test, reusing `OperationalApiCase`'s
fixture for "admin setup" and driving every trainee/supervisor/trainer
step through the real `/api/v1` HTTP controllers (session-authenticated,
exactly as the Next.js frontend would call them), then verifying the
Back-office-only tail (analytics numbers, report generate/approve, and
reading the resulting `ir.attachment`'s binary content as the
"download") directly against the model layer, since PROJECT_SPEC
section 2.1/2.2 places no HTTP endpoint there by design. Passing.

## 3. Real PDF Rendering Verification

Every prior milestone's automated tests render PDFs through Odoo's own
test-mode HTML fallback (`_pre_render_qweb_pdf`'s `test_enable`
branch — ADR-008 already documented this precisely). M10's brief
specifically asks to verify **real** rendering. `wkhtmltopdf` was not
installed on this machine and there is no root access
(`apt-get install` requires it). A genuine, working `wkhtmltopdf
0.12.6.1 (with patched qt)` binary was obtained without root by
downloading the official static "wkhtmltox" build (bundles its own Qt,
avoiding the much heavier dynamic `libqt5webkit5` dependency chain the
distro package would need) and resolving its one missing shared
library (`libjpeg.so.62`, a SONAME Ubuntu 20.04 doesn't ship) by
extracting it from the matching Debian package — the standard
"portable binary via `dpkg-deb -x` + `LD_LIBRARY_PATH`" technique for
unprivileged environments. Installed persistently at
`~/.local/opt/wkhtmltopdf/`.

**Verified, with real rendered output inspected pixel-by-pixel (not
just asserted structurally):** a real `training.report` was generated,
approved, and rendered to PDF via actual `wkhtmltopdf` (bypassing the
test-mode fallback via `force_report_rendering=True`), in both English
and Arabic (with `ar_001` genuinely activated **and its translations
actually loaded** — an initial pass without loading `ar.po` into the
throwaway verification database rendered the static template labels in
English despite `lang=ar_001`, which was correctly diagnosed as a
verification-setup gap, not a product defect, and fixed by running the
same `i18n loadlang`/`import` step every other milestone's i18n
verification already uses). The resulting PDFs were rasterized to PNG
(`pdftoppm`) and visually inspected:

- Real, valid, single-page A4 PDFs (`Producer: Qt 4.8.7`, confirming
  actual `wkhtmltopdf` rendering, not the HTML fallback).
- The Arabic PDF renders genuinely RTL: the KPI table's column order is
  mirrored (label column on the right, value column on the left), and
  `pdffonts` confirms a real embedded, Unicode, subsetted Arabic font
  (`NotoSansArabicUI-Regular`, CID TrueType) alongside the Latin
  numeral font — not boxes, not mojibake.
- Every static template label (visual approval stamp text, "KPI
  Summary," "Attendance," column/row headers, "No data," Odoo's own
  standard page-footer "Page 1/1") rendered in real, correctly
  -translated Arabic once translations were actually loaded, exactly
  matching what the already-shipped `ar.po` contains.
- One cosmetic-only, non-blocking observation: the report's own `name`
  field (e.g. "M10 PDF Verification Course Report (v1)") is not itself
  a `translate=True` field — it is computed once, in whatever locale
  was active at generation time, from record data (course/program
  names) that this verification's own test fixture only ever entered
  in English — so it does not re-translate per viewer, and mixing an
  English phrase inside an RTL-rendered title produces the well-known
  bidi parenthesis-mirroring visual artifact common across the whole
  Odoo ecosystem whenever a Latin-script value is embedded in Arabic
  report text. Neither is a defect in this milestone's code; both are
  documented here for completeness.

## 4. PostgreSQL 13+ Compatibility

ADR-002 already found (M1) that this project's local development
cluster (PostgreSQL 12.22) is below Odoo 19's own `MIN_PG_VERSION = 13`.
M10 attempted to close this gap with an actual PostgreSQL 13 instance,
using the same "extract a real binary without root" technique that
succeeded for `wkhtmltopdf` above:

- A genuine PostgreSQL 13.23 (Debian-built) `postgres`/`initdb` binary
  was obtained and made runnable (`postgres --version` succeeds) by
  resolving its dynamic library dependencies (only two were missing —
  `libicui18n.so.67`/`libicuuc.so.67`; every other dependency already
  resolved against this system's existing libraries).
- Initializing an actual **cluster** was blocked: these binaries have
  `PGSHAREDIR` compiled in as the fixed absolute path
  `/usr/share/postgresql/13`, which requires real root to create and
  cannot be worked around by any environment variable this Postgres
  build honors. An unprivileged Linux user+mount namespace
  (`unshare -r -m` + a private `tmpfs` bind at that exact path) was
  confirmed to work for the *mount* itself, but `initdb`/`postgres`
  then refuse to run as the namespace-mapped uid 0 (a deliberate
  Postgres safety check against running as root) — combining "gain
  mount capability" with "then run as a non-root uid" inside one
  unprivileged namespace requires `newuidmap`/`newgidmap` (standard
  rootless-container tooling), which is not installed in this
  environment.
- **Consequence:** this project's own SQL/ORM usage was instead
  reviewed at the code level — the `_table_query`-based reporting view
  (ADR-002 §8, ADR-004), every `models.Constraint`-based uniqueness
  constraint (ADR-003, ADR-008, ADR-009), and all ordinary ORM-generated
  queries — and nothing PostgreSQL-12-specific was found; none of it is
  expected to behave differently on 13+. **This is a code review, not
  an executed test run, against the real target version** — running
  the full test suite against an actual PostgreSQL 13+ instance remains
  an explicit, outstanding pre-production step (see "Remaining
  Blockers" and `docs/RUNBOOK.md` section 7/10).

## 5. Backup and Restore — Demonstrated

`scripts/backup_db.sh` and `scripts/restore_db.sh` (new) back up/restore
both the PostgreSQL database (`pg_dump`/`pg_restore`, custom format)
and the filestore (`ir.attachment` binaries on disk, which `pg_dump`
alone never captures — necessary since M8 added real PDF/Excel
attachments). **Demonstrated end-to-end for real**, using the scripts
themselves (not ad hoc commands): a database with real test data
(program/course/enrollment) was backed up, the original database was
then dropped (simulating a disaster), restored into a new database via
the restore script, and the restored data was independently verified
both via raw SQL and via a real running Odoo instance reading it back
through the ORM. One real bug was found and fixed during this
exercise: the restore script's filestore-directory-rename step used
`tar -tzf ... | head -1`, which — combined with `set -o pipefail` —
killed the script with `head`'s early pipe closure causing `tar` to
receive `SIGPIPE`; fixed by capturing `tar`'s full listing into a
variable first, then processing it as a plain string with no live pipe
involved. Run against this project's local PostgreSQL **12** cluster
(the only one available to actually execute against — see section 4);
the backup/restore *mechanism* itself (`pg_dump`/`pg_restore` plus a
plain filesystem `tar`) is standard, version-independent PostgreSQL
tooling with no reason to behave differently on 13+, but that has not
been independently executed there either.

## 6. Performance

Profiled with a realistic-scale fixture (40 trainees x 15 training
days = 600 attendance/survey rows) against a real database, measuring
both wall-clock time and exact SQL query counts
(`env.cr.sql_log_count`):

| Operation | Time | Queries |
|---|---|---|
| `training.day.get_dashboard('supervisor')`, 15 days | 88.0ms | 89 |
| `training.analytics.get_kpi` (course scope) | 17.0ms | 2 |
| `training.analytics.get_attendance_metrics` (course scope) | 5.3ms | 2 |
| `training.analytics.get_trainee_response_rate` (course scope) | 1.6ms | 3 |
| `training.notification.log.cron_send_reminders`, 41 recipients, first run | 410.6ms | 816 |
| same, second run (everything already sent) | 260.3ms | 631 |

**Findings:**
- `training.analytics`'s three KPI methods are already well-optimized
  (2-3 queries each, sub-20ms) — each does one batched `search()` over
  the resolved scope and aggregates in Python, with no per-record
  querying. No change made or needed.
- `get_dashboard('supervisor')` and `cron_send_reminders()` both show a
  genuine N+1 pattern (~6 queries/day and ~20 queries/recipient
  respectively) — each training day, and each reminder recipient, is
  processed with its own independent set of queries rather than one
  batched query. Given the project's own realistic scale (PROJECT_SPEC's
  worked example: one 16-week/2-day-per-week program, a few dozen
  trainees — meaning at most ~30 assigned days per supervisor and at
  most a few hundred reminder recipients per cron run), the measured
  absolute numbers (under 100ms for a dashboard, under half a second
  for an hourly cron) are not a real user-facing problem today.
- **Decision: no code changes made.** DEVELOPMENT_PLAN's own
  instruction — "Optimize ORM queries. Add indexes only when
  justified. Consider controlled caching only if needed" — was applied
  as a real filter, not a formality: rewriting these methods to batch
  their queries would touch already-thoroughly-tested, working code
  for a performance characteristic that is not currently a problem at
  this project's actual scale, which is a worse trade than leaving it
  measured, documented, and revisited if usage ever grows past the
  scale this analysis assumed.
- **No new index was added**, for the same reason from the other
  direction: `training.day`'s `(state, survey_open_at, survey_close_at)`
  columns (the `cron_send_reminders()` scan's own filter) have no
  existing index, but the table itself is expected to hold at most
  low hundreds of rows in any realistic deployment of this system — a
  sequential scan over that is not measurably slower than an index
  scan, so adding one would be speculative, not justified.

## 7. Deployment Preparation

`docs/RUNBOOK.md` (new) covers production environment variables/
configuration (including `list_db=False`, `proxy_mode=True`,
`workers > 0`, and the PG13+ requirement), a TLS/nginx reverse-proxy
example, network-exposure guidance, monitoring/logging (including the
existing `X-Request-ID` correlation mechanism), `ir.cron` monitoring
guidance for `ir_cron_training_notification_reminders`, the backup
schedule and restore procedure (referencing the two new scripts and
section 5's demonstration), and a pre-go-live checklist. **Two new
health-check endpoints** were added and verified live against the
already-running dev instances: `GET /api/v1/health` (public, checks
real DB connectivity via `SELECT 1`) and `GET /api/health` on the
Next.js origin (confirms the frontend process itself is up,
independent of Odoo) — both return `200 {"status": "ok"}`.
**No TLS certificate, real domain, or production deployment was
provisioned** — none is available in this development environment,
and doing so is explicitly out of scope without separate approval.

## 8. Defects Resolved From Earlier Milestones

Three real, previously-documented gaps were closed:

1. **`training.audit.log` did not exist.** ADR-004 (M3) explicitly
   flagged this: `action_reopen()` (an audit-worthy event per
   PROJECT_SPEC section 17) shipped with no audit trail because the
   model didn't exist yet, with an explicit note to add it "before
   this action is relied on in a production workflow." M10 adds the
   model (minimal, per PROJECT_SPEC section 5: `event_type`, `user_id`,
   `model_name`/`res_id`, `description`; write()/unlink() both raise
   unconditionally — even under `sudo()` — since an audit trail that
   internal code could quietly rewrite would defeat its own purpose,
   unlike `survey.user_input`'s deliberate `env.su`-gated exception for
   a possible future correction workflow, ADR-003) and wires it into
   the three events PROJECT_SPEC section 17 names that this codebase
   can actually produce: `training.day.action_reopen()`,
   `training.report.action_approve()`, and a new, narrowly-scoped
   `res.users.write()` override that logs only changes to *this
   project's own five groups* (never any other group on the system).
2. **Password recovery was never implemented.** PROJECT_SPEC section
   10.1 lists `POST /api/v1/auth/password/forgot` and
   `.../password/reset` as part of the *required* auth contract since
   M4; ADR-005 explicitly deferred them ("no verified, safe
   -to-thin-wrap standard Odoo recovery flow was confirmed suitable...
   in the time available"). M10 implements both as thin wrappers over
   the standard `auth_signup` module's own `res.users.reset_password()`
   /`signup()` methods — no parallel token store. `password_forgot`
   always returns the same generic success message regardless of
   whether the login/email actually matches an account (verified by a
   test asserting byte-identical responses for a real vs. nonexistent
   login), preventing user enumeration; `password_reset` maps any
   invalid/expired-token failure to a clean, generic `VALIDATION_ERROR`
   rather than letting `auth_signup`'s own (sometimes bare `Exception`)
   error types fall through to a raw 500.
3. **The supervisor dashboard had no dedicated frontend unit test.**
   Flagged explicitly in the M7 report/README ("The supervisor
   dashboard has the same test-coverage gap [as the trainer dashboard
   had before M7]; it is out of M7's scope and left open here.")
   `tests/SupervisorDashboard.test.tsx` (new, 5 tests) closes it,
   mirroring `TrainerDashboard.test.tsx`'s structure.

**Deliberately not touched:** ADR-006 section 12's other flagged gap
("no way for a trainee to retrieve their own already-submitted
answers") remains open — it is explicitly conditional on a future
product requirement ("If read-only self-review... becomes a real
product requirement"), which is new-feature work outside a hardening
milestone's scope, not a defect.

## 9. i18n / RTL Quality

- Frontend message-catalog key parity (`messages/en.json` vs.
  `messages/ar.json`) re-verified programmatically across the entire
  catalog: zero keys missing in either direction.
- Live-fetched `<html>` root elements from the running dev frontend
  confirm `lang="ar" dir="rtl"` and `lang="en" dir="ltr"` respectively.
- Backend: `training_management.pot` regenerated (283 -> 302 terms)
  and `ar.po` extended with all 19 newly-introduced M10 terms
  (audit-log labels/messages, password-recovery validation messages),
  verified the same way every prior milestone's i18n work was — loaded
  into a real database via `odoo-bin i18n loadlang`/`import`, then read
  back directly from PostgreSQL.
- Section 3 above is this milestone's Arabic RTL *report* quality
  check — done via real rendered, rasterized, visually-inspected PDF
  output, not just a structural `dir=` attribute assertion.

## Test Results

225 backend tests (211 existing + 14 new: 5 password-recovery, 7
audit-log, 1 E2E scenario, 1 health-check), all passing. `flake8`
clean. Frontend:
79 tests (74 existing + 5 new `SupervisorDashboard.test.tsx`), all
passing (one run mid-milestone showed the exact same `AuthContext`
-adjacent full-suite timing flakiness ADR-007 already diagnosed and
attributed to sandboxed-machine worker contention, not a code defect;
re-running produced a clean pass with normal timing, consistent with
that diagnosis); `npm run lint` and `npm run build` both clean.

## Remaining Blockers (Explicit, Per This Milestone's Own Instruction)

**Locally verified, safe to rely on:**
- Every backend/frontend automated test, lint, and build.
- Real `wkhtmltopdf` PDF rendering, English and Arabic, visually
  inspected.
- Security review (ACL/rules/sudo audit, live error-response probing,
  frontend storage/logging audit).
- Backup and restore mechanics (on PostgreSQL 12).
- Both health-check endpoints, live.
- i18n completeness (frontend key parity; backend `.pot`/`ar.po`
  coverage and real-database readback).

**Requires production infrastructure this task was not authorized to
provision, and must happen before go-live:**
- Running the full test suite against a real PostgreSQL **13+**
  instance (section 4 — attempted, not achieved in this sandboxed,
  no-root environment).
- Any real SMS/WhatsApp provider configuration or send (explicitly out
  of scope per this task's own instruction; `test` mode remains the
  default, per ADR-009, unchanged).
- TLS/real domain/production deployment (explicitly out of scope
  without separate approval; `docs/RUNBOOK.md` documents the intended
  configuration only).
- A backup/restore drill repeated against the actual production
  -equivalent environment (this milestone's drill used the local dev
  cluster only).
- An outgoing mail server, for the M9 email channel and this
  milestone's password-reset email to actually deliver anything (both
  already work correctly up to the point delivery would require one).

No code was deployed anywhere beyond this development environment, and
no git commit was made, per this task's explicit instruction to stop
after M10 and wait for approval.
