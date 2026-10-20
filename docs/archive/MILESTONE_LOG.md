# Milestone Log (M5-M10) — archived from README.md

Historical delivery narrative moved verbatim from the root `README.md` on 2026-10-08 so the README can stay a setup guide. Statements such as "nothing has been committed to git" describe the state at the time of writing and are outdated. Authoritative sources: `docs/adr/ADR-005..011`, `docs/DECISIONS.md`, `PROJECT_SPEC_v1.1_BILINGUAL.md`.

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
already-delivered trainer flow against `DEVELOPMENT_PLAN_v1.1_BILINGUAL.md`'s M7 scope
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
added (4 tests: loading -> cards, submitted-state status/link text,
empty state, error+retry). No backend or production frontend code
needed to change — the underlying implementation was already correct.

(The supervisor dashboard has the same test-coverage gap; it is
out of M7's scope and left open here.)

**Post-M10 correction:** at the time of this audit, "the dashboard" was
the training-days list page at `app/[locale]/trainer/page.tsx`. A later
UI redesign split that page into a `/days` list route
(`app/[locale]/trainer/days/page.tsx`) and a separate dashboard
homepage (`app/[locale]/trainer/page.tsx`, welcome banner/stat cards/
upcoming-session card/task list), and `tests/TrainerDashboard.test.tsx`
was renamed to `tests/TrainerDaysPage.test.tsx` along with it — it
still covers exactly what this section describes (the `/days` list),
just under its current name. The new dashboard homepage that took over
the old `tests/TrainerDashboard.test.tsx` name was, for a time, entirely
untested; see the "Dashboard homepage test coverage" note below.

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
- **(Superseded 2026-10-04: now the General Supervisor Settings page (Settings > Settings), see the ADR-009 amendment.) Configuration is `res.config.settings` only** (a new "Training
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
  `tests/SupervisorDashboard.test.tsx` (flagged since M7; see the
  "Post-M10 correction" note under the M7 audit above — this file was
  later renamed to `tests/SupervisorDaysPage.test.tsx` when the
  dashboard homepage was split out, so it covers the `/days` list, not
  the homepage).
- 14 new backend tests (225 total, 0 failed), `flake8` clean; 5 new
  frontend tests (79 total, 0 failed), lint and build clean; `i18n`
  extended (`.pot` 283 → 302 terms, `ar.po` fully translated for all 19
  new terms).
- **Not done, and explicitly out of scope for this milestone:** any
  real SMS/WhatsApp provider send, TLS/production deployment, and a
  git commit — per this milestone's own instructions, all three
  require separate explicit approval first.

## Dashboard homepage test coverage (post-M10 correction)

A later UI redesign (after the M10 work above) split each role's
dashboard route into two: `app/[locale]/{trainee,supervisor,trainer}/
days/page.tsx` (the training-days list, what "the dashboard" meant
throughout M7-M10 above) and a new `app/[locale]/{trainee,supervisor,
trainer}/page.tsx` dashboard homepage (welcome banner, stat cards,
upcoming-session card, task list, quick-stats bars — none of which
existed when the M7/M10 sections above were written). The frontend
unit tests named in those sections were renamed alongside the route
split (`tests/TraineeDashboard.test.tsx` → `tests/
TraineeDaysPage.test.tsx`, and likewise for supervisor/trainer) and
still correctly cover the `/days` list pages; they were never updated
to also cover the new homepage, which briefly had zero direct test
coverage despite the M7/M10 narrative above reading as if "the
dashboard" were fully tested.

That gap is now closed: `tests/TraineeDashboard.test.tsx`, `tests/
SupervisorDashboard.test.tsx`, and `tests/TrainerDashboard.test.tsx`
(these exact file names, reused for the new homepage now that the old
content that used to live under them has its own `*DaysPage.test.tsx`
names) cover the actual dashboard homepage for each role: loading,
populated/success, empty, and API-error states. `tests/derive.test.ts`
unit-tests the pure view-model helpers in `lib/dashboard/derive.ts`
(ratio calculators, `buildTasks`'s at-most-one-upcoming-task cap,
`buildAttendanceTasks`) directly.

