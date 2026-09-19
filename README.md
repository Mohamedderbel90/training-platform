# Training Program Management & Evaluation System

Source of truth: `PROJECT_SPEC_v1.1_BILINGUAL.md`.
Implementation order: `DEVELOPMENT_PLAN_v1.1_BILINGUAL.md`.

Milestone status: **M10 complete** (Hardening, E2E, Performance and
Deployment Readiness per `DEVELOPMENT_PLAN_v1.1_BILINGUAL.md`). M5, as actually delivered,
already built the full trainee/supervisor/trainer UI/API in one pass
(a same-origin reverse proxy from Next.js to Odoo, session-cookie-based
auth wired into a React context, protected routing, dashboards, the
trainee daily survey, supervisor attendance + evaluation survey, and
trainer draft/final report flows, all consuming the M4 `/api/v1` API
through one typed client layer — documented in
`docs/adr/ADR-006-nextjs-operational-ui.md`), ahead of the plan's
original per-role milestone split. M6 closed the one real supervisor
-flow gap (`GET .../supervisor-survey/status`, mirroring the trainee
flow's status endpoint, replacing a dashboard-lookup workaround) — see
`docs/adr/ADR-007-supervisor-survey-status-endpoint.md`. M7 audited the
already-delivered trainer flow against `DEVELOPMENT_PLAN.md`'s M7 scope
and test list end to end (dashboard, open/draft/resume/submit,
read-only-after-submit, multi-trainer isolation, privacy, auth/error
handling, ar/en + RTL/LTR) and found the backend and UI already
complete and correct; the one genuine gap was a missing frontend unit
test for the trainer dashboard (`tests/TrainerDashboard.test.tsx`,
added — see "M7 audit" below). M8 added `training.report` (course/
program reports reusing `training.analytics` for every number,
generate/approve workflow, filters, versioning, a QWeb Arabic RTL PDF
with a visual approval stamp, and an xlsxwriter Excel export) — see
`docs/adr/ADR-008-training-report-approval-and-export.md`. M9 added
`training.notification.log` (a cross-channel email/SMS/WhatsApp
reminder log reusing the same training.day relations/survey
-completion checks M1-M3 already define for eligibility and duplicate
prevention, with retry/failure tracking, a channel-fallback policy,
and delivery-status tracking where a standard Odoo record exists) —
see `docs/adr/ADR-009-notifications-and-reminder-automation.md`. M10
is a verification/readiness pass, not a new feature: a full security
review (ACL/rule audit, live API-error probing, frontend storage/logs
audit), an end-to-end scenario test, real `wkhtmltopdf` PDF rendering
verification (Arabic RTL, visually inspected), a demonstrated backup/
restore drill, performance profiling, a production runbook, two new
health-check endpoints, and three resolved outstanding gaps —
`training.audit.log` (flagged missing since M3), the previously
-deferred password-recovery endpoints (required since M4), and a
missing supervisor-dashboard frontend test (flagged since M7) — see
`docs/adr/ADR-010-hardening-and-deployment-readiness.md`. No admin
CRUD or survey-builder UI/endpoint exists in Next.js — those remain
Odoo Back-office only. See `DEVELOPMENT_PLAN_v1.1_BILINGUAL.md` for
M11 onward if the plan is extended; **no milestone beyond M10 has been
started, and nothing has been deployed or committed to git.**

## M7 audit (Trainer Operational Flow)

Before any change, M7's scope was checked against
`DEVELOPMENT_PLAN_v1.1_BILINGUAL.md` and the code already shipped in
"M5" (`controllers/trainer.py`, `models/training_day.py`'s
`get_trainer_report_dto`, `app/[locale]/trainer/**`,
`tests/TrainerReportPage.test.tsx`,
`tests/test_operational_api_trainer.py`). Every M7 acceptance item was
already implemented and tested:

- **Dashboard + assigned days:** `GET /api/v1/dashboard/trainer` scoped
  entirely by the M1 record rule on `training.day` (assigned trainers
  only); `test_trainer_cannot_access_unassigned_day` (403).
- **Open report / draft / resume / submit:** one combined
  `GET .../trainer-report` DTO (`{definition, status, answers}`, the
  only role with a single combined endpoint — no dashboard-lookup
  workaround needed here, unlike the pre-M6 supervisor flow);
  `PUT .../trainer-report/draft` (state stays `in_progress`, editable);
  `POST .../trainer-report/submit` (state -> `done`/"submitted",
  `editable: false`); `test_save_draft_then_resume`,
  `test_final_submit`, `test_final_submit_requires_mandatory_question`.
- **Read-only after submit:** `test_cannot_edit_after_final_submit`
  (draft-write after final submit -> 400); the frontend's `SurveyForm`
  renders `readOnly={submitted}` with no Save Draft/Submit controls.
- **Multiple trainers, independent reports:** enforced at the database
  level by `survey.user_input`'s
  `(training_day_id, respondent_role, partner_id)` uniqueness
  (ADR-003) — `test_multiple_trainers_have_independent_reports`.
- **Privacy:** trainer cannot read a trainee's individual survey
  response or reach the supervisor endpoints —
  `test_trainer_cannot_retrieve_detailed_trainee_responses`,
  `test_trainer_cannot_access_supervisor_endpoint`.
- **ar/en + RTL/LTR:** full key parity verified between
  `messages/en.json` and `messages/ar.json` (no missing keys either
  direction); RTL/LTR is the shared, already-verified M5 layout
  mechanism (ADR-006 section 3), not role-specific code.
- **Auth/permissions/error handling:** `_require_trainer()` (group
  -membership check, server-side, before any model access, matching
  every other controller); `ProtectedRoute role="trainer"` (UX-only,
  per ADR-006 section 11); `roleHome.test.ts`'s
  "routes a trainer to /trainer" case.

**Gap found and fixed:** unlike the trainee flow
(`tests/TraineeDashboard.test.tsx`), the trainer dashboard had no
dedicated frontend unit test exercising its own role-specific wiring
(the `entry.trainer_report` field, the Open/View report link
switching on submission state). `tests/TrainerDashboard.test.tsx` was
added (4 tests: loading -> cards, submitted-state badge/link text,
empty state, error+retry). No backend or production frontend code
needed to change — the underlying implementation was already correct.

(The supervisor dashboard has the same test-coverage gap; it is
out of M7's scope and left open here.)

## M8 (Reports, Approval and Exports)

Before any change, M8's scope was checked against
`DEVELOPMENT_PLAN_v1.1_BILINGUAL.md`'s M8 section: no `training.report`
model, `report/` directory, or report views existed anywhere in the
addon — M7 stopped at the trainer flow, so M8 is entirely new work,
not a continuation. Full design in
`docs/adr/ADR-008-training-report-approval-and-export.md`. Summary:

- **`training.report`** (`models/training_report.py`): course/program
  reports with `report_type`, `program_id`/`course_id`, an optional
  explicit period (`date_from`/`date_to`, falling back to the course's
  or program's own dates), five `show_*` filter booleans, and a
  `draft -> generated -> approved` state machine.
- **KPI snapshot, not live-computed:** `action_generate()` calls
  `training.analytics.get_kpi()` / `get_attendance_metrics()` /
  `get_trainee_response_rate()` (M3, unchanged) and stores the result,
  with a companion `*_has_data` boolean per value so a stored `0.0`
  is never confused with "no data" (extending ADR-004's null-vs-zero
  rule to the snapshot).
- **Versioning/immutability:** an approved report cannot be written to
  at all (except its own system-managed attachment pointers); a
  generated-but-not-yet-approved report's *scope* fields are locked
  (regenerating its numbers is still allowed). Changing scope requires
  `action_new_version()`, which clones a new draft and never touches
  the source record — mirroring `survey.survey`'s own versioning
  pattern (ADR-003).
- **Approval:** `action_approve()` is restricted to
  `group_training_admin` in Python (Assistant Admin has full ACL
  write access but is explicitly denied here, per PROJECT_SPEC section
  7.2), and re-renders the PDF with a visual "Approved" stamp plus
  approver/date.
- **QWeb Arabic RTL PDF:** `report/training_report_reports.xml` uses
  the standard `web.html_container`/`web.external_layout` composition
  every Odoo report uses — no custom RTL CSS was needed; Odoo's own
  report layout already sets `dir="rtl"`/`"ltr"` from the rendering
  language's `res.lang.direction`.
- **Excel export:** a lightweight `xlsxwriter`-based export
  (`action_export_excel()`, already available in the project's Python
  virtualenv — no new dependency), sharing the same KPI-row data as
  the PDF so the two never disagree.
- **Unauthorized attachment access:** Trainee/Supervisor/Trainer have
  no ACL row at all on `training.report` (the same pattern already
  used for `training.attendance`), which also denies access to its
  PDF/Excel `ir.attachment` output through Odoo's own
  linked-record attachment access check — no bespoke attachment
  -security code was needed.
- No Next.js screen or Operational API endpoint was added: report
  generation/approval/export is exclusively an Odoo Back-office
  action, matching PROJECT_SPEC section 2.1/2.2 and the M8 exit
  criterion's own wording ("...entirely from Odoo").
- 24 new backend tests (`tests/test_training_report.py`; 189 total,
  0 failed), `flake8` clean; frontend unchanged by this milestone (74
  tests, lint, and `next build` all still pass); `i18n` extended (`.pot`
  152 → 230 terms, `ar.po` fully translated for all 78 new terms,
  verified by loading `ar_001` into a real database and reading
  translated field labels back from PostgreSQL).

## M9 (Notifications and Reminder Automation)

Before any change, M9's scope was checked against
`DEVELOPMENT_PLAN_v1.1_BILINGUAL.md`'s M9 section: no
`training.notification.log` model, `data/` directory, `res.config.settings`
extension, or `ir.cron` record existed anywhere in the addon. Full
design in `docs/adr/ADR-009-notifications-and-reminder-automation.md`.
Summary:

- **`training.notification.log`**: one row per (training day, role,
  respondent, channel, event), enforced unique at the database level —
  the actual duplicate-prevention mechanism, not just application
  logic.
- **Eligibility reuses existing relations** (enrollment/supervisor_id/
  trainer_ids, and the same final-survey-response check
  `check_survey_access()` already uses) — no new eligibility formula.
  `cron_send_reminders()` (`ir.cron`, hourly) only considers training
  days that are `state == 'open'` and currently inside their survey
  window, mirroring the exact two conditions submission itself already
  requires.
- **Three channel adapters:** Email is fully standard
  (`mail.template`/`mail.mail`, `auto_delete=False` so delivery status
  stays inspectable). SMS defaults to a safe, no-network "test"
  adapter, with the standard IAP-based `sms` module available as an
  explicit opt-in production mode (never exercised by this project's
  own tests). WhatsApp has no standard Odoo connector on this
  Community runtime and is therefore always a thin, test-mode-only
  adapter — a real provider is a documented future extension point,
  not implemented with invented credentials.
- **Retry/failure logging:** every failure is caught, logged with a
  message, and left retryable up to a configurable maximum
  (`res.config.settings`); a Back-office "Retry" button is also
  available.
- **Channel fallback (policy-gated):** when enabled, channels are
  tried in priority order and stop at the first success; when
  disabled (default), every enabled channel is attempted and tracked
  independently.
- **Configuration is `res.config.settings` only** (a new "Training
  Management" Settings app entry, admin-only) — no notification
  configuration screen exists in Next.js, per PROJECT_SPEC section 16.
- **Bilingual templates:** email content renders in the recipient's
  own language automatically via the standard `mail.template.lang`
  expression mechanism; SMS/WhatsApp body text uses the same `_()`
  /`ar.po` translation mechanism as everywhere else in this addon, via
  a verified context-rebinding idiom needed because Odoo's `_()`
  resolves language from the calling stack frame's own `self.env.lang`.
- 22 new backend tests (`tests/test_training_notification.py`; 211
  total, 0 failed), `flake8` clean; frontend unchanged by this
  milestone (74 tests, lint, and `next build` all still pass); `i18n`
  extended (`.pot` 230 → 283 terms, `ar.po` fully translated for all 50
  new terms — including the reminder email's full HTML body — verified
  by loading `ar_001` into a real database and reading translated
  field labels *and* the mail template's own translated subject/body
  back from PostgreSQL directly).

## M10 (Hardening, E2E, Performance and Deployment Readiness)

Full details in
`docs/adr/ADR-010-hardening-and-deployment-readiness.md`. Summary:

- **Security review:** full ACL/Record Rule audit against PROJECT_SPEC
  section 7 (no gaps found); every `sudo()` call site audited (three,
  all justified); live probing of the running dev API confirmed no
  traceback/secret ever leaks in an error response (one minor,
  non-security API-consistency finding: a wrong-HTTP-method request
  gets Werkzeug's generic 405 page instead of the JSON envelope, traced
  to Odoo core's own dispatcher bypassing `ir.http._handle_error` for
  that exception class); the frontend has zero `localStorage`/
  `sessionStorage`/`console.*` usage anywhere.
- **End-to-end test:** `tests/test_e2e_full_scenario.py` drives the
  full "admin setup -> trainee survey -> supervisor attendance/
  evaluation -> trainer report -> analytics -> report approval ->
  download" scenario through the real `/api/v1` controllers.
- **Real PDF rendering verified:** a genuine `wkhtmltopdf` binary was
  obtained without root access and used to render an actual approved
  report to PDF in English and Arabic; the Arabic PDF was rasterized
  and visually inspected — real RTL column mirroring, a real embedded
  Arabic font, and every static label correctly translated once
  `ar.po` was loaded into the verification database.
- **PostgreSQL 13+:** attempted with the same no-root technique (a
  real PG13 binary was made to run); blocked at cluster initialization
  by a compiled-in root-owned path this sandboxed environment's
  tooling can't safely work around. Code-level review found no
  PG12-specific behavior, but running the suite against a real 13+
  instance remains an outstanding pre-production step.
- **Backup/restore demonstrated for real** via two new scripts
  (`scripts/backup_db.sh`, `scripts/restore_db.sh`): backed up a real
  database + filestore, dropped the original (simulating a disaster),
  restored into a new database, and verified the data via both raw SQL
  and a live Odoo/ORM read-back.
- **Performance profiled** with a 40-trainee/15-day fixture; KPI/
  analytics queries are already efficient (2-3 queries, <20ms each); a
  real N+1 pattern exists in the dashboard and reminder-cron paths but
  is not a problem at this project's realistic scale, so no
  speculative rewrite or index was added — measured and documented
  instead.
- **Deployment prep:** `docs/RUNBOOK.md` (production config, TLS/nginx
  example, monitoring, cron monitoring, backup schedule, go-live
  checklist) plus two new live-verified health-check endpoints
  (`GET /api/v1/health`, `GET /api/health`).
- **Three outstanding gaps resolved:** `training.audit.log` (flagged
  missing since M3 — now wired into training-day reopen, report
  approval, and training-role permission changes),
  `POST /api/v1/auth/password/forgot|reset` (required since M4,
  previously deferred — standard `auth_signup` reused, with explicit
  anti-enumeration behavior), and a missing
  `tests/SupervisorDashboard.test.tsx` (flagged since M7).
- 14 new backend tests (225 total, 0 failed), `flake8` clean; 5 new
  frontend tests (79 total, 0 failed), lint and build clean; `i18n`
  extended (`.pot` 283 → 302 terms, `ar.po` fully translated for all 19
  new terms).
- **Not done, and explicitly out of scope for this milestone:** any
  real SMS/WhatsApp provider send, TLS/production deployment, and a
  git commit — per this milestone's own instructions, all three
  require separate explicit approval first.

## Repository layout

```
custom_addons/training_management/   Odoo 19 custom addon (M0-M10: models, security, survey integration, analytics, workflow, Operational API, reports/approval/export, notifications/reminders, audit log, health checks)
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

4. **Development demo data** (users/program/course/day/surveys to
   actually exercise the trainee/supervisor/trainer screens manually —
   see "Development data" below):
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
- `http://localhost:3000/ar/login` — sign in with one of the demo
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

`scripts/dev_data.py` (run via `scripts/load_dev_data.sh <db_name>`,
which pipes it into `odoo-bin shell`) creates/updates a small,
clearly-named set of demo records so the M5 Operational UI can
actually be exercised by hand:

```
./scripts/load_dev_data.sh training_management_dev
```

- **Never loaded by module installation** — it is not an Odoo `demo`
  manifest entry and is not referenced by `__manifest__.py`; it only
  runs when explicitly invoked, and production installs (which always
  run with `--without-demo=all`, as every script in this repo already
  does) are entirely unaffected regardless.
- **Idempotent** — re-running it updates the same demo users/program/
  course/day/surveys in place (matched by fixed login/name), rather
  than creating duplicates.
- **Demo accounts** (password `Dev12345!` for all three):

  | Login | Role |
  |---|---|
  | `dev_trainee` | Trainee, enrolled in "Demo Program" |
  | `dev_supervisor` | Supervisor, assigned to the demo training day |
  | `dev_trainer` | Trainer, assigned to the demo training day |

- The demo training day is left `open` with a wide survey window
  (now − 1h to now + 30 days) so it stays usable without needing to be
  reloaded constantly.
- No production credentials are hard-coded anywhere in this script —
  `Dev12345!` is a fixed, published, local-development-only password,
  not a secret.

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
(and M7's) literal `DEVELOPMENT_PLAN.md` scope, the M5 blocking-issue
check performed before M6 work started, and the one real gap closed —
`GET /api/v1/training-days/<id>/supervisor-survey/status`, replacing
the supervisor survey page's dashboard-lookup workaround. The trainee
own-answers gap noted above remains open (not in M6's scope).

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
- **Trainee:** `GET/POST /api/v1/training-days/<id>/my-survey[/status|/submit]`.
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
