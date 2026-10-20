# Training Program Management & Evaluation System

Source of truth for implementation: `PROJECT_SPEC_v1.1_BILINGUAL.md`.
Documentation index: `docs/README.md` (the only index; start there).

Status: milestones M0-M10 are delivered (see `DEVELOPMENT_PLAN_v1.1_BILINGUAL.md`);
no milestone beyond M10 is planned in the documents. No admin CRUD or
survey-builder UI/endpoint exists in Next.js; those remain Odoo Back-office
only. The per-milestone delivery narrative is archived in
`docs/archive/MILESTONE_LOG.md`; the technical reasoning lives in
`docs/adr/`.

## Documentation

Start at `docs/README.md`, the single documentation index (business decisions, requirement chain, document authority, ADRs, runbook).

Approved survey questions are loaded with `scripts/seed_surveys.py` (see `docs/SURVEY_QUESTIONS.md`).

## Repository layout

```
custom_addons/training_management/   Odoo 19 custom addon (M0-M10: models, security, survey integration, analytics, workflow, Operational API, reports/approval/export, notifications/reminders, audit log, health checks)
docs/                                Documentation map, decisions, traceability, ADRs, runbook
design/                              Approved visual design reference (prototype export + UI/UX spec)
noor-login/                          Approved login visual assets
frontend/                            Next.js operational frontend (M5: real trainee/supervisor/trainer UI, same-origin API proxy)
env/                                 Environment config templates (no secrets)
scripts/                             Local dev helper scripts
.odoo-core/                          Odoo 19.0 core source (gitignored, cloned separately, not project code)
.venv/                               Python 3.10 virtualenv for Odoo (gitignored)
.pgdata/                             Local, user-space PostgreSQL 12 data directory (gitignored)
```

## Environment reality check (read before assuming anything below "just works" elsewhere)

This workspace was bootstrapped on a machine where:

- System Python is 3.8 (Odoo 19 needs 3.10+). Python **3.10.16 was
  already installed** and is used for the addon venv.
- System Node.js is v10 (far too old for Next.js). A **Node 20.18.1**
  binary was downloaded to `~/.local/opt/node-current` and is used
  explicitly by `scripts/start_frontend.sh`. The system Node
  install was not touched.
- System PostgreSQL is 12.22, running as a system service on port
  5432. Rather than touch that shared instance, this project
  initializes its **own PostgreSQL 12 cluster** in `.pgdata/`,
  listening on **port 5433**, owned by the current OS user, with no
  password (`trust` auth, local dev only — never do this in
  production). It does not affect or depend on the system service.
- No `sudo`/root access was available or used anywhere in this setup.
  Everything above is user-space.

If you set this up on a clean machine with modern Python/Node/Postgres
already on PATH, you can likely skip the workarounds and just use your
system tools directly — adjust `scripts/*.sh` and `env/odoo.conf`
accordingly.

## Prerequisites already vendored/prepared by M0

- Odoo 19.0 core source shallow-cloned into `.odoo-core/` (Community
  edition, from `https://github.com/odoo/odoo.git`, branch `19.0`).
  **`sign` and `whatsapp` modules are not present** — those are
  Odoo Enterprise-only and live in a separate, private repository this
  environment has no access to. Confirm licensing/availability before
  M8/M9 rely on them; the spec's documented fallback (visual approval
  stamp instead of Odoo Sign; adapter instead of a standard WhatsApp
  connector) applies here.
- Python virtualenv at `.venv/` with Odoo's own `requirements.txt`
  installed against Python 3.10.
- `custom_addons/training_management/`: an installable-but-empty addon
  skeleton (`depends: base, mail, survey`) whose only real content is
  the standard-schema smoke test required by milestone M0.

## Starting the stack

1. **PostgreSQL** (project-local cluster, not the system one):
   ```
   ./scripts/start_postgres.sh
   ```
   Stop with `./scripts/stop_postgres.sh`.

2. **Odoo config**: copy the template once —
   ```
   cp env/odoo.conf.example env/odoo.conf
   ```
   (`env/odoo.conf` is gitignored; edit it locally as needed.)

3. **Odoo** (must be on port 8069 — the default the frontend proxy
   targets — unless you also change `ODOO_INTERNAL_BASE_URL` below):
   ```
   ./scripts/run_odoo.sh -d training_management_dev -i training_management
   ```
   The Back-office UI is at `http://localhost:8069` — used by admins
   only; trainees/supervisors/trainers use the Next.js app below and
   never need to open this URL directly.

