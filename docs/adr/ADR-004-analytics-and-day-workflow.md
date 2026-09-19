# ADR-004: Analytics/KPI Calculation and Training-Day Workflow

- **Status:** Accepted
- **Date:** 2026-09-15
- **Milestone:** M3 (deterministic analytics, training-day workflow actions)
- **Related:** ADR-001, ADR-002, ADR-003

## Context

M3 adds deterministic KPI/attendance/response-rate calculation and
explicit training-day state control. This ADR records the exact
formulas, the null/no-data semantics, the day-state workflow, and the
technical design behind the Back-office analytics views.

## 1. Rating Scale (Language-Independent Mapping)

The approved descriptive scale:

| Label (ar/en) | Numeric value |
|---|---|
| ضعيف / Poor | 1 |
| مقبول / Acceptable | 2 |
| جيد / Good | 3 |
| جيد جداً / Very Good | 4 |
| ممتاز / Excellent | 5 |

Standard Odoo stores the displayed choice text in
`survey.question.answer.value`, which is `translate=True` — it changes
with the UI language and must never be used to derive a score.
**Addon-defined field added:** `survey.question.answer.rating_value`
(Integer, optional, constrained to 1-5 when set). This is the minimum
necessary metadata: one stable, language-independent integer per
suggested answer, set only on the answers that represent one of the
five scale points (a non-rating choice, e.g. "N/A", is left empty and
simply does not participate in KPI calculation). For `scale`-type
questions, no extra field is needed: `survey.user_input.line.value_scale`
is already a plain Integer with no translated text involved, so it is
used directly.

## 2. Response-Level KPI Calculation

`training.analytics.get_response_category_score(user_input, category)`:
mean of `_line_rating_value()` over the response's answer lines whose
`question_id.kpi_category == category`, excluding:
- lines where `skipped` is true,
- lines whose answer isn't a rating (any `answer_type` other than
  `suggestion`/`scale`, or a `suggestion` whose `suggested_answer_id`
  has no `rating_value` set).

If no valid answer remains, the result is `None` — never `0`. Questions
without a `kpi_category` never participate at all (they're excluded by
the category filter itself, not treated as invalid answers).

## 3 & 4. Course/Program KPI Aggregation

`training.analytics.get_kpi(program=, course=, day=, trainer=, date_from=, date_to=, categories=)`
resolves the matching `training.day` recordset, pulls **every** final
(`state='done'`) `survey.user_input` linked to those days in one query,
and computes `_aggregate_response_scores()`: the mean of each
response's own category score, one value per response, excluding
responses with no valid score for that category.

This is true for both course-level and program-level calls — the
program case does not average course-level numbers; it pools every
matching response across every course under the program directly, so
every valid response has **exactly equal weight** regardless of which
course or day it belongs to. `test_course_kpi_equal_weight_per_response_not_average_of_days`
and `test_program_kpi_pools_all_courses_equal_weight` construct scenarios
where average-of-averages would produce a different number than the
required pooled calculation, and assert the pooled (correct) number.

## 5. Attendance Metrics

`training.analytics.get_attendance_metrics(...)` over
`training.attendance` records for the resolved day scope:

```
attendance_rate = (present_count + late_count) / total_count * 100
absence_rate    = absent_count / total_count * 100
late_rate       = late_count / (present_count + late_count) * 100
```

Every ratio uses `_safe_ratio()`, which returns `None` (not `0`)
whenever its denominator is zero.

## 6. Trainee Survey Response Rate

`training.analytics.get_trainee_response_rate(...)`:

```
eligible = count(training.attendance where status in (present, late))
if eligible == 0: return None
submitted = count(survey.user_input where respondent_role='trainee' and state='done')
response_rate = submitted / eligible * 100
```

Absent trainees are excluded from the denominator by construction
(only `present`/`late` attendance rows are counted as eligible).
`None` when attendance hasn't been recorded for the scope at all
(`eligible == 0`), matching "pending/unavailable, not 0."

## 7. Aggregation Service Architecture

`training.analytics` (`models.AbstractModel`, no database table) is
the single place these formulas are implemented. All entry points
accept the same optional filter set (`program`, `course`, `day`,
`trainer` where applicable, `date_from`, `date_to`) via a shared
`_resolve_days()` helper, so a future dashboard, report, or
Operational API endpoint (M4+) calls the same methods rather than
re-deriving the math. Nothing here is exposed via HTTP in M3.

## 8. Historical Version Safety

Every method reads `survey.user_input.user_input_line_ids.question_id`
directly from the response record — never the training day's *current*
`trainee_survey_id`/`supervisor_survey_id`/`trainer_survey_id` pointer.
Because ADR-003's versioning lock already prevents mutating a used
survey's structure, and cloning creates an entirely new `survey.survey`
+ new `survey.question` records rather than rewriting the originals, a
historical response's score is structurally pinned to the exact
questions it was actually answered against, even after the training
day is reassigned to a newer survey version for future use.
`test_historical_response_uses_version_linked_at_submission` clones a
survey, changes the **new** version's question mapping, reassigns the
day to the new version, and asserts the old response's score is
unchanged.

