# DEVELOPMENT_PLAN.md

## Training Program Management & Evaluation System

**Version:** 1.1  
**Date:** 2026-09-14  
**Source of truth:** `PROJECT_SPEC_v1.1_BILINGUAL.md`  

This plan breaks implementation into milestones with clear dependencies and acceptance gates. Do not start a milestone whose prerequisite gate is failing.

---

# M0 — Repository, Environments and Technical Baseline

## Goals

- Establish project repositories/workspaces.
- Confirm Odoo 19 runtime/build and installed modules.
- Verify every Odoo standard model/field used by `PROJECT_SPEC.md` against the actual runtime.
- Define local/dev/test environment configuration.
- Decide the authentication transport for the deployment topology.

## Tasks

- Create Odoo custom addon workspace.
- Create Next.js workspace.
- Add environment templates without secrets.
- Add lint/test commands.
- Implement a schema smoke test for required standard Odoo models/fields.
- Confirm `survey`, `mail`, QWeb/report dependencies.
- Decide whether optional Sign/WhatsApp modules exist.
- Define request correlation/logging convention.
- Establish codebase language rule: all technical code/identifiers in English.
- Establish i18n baseline: Arabic (`ar`, RTL) + English (`en`, LTR).
- Add locale/message structure for Next.js and translation structure for Odoo custom addon.

## Exit criteria

- Odoo starts with addon path configured.
- Next.js starts independently.
- Locale switching baseline works for `ar` and `en` without duplicating pages.
- Standard-schema smoke test passes.
- Authentication approach is documented.
- CI can run baseline tests/lint.

---

# M1 — Odoo Addon Skeleton, Security and Core Domain Models

## Scope

Implement the project foundation in Odoo.

## Tasks

- Add `training_management` manifest/dependencies.
- Define project groups:
  - General Supervisor/Admin
  - Assistant Admin (optional)
  - Trainee
  - Supervisor
  - Trainer
- Define ACLs and Record Rules.
- Implement:
  - `training.program`
  - `training.course`
  - `training.day`
  - `training.enrollment`
  - `training.attendance`
- Implement archive/state/uniqueness constraints.
- Add `mail.thread` / `mail.activity.mixin` only where useful.
- Add initial Odoo menus/actions/views.

## Tests

- Model creation/constraints.
- Enrollment uniqueness.
- Attendance uniqueness.
- Role access matrix.
- Cross-user privacy checks.

## Exit criteria

- Admin can manage Programs/Courses/Days/Enrollments in Odoo.
- Training Days have List/Form/Search/Calendar.
- Unauthorized users cannot access admin models.
- No Next.js admin CRUD has been introduced.

---

# M2 — Odoo Survey Integration and Versioning

## Scope

Reuse and extend Odoo Survey.

## Tasks

- Extend `survey.survey` with canonical project fields.
- Extend `survey.question` with `kpi_category`.
- Extend `survey.user_input` with training context fields.
- Implement survey role: trainee/supervisor/trainer.
- Implement project survey versioning/clone policy.
- Implement association between training days and correct survey versions.
- Enforce final response lock semantics around standard `state='done'`.
- Ensure no parallel answer table is created.

## Tests

- Survey creation through Odoo UI.
- Response linked to correct training day/respondent.
- Historical version remains intact after new version creation.
- Final trainee response cannot be modified by trainee.
- One final response per trainee/day/type.

## Exit criteria

- Admin configures surveys using Odoo standard Survey UI.
- Historical responses survive version changes unchanged.
- Survey standard fields/models are used exactly as verified.

---

# M3 — Odoo Back-office Operations, Analytics Foundation and Import

## Scope

Complete administrative workflow before frontend work expands.

## Tasks

- Finish menus/actions/search filters/group-bys.
- Add enrollment import flow:
  - standard import where enough
  - preview/validation wizard only if required
- Implement training-day workflow actions.
- Implement trainer/supervisor assignment.
- Implement analytics service/functions:
  - trainer score
  - content score
  - environment score
  - attendance/absence/late rates
  - response rate
- Add Graph/Pivot views where practical.
- Add sensitive audit model/events only where standard tracking is insufficient.

## Tests