4. **Development data** (all roles, a 32-day program and a realistic
   history, to exercise every screen manually — see "Development data"
   below):
   ```
   ./scripts/load_dev_data.sh training_management_dev
   ```

5. **Next.js frontend**:
   ```
   cp env/frontend.env.example frontend/.env.local
   ./scripts/start_frontend.sh
   ```
   Then open `http://localhost:3000` (redirects to `/ar` by default).
   The frontend's own `next.config.ts` reverse-proxies every
   `/api/v1/*` request to Odoo (see "Operational UI (M5)" below) — you
   never call `localhost:8069/api/v1/*` directly from the browser.

## Operational UI (M5)

The Next.js app at `http://localhost:3000` is the real trainee/
supervisor/trainer interface; full architecture in
`docs/adr/ADR-006-nextjs-operational-ui.md`. Manual test URLs (after
starting Odoo + loading dev data + starting the frontend, above):

- `http://localhost:3000/ar` (or `/en`) — redirects to `/login` or the
  signed-in user's dashboard.
- `http://localhost:3000/ar/login` — sign in with one of the dev
  accounts below.
- `http://localhost:3000/ar/trainee` — trainee dashboard →
  `/trainee/<training_day_id>` for the daily survey.
- `http://localhost:3000/ar/supervisor` — supervisor dashboard →
  `/supervisor/<training_day_id>/attendance` and
  `/supervisor/<training_day_id>/survey`.
- `http://localhost:3000/ar/trainer` — trainer dashboard →
  `/trainer/<training_day_id>` for the daily report (draft/resume/
  final submit).

**Environment variable:** `ODOO_INTERNAL_BASE_URL` in
`frontend/.env.local` (from `env/frontend.env.example`) — server-only
(no `NEXT_PUBLIC_` prefix; the browser never sees or needs it), default
`http://localhost:8069`. This is the only configuration the proxy
needs; there is no CORS configuration anywhere because the browser
never leaves the Next.js origin.

## Development data

One dataset, one loader. `scripts/load_dev_data.sh [db_name]` (default
`training_management_dev`) pipes two idempotent scripts into
`odoo-bin shell`:

1. `scripts/seed_surveys.py` — the approved survey questions
   (`docs/SURVEY_QUESTIONS.md`), the **only** definition of survey
   content. It is also the script to run on a real installation.
2. `scripts/dev_data.py` — users of every role, the program, courses,
   training days, enrollments and a realistic Arabic/English history.

```
./scripts/load_dev_data.sh training_management_dev
```