## Odoo Back-office Analytics: Design Decision (Explained First)

**Verified Odoo 19 fact:** `fields.Float`'s `falsy_value` is `0.0`, not
SQL `NULL` (`odoo/orm/fields_numeric.py`). A computed Float field
representing "average category score" would therefore store/return
`0.0` for "no valid answers," and any standard Pivot/Graph average
over it would silently count that as a real zero — directly
contradicting "do not treat missing answers as zero." This ruled out
the simplest approach (a computed field on `survey.user_input` used
directly as a Pivot measure).

**Solution implemented:** `training.survey.response.kpi`, a read-only
SQL-view-backed model (`_auto = False` with a `_table_query` property
returning `odoo.tools.SQL`, the modern Odoo 19 idiom — see the ADR-002
addendum) that emits **one row per (response, kpi_category) that
actually has at least one valid mapped answer**. A category with no
valid answer for a given response simply produces no row — there is no
zero to average. The `score` field's `aggregator="avg"` then makes the
standard Pivot/Graph/List "Average Score" measure correct by
construction. This is the standard Odoo reporting idiom used by core
`account.invoice.report`/`sale.report`, not a custom OWL dashboard.
The view's SQL mirrors the same math as
`training.analytics.get_response_category_score()` for reporting
purposes only; the Python service remains the source of truth for
everything else, and any future formula change must be applied to
both (documented as a known duplication trade-off, since a decomposed
per-category reporting row is what makes a "safe" standard Pivot
measure possible at all).

Attendance counts (`training.attendance` grouped by `status`) needed no
such workaround: a plain count grouped by a stored Selection field
never confuses "no data" with a real value, so the existing model gained
a Pivot/Graph view directly, plus stored `course_id`/`program_id`
related fields (safe — plain foreign keys, not derived metrics) for
convenient grouping. Attendance/absence/late **rates** are not exposed
as Back-office view measures in M3 for the same null-safety reason;
they remain a `training.analytics` service output for now (consumed
by M4+ dashboards/reports/API).

Security: `training.survey.response.kpi` grants `perm_read` only to
`group_training_admin`/`group_training_assistant_admin`; Trainee/
Supervisor/Trainer have no ACL row at all (matching PROJECT_SPEC's
"General Supervisor works primarily in Odoo Web Client... Trainee/
Supervisor/Trainer use Next.js" and the requirement to never expose
individual trainee survey detail — this view is admin-only regardless
of whether any single row could be traced back to an individual, since
it is not part of those roles' intended interface at all).

## Explicit Training-Day Workflow

`training.day` gains five actions: `action_open`, `action_close`,
`action_reopen`, `action_postpone`, `action_cancel`. Legal transitions
are centralized in `write()` via `_ALLOWED_STATE_TRANSITIONS`, so
**no path** — an action button, a direct statusbar click, or a plain
`write({'state': ...})` from any other code — can bypass validation
(verified during implementation: an earlier version only validated
inside the action methods, and a direct `write()` silently succeeded;
`test_direct_write_bypassing_action_methods_still_validated` now
guards against regressing this):

```
planned   -> open, postponed, cancelled
open      -> closed, postponed, cancelled
postponed -> open, cancelled
closed    -> open                (via action_reopen only)
cancelled -> (terminal)
```

`action_open` and `action_reopen` both target `state='open'`, so the
generic transition matrix alone cannot tell them apart; each method
additionally checks its own required source state (`action_open`
requires `planned`/`postponed`; `action_reopen` requires `closed`) so
a closed day can only be reopened through the dedicated Reopen action,
matching the distinct UI buttons (each button is also independently
`invisible` based on state in the form view).

**No automatic time-based transition exists.** `state` only changes
via one of these actions (or an equivalent direct `write()`, still
validated); `survey_open_at`/`survey_close_at` remain an entirely
independent check inside `check_survey_access()` (added in M2,
unchanged here). **Both** conditions are required to submit a survey:
`state == 'open'` **and** the current time is within the configured
window. A day left in `planned` state never accepts submissions no
matter what its survey window says (`test_no_automatic_state_transition_from_time_window`).

**Reopen and audit:** PROJECT_SPEC section 17 lists "exceptional
reopen/close of a training day" as an event that should be audited.
`action_reopen()` is implemented (closed → open is a real, spec
-authorized transition), but **no audit trail is attached to it in
M3** — `training.audit.log` does not exist yet in this codebase. This
is a known, deliberate gap, not an oversight: building the audit model
was not in this milestone's scope. It should be added before this
action is relied on in a production workflow; see "Unresolved items
for M4" in the M3 report for the explicit flag.

## No New i18n-Breaking Assumptions

All new user-facing strings (KPI category labels, workflow action
labels/errors, the reporting view's field labels and menu name) go
through Odoo's standard translation mechanism exactly like M1/M2's;
`training_management.pot`/`ar.po` were regenerated and the new entries
verified loaded into a real database and read back from PostgreSQL,
consistent with the process established in M1/M2.