- Import duplicate handling.
- Training-day state transitions.
- KPI formula tests.
- Missing-data behavior.
- Admin audit events.

## Exit criteria

- Admin can prepare a complete training day in Odoo without Next.js.
- KPI service returns deterministic values for known fixtures.

---

# M4 — Operational API Foundation + Next.js Shell/Auth

## Scope

Expose minimal operational API and create frontend shell.

## Odoo API tasks

Implement business-specific controllers/services:

- `/api/v1/auth/login`
- `/api/v1/auth/logout`
- `/api/v1/auth/me`
- password recovery/reset
- operational dashboard endpoints

Implement:

- standard envelope
- request IDs
- safe errors
- authorization checks
- rate limiting strategy for auth if infrastructure supports it
- CSRF/CORS/session rules according to chosen topology

## Next.js tasks

- Bilingual Arabic/English application shell with dynamic RTL/LTR.
- `next-intl` locale setup and language switcher.
- No hard-coded user-facing strings in components.
- Auth screens.
- Session bootstrap.
- Role routing.
- Shared API client/error handling.
- Loading/empty/error/forbidden/expired-session components.

## Tests

- Valid/invalid login.
- Disabled user.
- Session expiry.
- Role route protection.
- 401/403/422/500 handling.

## Exit criteria

- Each operational role logs in and lands on correct dashboard shell.
- Odoo remains the source of identity/permissions.
- No admin screens/endpoints exist in Next.js.

---

# M5 — Trainee Operational Flow

## Scope

Deliver complete trainee journey.

## Tasks

Odoo API:

- `GET /training-days/{id}/my-survey`
- `GET /training-days/{id}/my-survey/status`
- `POST /training-days/{id}/my-survey/submit`
- trainee dashboard endpoint

Next.js:

- Trainee dashboard.
- Daily survey renderer mapped from Odoo Survey DTO.
- Required-field validation.
- Final-submit confirmation.
- Success/read-only state.
- Closed-window state.

## Tests

- Trainee sees only own eligible days.
- Cannot submit another trainee's task.
- Cannot submit outside window.
- Double submit is idempotent/conflict-safe.
- Submitted response is read-only.
- Arabic RTL/mobile usability.
- English LTR/mobile usability.
- Same flow works in both locales without duplicated business components.

## Exit criteria

- End-to-end trainee submission writes standard `survey.user_input` / `survey.user_input.line` data and ends in `state='done'`.

---

# M6 — Supervisor Operational Flow

## Scope

Deliver attendance + supervisor evaluation.

## Odoo API tasks

- `GET /training-days/{id}/attendance`
- `PUT /training-days/{id}/attendance`
- `GET /training-days/{id}/supervisor-survey`
- `POST /training-days/{id}/supervisor-survey/submit`
- supervisor dashboard endpoint

## Next.js tasks

- Supervisor dashboard.
- Attendance table optimized for mobile/tablet.
- Present/Absent/Late controls.
- Late metadata.
- Supervisor evaluation survey.
- Completion status.

## Tests

- Supervisor sees only assigned day(s).
- Only enrolled trainees appear.
- One attendance row per trainee/day.
- Supervisor cannot see individual trainee survey answers.
- Evaluation submit respects survey window/policy.

## Exit criteria

- Supervisor can complete daily operational work entirely in Next.js without admin configuration access.

---

# M7 — Trainer Operational Flow

## Scope

Deliver trainer report flow.

## Odoo API tasks

- `GET /training-days/{id}/trainer-report`
- `PUT /training-days/{id}/trainer-report/draft`
- `POST /training-days/{id}/trainer-report/submit`
- trainer dashboard endpoint

## Next.js tasks

- Trainer dashboard.
- Daily report form.
- Save draft/resume.
- Final-submit confirmation.
- Final read-only state.

## Tests

- Trainer sees only assigned days.
- Multiple trainers can each have independent reports.
- Draft remains editable.
- Final report cannot be edited by trainer.
- Trainer cannot see detailed trainee evaluations.

## Exit criteria

- Trainer workflow works end-to-end with privacy rules intact.

---

# M8 — Reports, Approval and Exports

## Scope

Implement administrative reporting in Odoo.

## Tasks