- **What you get** — the 16-week leadership program for women
  Quran-school principals (Tuesday + Thursday, 32 days, five courses),
  18 trainees, 5 trainers, a supervisor and a
  general supervisor (the project's four training roles); attendance, all three survey types, five reports,
  audit entries and a few scenarios (hall failure, a theory-heavy
  course, a withdrawn trainee, a postponed and a rescheduled day, a
  reopened day, a corrected response). The nearest upcoming day is left
  **open** with a wide survey window so every role has something to act
  on. It runs through the normal model methods as the proper role user;
  only the historical timestamps of a fresh load are set with SQL.
- **Never loaded by module installation** — not an Odoo `demo` manifest
  entry; it only runs when explicitly invoked. It never creates, drops
  or recreates a database: create one first
  (`./scripts/run_odoo.sh -d <db> -i training_management`).
- **Idempotent and non-destructive** — every record is matched on a
  stable key (login, program name, course sequence, program + date) and
  an existing one is left exactly as it is. Re-running adds only what
  is missing and never overwrites a password, state, response or
  attendance, so UAT progress survives. History is recorded only into
  days created by the same run.
- **Production guard** — only databases named `training_management_dev*`
  or `training_management_demo*` are accepted (checked by the loader and
  again inside `dev_data.py`), and `dev_data.py` also refuses an Odoo
  configuration with `proxy_mode` on or `list_db` off. A database
  loaded by the retired `seed_demo.py` (accounts `@nooralqiyadah.example`)
  is refused rather than given a second overlapping program.
- **Accounts** (password `Dev12345!` for all, including the built-in
  `admin` — a fixed, published, local-development-only password, not a
  secret). A password is set only when an account is created (and the
  built-in admin's on the first load); a reload never changes an existing
  one. `./scripts/load_dev_data.sh <db> --reset-passwords` resets them on
  purpose:

  | Login | Role |
  |---|---|
  | `dev_gs` | General Supervisor / Admin (المشرف العام) |
  | `dev_supervisor` | Supervisor (المشرفة; every training day) |
  | `dev_trainer`, `dev_trainer_2` … `dev_trainer_5` | Trainers (المدربة; one per course; `dev_trainer` also on the open day) |
  | `dev_trainee`, `dev_trainee_2` … `dev_trainee_18` | Trainees (المتدربة), all enrolled |

## Running the standard-schema smoke test (milestone M0 deliverable)

```
./scripts/run_schema_smoke_test.sh
```

This installs `training_management` into a disposable database and
runs `custom_addons/training_management/tests/test_schema_smoke.py`,
which asserts that the standard Odoo models/fields PROJECT_SPEC
section 4 depends on actually exist on the real Odoo 19 runtime — it
contains no business logic. The database is dropped automatically
afterward. The same script (`./scripts/run_schema_smoke_test.sh`) also
runs every other addon test (M1-M4), tagged `training_management`, in
one pass.

## Running the frontend tests (milestone M5 deliverable)

```
cd frontend && npm test
```

Vitest + React Testing Library, covering locale/RTL-LTR configuration,
login success/failure/validation, protected-route redirects, role
-based nav visibility, the API client's envelope/error-code handling
(401/403/404/409/422/network failures), all three dashboards, the
trainee survey's render/submit/read-only-after-submit flow, supervisor
attendance editing/validation, the trainer draft-save/resume/final
-submit/read-only flow, and request-ID surfacing in error states. Also
run `npm run lint` and `npm run build` — both must stay clean.

**Node version note:** the system Node (v10) cannot run any of this;
prepend the pinned Node 20 runtime first, e.g.
`export PATH="$HOME/.local/opt/node-current/bin:$PATH"` (or `nvm use`
inside `frontend/`), matching `scripts/start_frontend.sh`.

## Verified runtime deviations from the specification documents

See `docs/adr/ADR-001-odoo19-runtime-baseline.md` for the full record.
Summary: `res.partner.mobile` does not exist on the verified Odoo 19
Community runtime (use `phone` — `PROJECT_SPEC_v1.1_BILINGUAL.md`
section 4 has been corrected accordingly); the `sign` and `whatsapp`
modules are not present in this Community environment (Enterprise
-only); the `sms` module is present. The historical BRD/SRS/ERD/API
Contract `.docx` files still reflect the older, unverified
assumptions and are intentionally left unmodified — PROJECT_SPEC plus
this ADR are what implementation should follow.

See `docs/REQUIREMENTS_ALIGNMENT.md` for the document authority
hierarchy, the version-label reconciliation for those `.docx` files
(their file names, internal versions and citations disagree), the
requirements traceability matrix, resolved inconsistencies, the open
product decisions (OPD-xx) and the infrastructure prerequisites.

See also `docs/adr/ADR-002-odoo19-implementation-conventions.md` for
the Odoo 19 implementation-level conventions discovered while building
milestone M1 (the `models.Constraint` pattern replacing
`_sql_constraints`, `res.groups` no longer having `category_id`,
search-view `<group>` syntax, the `odoo-bin i18n` subcommands, and the
confirmed PostgreSQL ≥ 13 requirement) — required reading before
writing any new Odoo model/view/security code in this addon.

See also `docs/adr/ADR-003-survey-response-lifecycle.md` for the
Odoo Survey integration built in milestone M2: the exact
new/in_progress/done lifecycle mapping (trainer "draft" = standard
`in_progress`, no custom state), the response-ownership/uniqueness
model, historical locking, survey versioning, and why
`base.group_user`/`survey.group_survey_user` are deliberately not
implied for Trainee/Supervisor/Trainer (verified: `base.group_user`
has zero default access to any Survey model in Odoo 19, and
`group_survey_user`'s own record rules are unrestricted database-wide).

See also `docs/adr/ADR-004-analytics-and-day-workflow.md` for the M3
analytics/KPI formulas (response/course/program-level scoring, equal
weight per response, attendance and trainee response-rate formulas,
null-vs-zero semantics), why the Back-office KPI dashboard is a
SQL-view reporting model (`training.survey.response.kpi`) rather than
a computed Float measure — verified: `fields.Float`'s falsy value is
`0.0`, not SQL `NULL`, which would otherwise make a Pivot average
silently treat "no valid answers" as a real zero — and the explicit
`training.day` open/close/postpone/cancel/reopen workflow with no
automatic time-based state transition.

See also `docs/adr/ADR-005-operational-api-authentication.md` for the
M4 Operational API: why Odoo-native session auth was chosen over a
custom token scheme, the verified session-cookie/CSRF/CORS behavior
that shapes the same-origin deployment requirement, the
`{data, meta, error}` response envelope and exception-to-HTTP-status
mapping, the two real pre-dispatch-authentication runtime bugs found
and fixed live (a raw-traceback leak on an expired/missing session,
and a `babel`-locale-alias crash on a bare `Accept-Language: ar`
header), role/capability resolution from Odoo groups only, DTO field
-name mappings, and the idempotent final-submit design.

See also `docs/adr/ADR-006-nextjs-operational-ui.md` for the M5
Operational UI: the same-origin reverse-proxy architecture (verified
live end-to-end with the real session cookie flowing through it),
session/auth React context and protected routing, the shared typed API
client, why no form library was added (survey forms have no
compile-time schema), the trainee/supervisor/trainer page flows, and
two real API-surface gaps found while building against it (no
supervisor-survey status endpoint; no way for a trainee to retrieve
their own submitted answers).

See also `docs/adr/ADR-007-supervisor-survey-status-endpoint.md` for
M6: the scope-reconciliation finding that M5 already delivered M6's
(and M7's) literal `DEVELOPMENT_PLAN_v1.1_BILINGUAL.md` scope, the M5 blocking-issue
check performed before M6 work started, and the one real gap closed —
`GET /api/v1/training-days/<id>/supervisor-survey/status`, replacing
the supervisor survey page's dashboard-lookup workaround. The trainee
own-answers gap noted above was later closed (read-back approved 2026-10-03, ADR-006 section 12.1).

See also `docs/adr/ADR-008-training-report-approval-and-export.md` for
M8: reusing `training.analytics` for every KPI/attendance/response-rate
number in a report rather than re-deriving them, the null-vs-zero
snapshot design, the two-tier versioning/immutability write-lock, the
`env.su`-bypasses-`action_approve()`'s-group-check pitfall verified
while writing the test suite (and how `test_survey_user_input.py`'s
existing `.with_user(...)` convention already covers it), why the
standard `web.html_container`/`external_layout` composition already
produces a correct RTL PDF with no custom CSS, and why no
Operational API endpoint was needed for this milestone at all.

See also `docs/adr/ADR-009-notifications-and-reminder-automation.md`
for M9: why a dedicated cross-channel log model was needed instead of
`mail.mail`/`sms.sms` alone, reusing existing relations for
eligibility instead of a new formula, the safe test-mode-by-default
provider adapter design for SMS/WhatsApp (and the standard `sms`
module as an explicit, untested-by-CI opt-in production path), the
retry/fallback policy semantics, the `res.config.settings` Settings
-app-of-its-own pattern, and the two different (but both verified)
mechanisms behind email vs. SMS/WhatsApp language selection.

See also `docs/adr/ADR-010-hardening-and-deployment-readiness.md` for
M10: the full security review and its one non-security API-consistency
finding, the real (non-root) `wkhtmltopdf` and PostgreSQL 13 binary
-extraction techniques (one fully successful, one blocked at cluster
initialization), the real backup/restore drill and the pipe/SIGPIPE
bug it caught in the restore script, the performance-profiling numbers
behind the deliberate "no code change" decision, and the three
previously-flagged gaps closed (`training.audit.log`, password
recovery, the supervisor-dashboard test). `docs/RUNBOOK.md` is the
companion production runbook this ADR's "Deployment Preparation"
section summarizes.

## Operational API (`/api/v1`)

Milestone M4 adds a narrow, operational-only HTTP API for the Next.js
frontend, implemented as thin `type="json2"` controllers in
`custom_addons/training_management/controllers/`. Full architecture,
verified Odoo 19 session/cookie/CSRF/CORS behavior, DTO mappings, and
idempotency design are in
`docs/adr/ADR-005-operational-api-authentication.md`. Summary:

- **Auth:** `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`,
  `GET /api/v1/auth/me` — Odoo's own session cookie, no custom
  JWT/token store.
- **Dashboards:** `GET /api/v1/dashboard/{trainee,supervisor,trainer}`.
- **Trainee:** `GET/POST /api/v1/training-days/<id>/my-survey[/status|/response|/submit]`.
- **Supervisor:** `GET/PUT /api/v1/training-days/<id>/attendance`,
  `GET/POST .../supervisor-survey[/submit]`,
  `GET .../supervisor-survey/status`.
- **Trainer:** `GET/PUT/POST /api/v1/training-days/<id>/trainer-report[/draft|/submit]`.
- Every response is `{"data": ..., "meta": {"request_id": ...}, "error": null}`
  on success, or `{"data": null, "meta": {...}, "error": {"code", "message", "fields"}}`
  on failure — never a raw stack trace, even for errors raised by
  Odoo's own pre-dispatch authentication (see the ADR for why a plain
  `try/except` in each controller isn't enough for that case).
- `Accept-Language: ar`/`en` controls the language of error/response
  messages only — never business calculations. Same-origin access is
  now wired up (M5): `frontend/next.config.ts` reverse-proxies every
  `/api/v1/*` request to Odoo — see "Operational UI (M5)" above and
  `docs/adr/ADR-006-nextjs-operational-ui.md`.
- No generic ORM endpoint, no admin CRUD, and none of the M3
  `training.day` workflow actions
  (`action_open`/`close`/`reopen`/`postpone`/`cancel`) are reachable
  through this API — verified by `test_operational_api_security.py`.

## Troubleshooting / development notes

- **Local PostgreSQL uses `trust` authentication (no password).** This
  is acceptable only because `.pgdata/` is a throwaway, user-space
  cluster used solely for local development (see "Environment reality
  check" above). Never configure `trust` auth, or reuse this exact
  `initdb`/`pg_ctl` setup, for staging or production.
- **Node version is pinned via `frontend/.nvmrc`** (currently
  `20.18.1`). The system Node on the machine this was built on is v10
  and cannot run this project; if you have `nvm`, run `nvm use` inside
  `frontend/` to pick up the right version instead of relying on the
  manual `~/.local/opt/node-current` download `scripts/start_frontend.sh`
  uses as a fallback.
- **Python virtualenv workaround:** on the machine this was built on,
  `python3.10 -m venv` failed because `python3.10-venv` (and therefore
  `ensurepip`) was not installed and could not be installed without
  `sudo`. The working fix was: `python3.10 -m venv --without-pip .venv`
  followed by bootstrapping pip manually with
  `curl -sS https://bootstrap.pypa.io/get-pip.py | .venv/bin/python -`.
  If your machine already has `python3.10-venv` installed, a plain
  `python3.10 -m venv .venv` works and this workaround is unnecessary.
- **PostgreSQL 12 (used locally) is below Odoo 19's supported
  minimum.** Verified directly from source
  (`.odoo-core/odoo/release.py`: `MIN_PG_VERSION = 13`) — confirmed at
  runtime too: `odoo-bin` emits `Postgres version is ..., lower than
  minimum required ...` against this project's local PostgreSQL
  12.22 cluster. It still works for local development/tests (Odoo
  only warns, it doesn't refuse to start), but **production must run
  PostgreSQL 13 or later**; do not provision a PG12 production
  database based on what this dev environment happens to have
  installed.

## Bilingual/i18n baseline

- Next.js: `next-intl`, App Router `[locale]` segment, locales `ar`
  (default, RTL) and `en` (LTR), message catalogs in
  `frontend/messages/{ar,en}.json`. A single `app/[locale]/page.tsx`
  serves both languages — no duplicated pages per language.
- Note: Next.js 16 deprecated `middleware.ts` in favor of `proxy.ts`
  (function/export names unchanged); the locale-routing proxy lives at
  `frontend/proxy.ts`.
- Odoo: `custom_addons/training_management/i18n/training_management.pot`
  (150 translatable terms as of M4's models/views/security/controllers)
  and `i18n/ar.po` (Arabic translations for all of them, verified by
  actually loading them into a test database with
  `odoo-bin i18n loadlang`/`import` and confirming live via HTTP that
  `Accept-Language: ar` vs `en` produce genuinely different, correctly
  translated API error text — not just checked for `.po` syntax).
  Regenerate the
  `.pot` after adding more user-facing content with:
  `odoo-bin i18n export -d <db> training_management` (Odoo 19 moved
  this under the `i18n` subcommand; the older flat `--i18n-export`
  flag no longer exists).
