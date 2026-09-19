# ADR-003: Survey Response Lifecycle (Odoo Standard Survey Integration)

- **Status:** Accepted
- **Date:** 2026-09-15
- **Milestone:** M2 (Odoo Survey standard model integration)
- **Related:** ADR-001-odoo19-runtime-baseline.md, ADR-002-odoo19-implementation-conventions.md

## Context

PROJECT_SPEC requires the project to reuse Odoo's standard Survey
engine (`survey.survey`, `survey.question`, `survey.user_input`,
`survey.user_input.line`) for all three daily evaluation types
(trainee, supervisor, trainer), extended by inheritance, with no
parallel survey/answer engine. This ADR records the exact response
lifecycle, versioning, ownership, and locking design implemented for
this in milestone M2, and the verified Odoo 19 runtime facts that
shaped it.

## Standard Odoo State Mapping

`survey.user_input.state` remains exactly the Odoo 19 standard
selection: `new` / `in_progress` / `done` (verified against
`addons/survey/models/survey_user_input.py`; unchanged since it was
first verified in M0). No custom "submitted" state is added anywhere.

| Business concept | Odoo mechanism |
|---|---|
| Not started | `state = 'new'` (or no `survey.user_input` row exists yet) |
| Draft / in progress (including trainer's saved draft) | `state = 'in_progress'`, with zero or more `survey.user_input.line` rows already saved |
| Business "Submitted" / final | `state = 'done'` |

**Trainer draft behavior (point 9 of the M2 brief) resolved exactly as
the standard workflow allows:** no custom draft state or draft field
was introduced. A trainer's "save draft" action is simply a `write`
that moves (or keeps) the response at `state = 'in_progress'` while
`survey.user_input.line` rows are created/updated normally; "final
submit" is the `write` that moves it to `state = 'done'`. This applies
uniformly to trainee, supervisor, and trainer responses — the standard
workflow needed no per-role variation.

## Response Ownership Model

Two addon-defined fields on `survey.user_input` carry the ownership
context PROJECT_SPEC section 6 asks for:

- `training_day_id` (`Many2one` to `training.day`)
- `respondent_role` (`Selection`: `trainee` / `supervisor` / `trainer`)

Both are optional at the field level (this extension applies to every
`survey.user_input` row in the database, including ones unrelated to
this project) but are always set together by the get-or-create service
described below.

## Duplicate-Final-Response Rule

A single SQL `models.Constraint` on `survey.user_input` enforces
uniqueness at the database level, not just in application code:

```python
_training_day_role_partner_uniq = models.Constraint(
    "unique(training_day_id, respondent_role, partner_id)",
    "Only one response is allowed per training day, role and respondent.",
)
```

This is stronger than "at most one final response": at most one
`survey.user_input` row (in any state) can ever exist per (training
day, role, respondent) triple. There is no way to have two parallel
attempts that could both eventually reach `done`. PostgreSQL treats
`NULL` as distinct for uniqueness purposes, so `survey.user_input` rows
unrelated to training (all three project fields left empty) never
collide with each other or with project rows.

This single constraint naturally satisfies all three role-specific
rules from the M2 brief:
- **Trainee:** at most one row per (day, `trainee`, that trainee's partner).
- **Supervisor:** at most one row per (day, `supervisor`, the assigned
  supervisor's partner) — there is only one supervisor per day
  (decided in M1), so this is already effectively "one final
  supervisor evaluation per day."
- **Trainer:** at most one row per (day, `trainer`, *that* trainer's
  partner) — since `partner_id` differs per trainer, **multiple
  trainers on the same day automatically get independent rows**
  without any special-casing.

Callers must never call `survey.user_input.create()` directly for a
training-day response; they use the get-or-create service below, which
enforces this by construction rather than by catching the database
error after the fact.

## Survey Availability Service

`training.day.check_survey_access(role, user=None)` (no HTTP controller
— that is explicitly M4's job) is the single reusable rule-check used
everywhere availability needs to be determined. It re-fetches the day
via `self.with_user(user)`, so it automatically composes with the M1
record rules (an unassigned trainer/supervisor, or an unenrolled
trainee, is denied by the existing `training.day` rules before this
method's own checks even run), then additionally verifies, in order:

1. A survey is configured for that role on this training day.
2. Role-specific assignment: trainee is enrolled in the day's program;
   supervisor/trainer matches `supervisor_id`/`trainer_ids`.
3. `training.day.state == 'open'` (a day in `planned`, `closed`,
   `postponed`, or `cancelled` never accepts submissions in M2 — see
   "Known Simplification" below).
4. `survey_open_at <= now <= survey_close_at`.
5. No existing **final** (`state='done'`) response already exists for
   this (day, role, respondent).

`training.day.get_or_create_survey_response(role, user=None)` calls
`check_survey_access` first, then either returns the existing
`survey.user_input` row for that (day, role, respondent) or creates one
via the standard `survey.survey._create_answer()` service method
(reusing Odoo's own partner/email/state defaulting rather than a raw
`create()` call), passing `training_day_id`/`respondent_role` through
its `**additional_vals`.

### Known simplification

PROJECT_SPEC/SRS describe a `planned` day as "not accepting surveys
unless opened manually **or the window time arrives**," which implies
a day could auto-transition or be treated as available purely by time
even while nominally `planned`. M2 does not implement that: it requires
the day's `state` to be the literal `'open'` value, full stop, with the
time window checked *in addition*. Automating day-state transitions
(including any auto-open-at-window-time behavior) is explicitly a
`training.day` **workflow actions** concern, assigned to M3 in
DEVELOPMENT_PLAN. This is a deliberate scope simplification, not a
bug — revisit this method if M3's workflow actions change what `state`
values should be treated as "available."

## End-User Locking (Historical Locking)

Once `survey.user_input.state == 'done'`, no non-`sudo()` code path may
modify it further:

- `survey.user_input.write()` is overridden: any write to a record
  whose *current* (pre-write) state is already `'done'` raises
  `UserError`, for any caller that isn't running as `self.env.su`. The
  transition *into* `done` itself is unaffected (the record's state is
  not yet `'done'` at the moment that specific write executes).
- `survey.user_input.unlink()` is likewise blocked once `state == 'done'`.
- `survey.user_input.line.create()`, `.write()`, and `.unlink()` are
  all similarly blocked once the parent `user_input_id.state == 'done'`
  — this closes the gap that locking only the parent record would
  leave open (a done response's individual answers could otherwise
  still be added/edited/deleted directly on the child model).

No administrative correction workflow exists in M2. `self.env.su` is
the only bypass, and nothing in this module currently uses it for that
purpose — a future audited "administrative correction" workflow (out
of scope until explicitly requested, per the M2 brief) would be the
only sanctioned way to alter a final response, and it would need its
own explicit audit trail, not silent `sudo()` writes.

## Survey Versioning

`survey.survey` gains `version_no`, `previous_version_id`,
`effective_from`, and a non-stored computed `has_submitted_responses`
(true once any linked `survey.user_input` reaches `state='done'`).

- **Structural lock:** once `has_submitted_responses` is true, writes
  to `question_and_page_ids`, `survey_role`, `training_program_id`, or
  `training_course_id` on that survey raise `UserError`, as does
  `unlink()`. Cosmetic fields (`title`, `description`) remain editable
  — PROJECT_SPEC says "do not mutate historical **structure**," not
  "freeze the whole record."
- **Question-level lock:** because Odoo adds a question via
  `survey.question.create()` (setting `survey_id` on the child), not
  via `survey.survey.write({'question_and_page_ids': ...})`, the
  survey-level write-lock alone does **not** see new-question creation.
  `survey.question.create()` is therefore separately blocked when the
  target survey already has submitted responses, and
  `kpi_category`/`question_type` writes plus `unlink()` are blocked
  per-question once *its* survey has submitted responses. (This gap
  was caught by `test_used_survey_structure_cannot_be_mutated` failing
  during implementation — see "Verified Behavior" below.)
- **Cloning:** `survey.action_clone_as_new_version()` calls the
  standard `copy()` (which already deep-copies
  `question_and_page_ids` because that field is declared `copy=True`
  in Odoo core), overriding `version_no` (`+1` from the source),
  `previous_version_id` (the source), and `effective_from` (now). This
  is exposed as a "Clone as New Version" button on the survey form,
  visible only once the survey `has_submitted_responses`.
- Historical `survey.user_input`/`survey.user_input.line` rows are
  never rewritten by cloning or by future edits to the new version;
  they keep pointing at the original `survey_id`/`question_id` records,
  which are now immutable for exactly the fields that would change
  their meaning.

## Role Isolation / Security

`base.group_user` (the ordinary internal-user group) has **zero**
default access to `survey.survey`, `survey.question`,
`survey.question.answer`, `survey.user_input`, or
`survey.user_input.line` on Odoo 19 — verified directly from
`addons/survey/security/ir.model.access.csv`: every row for
`base.group_user` on these models has all four permissions set to 0;
real access is granted only to the standard `group_survey_user`/
`group_survey_manager` groups. Those standard groups' own record rules
(`addons/survey/security/survey_security.xml`) grant **unrestricted**
access to every survey/response in the database (gated only by the
optional `restrict_user_ids` field) — implying `group_survey_user` for
Trainee/Supervisor/Trainer would have defeated the privacy isolation
this project requires, so it was deliberately **not** done.

Instead, `training_management` grants its own narrow ACL rows (read
-only on `survey.survey`/`survey.question`/`survey.question.answer`;
read+write+create, no unlink, on `survey.user_input`/`.line`) to
`group_training_trainee`/`supervisor`/`trainer`, paired with new
record rules:

- **Template-level** (`survey.survey`/`question`/`question.answer`):
  scoped only by `survey_role` matching the user's own role — not by
  program/course ownership. This is a deliberate simplification: the
  sensitive data is in the *responses*, not the question text, so
  letting a trainee read an unrelated program's trainee-survey
  questionnaire structure is not a meaningful privacy exposure, and
  avoids a materially more complex domain expression for no real
  security benefit.
- **Response-level** (`survey.user_input`/`.line`): this is where the
  real isolation boundary is. Each rule requires both
  `respondent_role` to match the group's role *and* `partner_id`
  (or, for supervisor/trainer, the training day assignment) to match
  the requesting user — so a trainer assigned to a day with a
  co-trainer cannot read the co-trainer's response, a supervisor never
  sees `respondent_role='trainee'` rows at all, and a trainee never
  sees another trainee's row. `group_training_admin` gets full standard
  Survey administration via `implied_ids` on `survey.group_survey_manager`
  (matching PROJECT_SPEC's "Admin manages Survey templates/questions/
  versioning via standard Survey Back-office"); `group_training_assistant_admin`
  intentionally gets no survey access in M2 (not requested, kept minimal).

M1's existing security (groups, ACLs, record rules on
`training.program`/`course`/`day`/`enrollment`/`attendance`) is
unchanged.

## Verified Behavior During Implementation

While writing the M2 test suite, `test_used_survey_structure_cannot_be_mutated`
initially failed ("UserError not raised") because adding a question via
`survey.question.create({'survey_id': ...})` does not trigger
`survey.survey.write()` at all — it is a create on the child model, not
a write on the parent's `question_and_page_ids` field. This was not a
documentation assumption that turned out wrong (like the `res.partner.mobile`
finding in ADR-001); it was a genuine gap in the first version of this
module's own locking logic, caught by the test suite and fixed by
adding the `survey.question.create()` guard described above before
this ADR was written. No other Odoo 19 runtime behavior in this area
diverged from what was expected.