- Implement `training.report`.
- Course report generation.
- Final program report generation.
- Filters/show-hide report sections.
- Versioning.
- QWeb Arabic RTL PDF.
- Visual approval stamp.
- Approval metadata.
- Store approved files in `ir.attachment`.
- Excel export if required beyond standard Odoo export.
- Authorized read/download endpoints only if end users need them.

## Tests

- KPI/report number parity.
- Approved version immutable.
- New changes create new version.
- Arabic PDF rendering.
- Unauthorized attachment access denied.

## Exit criteria

- General Supervisor generates, reviews, approves and downloads a stable report entirely from Odoo.

---

# M9 — Notifications and Reminder Automation

## Scope

Implement reminder system from Odoo.

## Tasks

- Email templates.
- `ir.cron` eligibility checks.
- Do-not-remind-finalized logic.
- SMS provider adapter.
- WhatsApp provider/Odoo connector adapter.
- Retry/failure logging.
- Admin configuration in Odoo only.

## Tests

- Eligible vs ineligible recipients.
- Duplicate prevention.
- Provider failure handling.
- Channel fallback if policy enables it.

## Exit criteria

- Reminders run automatically and have traceable results.

---

# M10 — Hardening, E2E, Performance and Deployment

## Security

- Full ACL/Record Rule review.
- Explicit privacy penetration tests between roles.
- Verify no sensitive data in Next.js local storage/logs.
- Verify no traceback/secrets in API errors.
- Review any `sudo()` usage.

## E2E

Run full scenario:

Admin setup -> trainee survey -> supervisor attendance/evaluation -> trainer report -> analytics -> report approval -> download.

## Performance

- Profile dashboards/analytics.
- Optimize ORM queries.
- Add indexes only when justified.
- Consider controlled caching only if needed; Odoo remains source of truth.

## Deployment

- Production environment variables/configuration.
- TLS.
- Database backup schedule.
- Restore test.
- Monitoring/logging.
- Scheduled action monitoring.
- Frontend/backend health checks.

## Exit criteria

- All acceptance tests pass.
- Backup restore has been demonstrated.
- Production runbook exists.
- Security/privacy review is signed off.

---

# Recommended AI Coding Workflow

For every implementation ticket:

1. Read `PROJECT_SPEC.md`.
2. Read the relevant latest SRS/ERD/API/UI section if more detail is needed.
3. Inspect existing code before generating new code.
4. Verify Odoo model/field names against actual Odoo 19 runtime/source.
5. Implement smallest vertical slice.
6. Add/update tests in the same change.
7. Run tests/lint.
8. Report files changed, tests run, and remaining risks.

Do not ask an AI coding agent to "build the whole system" in one prompt. Work milestone-by-milestone and ticket-by-ticket.

---

# Initial Ticket Order

Suggested first tickets:

1. `M0-T01` Bootstrap Odoo addon + manifest/dependencies.
2. `M0-T02` Add verified Odoo 19 schema smoke test.
3. `M1-T01` Security groups/ACL skeleton.
4. `M1-T02` `training.program` model + views/tests.
5. `M1-T03` `training.course` model + views/tests.
6. `M1-T04` `training.day` model + calendar/workflow/tests.
7. `M1-T05` `training.enrollment` + uniqueness/tests.
8. `M1-T06` `training.attendance` + uniqueness/status tests.
9. `M2-T01` Extend `survey.survey` canonical fields.
10. `M2-T02` Extend `survey.question` KPI mapping.
11. `M2-T03` Extend `survey.user_input` context/lock fields.
12. `M2-T04` Survey versioning + final-submit constraints/tests.

Only after these foundations are stable should the operational Next.js implementation accelerate.


# Cross-Cutting Gate — Internationalization (applies to every milestone)

Every milestone that adds user-facing functionality must satisfy all of the following before it is considered complete:

- Code and technical identifiers are English-only.
- Every new user-facing string exists in Arabic and English translation resources.
- Arabic renders RTL and English renders LTR.
- No duplicate page/component implementation exists solely for language differences.
- Odoo strings are extractable/translatable through standard Odoo i18n mechanisms.
- Translatable business fields use `translate=True` where appropriate.
- API behavior is locale-aware where server-generated text is returned.
- Reports/notifications added by the milestone are tested in both Arabic and English.
