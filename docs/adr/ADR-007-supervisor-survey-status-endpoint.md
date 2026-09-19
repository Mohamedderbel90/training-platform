# ADR-007: M6 Supervisor Operational Flow — Status Endpoint and Scope Reconciliation

- **Status:** Accepted
- **Date:** 2026-09-16
- **Milestone:** M6 (Supervisor Operational Flow, per `DEVELOPMENT_PLAN_v1.1_BILINGUAL.md`)
- **Related:** ADR-005, ADR-006

## Context

`DEVELOPMENT_PLAN_v1.1_BILINGUAL.md` defines M6 as a standalone
milestone: attendance recording plus the supervisor evaluation survey,
both the Odoo API endpoints and the Next.js screens, with a dedicated
test list and exit criterion ("Supervisor can complete daily
operational work entirely in Next.js without admin configuration
access").

Before this milestone's own work started, the actual implementation
history was checked against that plan (as instructed: "identify the
exact scope of M6" and "check whether M5 has any unresolved blocking
issues" before doing any new work). That check found that M5, as
actually delivered (`docs/adr/ADR-006-nextjs-operational-ui.md`, dated
2026-09-15), already built the full trainee **and** supervisor **and**
trainer UI/API surface in one pass, rather than following the plan's
original per-role milestone split (M5 = trainee only, M6 = supervisor,
M7 = trainer). `README.md`'s milestone-status line still read "M5
complete... trainee/supervisor/trainer" at the start of this session.

Concretely, before this ADR, M6's literal scope was already in place:

- `GET`/`PUT /api/v1/training-days/<id>/attendance`,
  `GET`/`POST /api/v1/training-days/<id>/supervisor-survey[/submit]`,
  and `GET /api/v1/dashboard/supervisor` all existed
  (`controllers/supervisor.py`, `controllers/dashboard.py`).
- The Next.js supervisor dashboard, attendance table (present/absent/
  late + late-minutes controls), and evaluation survey page all existed
  (`app/[locale]/supervisor/**`).
- Every M6 test-list item was already covered: supervisor-sees-only
  -assigned-days and only-enrolled-trainees-appear
  (`test_get_attendance`), one-row-per-trainee/day
  (`training_attendance_day_enrollment_uniq` + upsert-not-duplicate
  test), supervisor-cannot-see-trainee-survey-detail
  (`test_supervisor_cannot_retrieve_detailed_trainee_responses`), and
  window/policy-gated submission (shared `check_survey_access()` logic
  from ADR-003/ADR-005, exercised generically, not per-role).

**M5 blocking-issue check (per instruction, before starting any M6
work):** the full backend suite (161 tests) and frontend suite (66
tests) were run as a baseline. Backend: 0 failed, 0 errors. Frontend:
one apparent failure,
`AuthContext.test.tsx > login() updates status/profile on success`,
only when running the entire suite together; re-run in isolation it
passed in 126ms, consistently, across repeated runs. This was
diagnosed as vitest worker/resource contention on this specific
sandboxed dev machine (the full-suite run's own reported
transform/setup/environment timings were 50-140s per phase — far
outside normal range), not a defect in `AuthContext.tsx` (`login()`
sets `profile` and `status` synchronously in the same callback, so
both update together under React's own batching; nothing about that
code path is racy). No fix was needed or made for this; it is recorded
here as the outcome of the required M5 check, not left silently
unexamined. **No other M5 blocking issue was found.**

## Decision: What M6 Actually Delivers

Given the above, M6's own new work is exactly the one real gap ADR-006
section 12 already flagged as deferred: the supervisor flow had no
`GET .../supervisor-survey/status` endpoint mirroring the trainee
flow's `GET .../my-survey/status`, so
`SupervisorSurveyContent` had to re-fetch the entire
`GET /api/v1/dashboard/supervisor` list and search it for the current
day's entry just to answer "what's my evaluation status for this day"
-- a workaround that was correct but indirect, and that silently
depended on the current day still being present in the dashboard's own
scope.

**Added:**

- `GET /api/v1/training-days/<id>/supervisor-survey/status`
  (`controllers/supervisor.py`), calling the same
  `training.day.get_survey_status(role, user)` service method the
  trainee/trainer flows and the dashboard already use (ADR-005 section
  11) -- no new business logic, purely a new thin route onto existing,
  already-tested model behavior.
- `supervisorApi.getSurveyStatus()` (`frontend/lib/api/endpoints.ts`),
  and `SupervisorSurveyContent`
  (`app/[locale]/supervisor/[dayId]/survey/page.tsx`) was rewritten to
  call it directly, in the same shape as `TraineeSurveyContent`: fetch
  status first, fetch the question definition only once `can_submit`
  is true and the response isn't already final. The dashboard-lookup
  workaround and its explanatory comment were removed; a direct
  navigation, bookmark, or page refresh to the supervisor survey page
  no longer depends on that day still appearing in the dashboard's own
  list.
- Backend tests (`test_operational_api_supervisor.py`):
  `test_get_supervisor_survey_status_not_started`,
  `test_get_supervisor_survey_status_after_submit`,
  `test_supervisor_survey_status_requires_supervisor_role`,
  `test_supervisor_survey_status_denied_for_unassigned_supervisor` --
  the same coverage shape as the trainee status endpoint's tests.
- Frontend tests (`tests/SupervisorSurveyPage.test.tsx`, new file,
  mirroring `TraineeSurveyPage.test.tsx`): renders from status+
  definition, submits and shows the read-only thank-you state, shows
  the already-submitted state without ever calling `getSurvey`, and
  shows the server's own unavailable-reason text when the window isn't
  open.

**Not changed:** attendance endpoints/UI, the supervisor dashboard, and
the submit endpoint were already correct and are unchanged by this
milestone -- only the missing status endpoint and its one caller were
added.

## Verification

- Backend: 165 tests (161 existing + 4 new), 0 failed, 0 errors, run
  against a real Odoo 19 instance/PostgreSQL database via the M0 smoke
  -test harness (`scripts/run_schema_smoke_test.sh`'s pattern, run on a
  disposable database/port to avoid the developer's already-running
  Odoo instance on 8069).
- Frontend: 70 tests (66 existing + 4 new), 0 failed. `npm run lint`
  clean. `npm run build` run as part of this milestone's verification
  (see M6 report for the result).
- No admin/CRUD/generic-ORM surface was added or changed; the new route
  follows the exact `_require_supervisor()` -> browse -> DTO pattern
  every other controller method in this file already uses.

## M7 Note

Per the same divergence documented above, `DEVELOPMENT_PLAN.md`'s M7
(Trainer Operational Flow) scope was also already delivered inside
what the repository calls "M5" (`controllers/trainer.py`,
`app/[locale]/trainer/**`, `TrainerReportPage.test.tsx`) and is
**out of scope for this milestone** -- this ADR and its accompanying
M6 report deliberately stop at the one supervisor-flow gap above and
do not touch trainer code, per the instruction to implement M6 only
and not begin M7.
