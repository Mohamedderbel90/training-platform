# ADR-011: Role-Based Navigation and Dashboard Data Expansion

- **Status:** Accepted
- **Date:** 2026-09-25
- **Related:** ADR-005, ADR-006, ADR-007, ADR-010

## Context

The approved sidebar showed only "Dashboard" and "Training Days" per
role. The product needs a per-role item list (Trainee: Dashboard,
Training Days, Training Program; Supervisor: Dashboard,
Training Days, Attendance & Evaluation; Trainer: Dashboard, Training
Days, My Reports; everyone: Profile, then Logout) without redesigning
the approved sidebar, and the pages behind those items need data the
dashboard summary did not yet carry.

## Decisions

### 1. Backend (Odoo owns the data; additive only)

- `GET /api/v1/dashboard/{trainee|supervisor|trainer}` keeps its
  shape. It gains additive fields only: `program.state`,
  `program.courses[]` (`id`, `name`, `sequence`, `training_days_count`,
  `closed_days_count`, `training_hours`) and a `trainers` list on every
  day entry. Course figures are derived only from the days the caller
  can already see. No course status is exposed, because
  `training.course` has no state field (PROJECT_SPEC section 5).
- New `GET /api/v1/dashboard/{role}/days/{day_id}` returns one day in
  the dashboard-entry shape. There are three explicit routes, one per
  role, so the role always comes from the URL plus `_require_role()`,
  never from a client parameter. Semantics live in
  `training.day.get_dashboard_day()`: 404 for a missing or archived
  day, 403 when record rules hide it, 403 when the user can see the day
  but not in that role. No `sudo()`.
- `_get_attendance_summary()` now counts only **active** enrollments,
  the same population as `get_attendance_dto()` and
  `upsert_attendance()`. Previously an inactive or completed enrollment
  could keep a day's attendance `complete` false forever.
- The session/profile payload gains `tz` (the user's IANA zone, or
  null). Datetimes remain UTC on the wire (PROJECT_SPEC section 10).

### 2. Frontend (presentation only)

- The item list lives in `frontend/lib/auth/roleNav.ts`; `AppShell`
  renders it and the sidebar's visual design is unchanged. This is
  presentation only: each destination route enforces its role through
  `ProtectedRoute` and Odoo enforces the real permissions.
- New routes: `/trainee/program`,
  `/supervisor/evaluations`, `/trainer/reports`. They reuse
  `useDashboardSummary`; no new business rules are computed client
  side beyond grouping already-supplied status fields for display.
- Times are shown in `profile.tz`, falling back to the browser zone
  when unset or invalid. Calendar dates (`date`, program range) stay
  timezone-neutral so they never shift a day.

### 3. Presentation choices not taken from a spec

The section labels on the new list pages (for example "Available /
Submitted / Not available", "Needs action / Complete") and the rule
that a supervisor day is "Complete" when `attendance.complete` is true
and the supervisor survey is submitted are display groupings of
existing Odoo-supplied fields, not business rules. Change them freely
if product wants different wording.

## Clarifications (2026-09-25)

- **Dashboard ownership.** The role dashboards in this ADR are the
  trainee, supervisor and trainer operational dashboards. The General
  Supervisor / administrative dashboard and analytics are Odoo Back-office
  (UI Flow sections 1-3 and OD-10, PROJECT_SPEC 2.1); no equivalent is built
  in Next.js, and building one would be a Change Request.
- **Navigation authority.** This ADR supersedes UI Flow section 12 for
  the Next.js sidebar and adds the routes listed above. The trainee
  "Training Program" page displays already-supplied data and is not a BRD
  functional requirement.
- The two open items below are tracked as OPD-01 and OPD-02 in
  `docs/REQUIREMENTS_ALIGNMENT.md`.

## Explicitly not done

- **Trainee read-back of own submitted answers** remains open exactly
  as recorded in ADR-006 section 12: it needs a product decision and
  is not implemented here.
- **Help / Contact / Terms / Privacy** sidebar items are absent until
  their content and channels are approved.
- `dashboardApi.getDay()` exists in the API client but no page calls it
  yet; it is available for a future per-day view.

## Amendment: My Surveys retired

The trainee "My Surveys" item and `/trainee/surveys` page duplicated the survey
status and actions already on each Training Day card, so they were removed.
Survey access is via Training Days (`/trainee/days`, form at `/trainee/{dayId}`).
`/{locale}/trainee/surveys` redirects to `/{locale}/trainee/days`. Backend and
API are unchanged.
