# ADR-008: training.report — Generation, Versioning, Approval and Export

- **Status:** Accepted
- **Date:** 2026-09-16
- **Milestone:** M8 (Reports, Approval and Exports, per `DEVELOPMENT_PLAN_v1.1_BILINGUAL.md`)
- **Related:** ADR-001, ADR-003, ADR-004

## Context

Before any M8 work started, the repository was checked (per the same
"identify exact scope, check what already exists" discipline ADR-007
used for M6) against `DEVELOPMENT_PLAN_v1.1_BILINGUAL.md`'s M8 section
and `PROJECT_SPEC_v1.1_BILINGUAL.md` sections 5/8/15. No
`training.report` model, no `report/` directory, no reporting
controllers, and no report-related views existed anywhere in
`custom_addons/training_management/` — M7 (per `README.md` and
ADR-007's own note) stopped at the trainer flow and explicitly left
"M8 onward" untouched. M8 is therefore new work end to end, not a
continuation of a partially-started feature.

M8's literal scope: `training.report` (course/final program reports),
generation, filters/show-hide sections, versioning, a QWeb Arabic RTL
PDF, a visual approval stamp, approval metadata, `ir.attachment`
storage, an Excel export "if required beyond standard Odoo export",
and authorized read/download endpoints "only if end users need them".
Per PROJECT_SPEC section 2.1/2.2, report generation/approval/export is
exclusively a General Supervisor/Admin, Odoo Back-office concern — no
Next.js screen or Operational API endpoint was added or is needed:
the M8 exit criterion ("General Supervisor generates, reviews,
approves and downloads a stable report entirely from Odoo") is fully
satisfiable from the Back-office form view alone.

## 1. Reusing training.analytics, Not Re-deriving KPIs

`training.report.action_generate()` calls exactly the same
`training.analytics.get_kpi()` / `get_attendance_metrics()` /
`get_trainee_response_rate()` methods M3 already built (ADR-004) —
one call per report, with either `course=` or `program=` as the scope
argument (never both, so a course report is not additionally narrowed
by its own program). No formula is copied or re-implemented in
`training_report.py`; this is the DEVELOPMENT_PLAN M8 test list's
"KPI/report number parity" requirement satisfied by construction
rather than by a separate reconciliation check —
`test_generate_kpi_matches_analytics_service` in
`tests/test_training_report.py` asserts the stored snapshot equals a
direct `training.analytics` call with the identical scope.

## 2. Snapshot, Not Live-Computed — and the Null-vs-Zero Rule Extended

A report's KPI numbers are computed **once**, at `action_generate()`
time, and stored (never recomputed on read). This is required for two
reasons: an approved report must show the exact numbers that were
true and reviewed at approval time regardless of later data changes,
and PDF rendering needs concrete values to lay out rather than calling
back into `training.analytics` from inside a QWeb template.

ADR-004 already established that a plain `Float` field cannot
represent "no valid data" (Odoo's `Float.falsy_value` is `0.0`, not
SQL `NULL`) without silently colliding with a real zero score. That
problem does not go away just because this is a one-shot snapshot
instead of a live Pivot measure — a stored `0.0` on an approved report
would be indistinguishable from "the trainer really scored zero" to
anyone reading the PDF or the Excel export later. Every KPI/rate field
on `training.report` therefore has a companion `*_has_data` `Boolean`
(`kpi_trainer_score_has_data`, `attendance_rate_has_data`,
`response_rate_has_data`, etc.), and every place that renders a value
— the QWeb template, the Excel export, the form view (`invisible="not
X_has_data"`) — reads the companion flag rather than trusting a bare
`0.0`. `_kpi_summary_rows()` is the single method both the PDF template
and the Excel export call to build `[(label, value_or_None, show)]`,
so the two output formats cannot drift into disagreeing about which
value means "no data" versus a real number.
`test_no_valid_data_is_none_not_zero` covers this directly for a course
with no attendance/survey activity at all.

## 3. Versioning: Locking by Write-Guard, Not by Copying Odoo's Own Pattern Verbatim

PROJECT_SPEC section 15 ("Approved report version is immutable...
Re-generation after changes creates a new version") is implemented as
two related but distinct locks in `training.report.write()`:

- Once `state == 'approved'`, **no** field may be written except the
  two system-managed attachment pointers (`pdf_attachment_id`,
  `excel_attachment_id` — see section 5 below for why those two are
  exempt). This is the actual immutability guarantee.
- Once `state == 'generated'` (but not yet approved), only the fields
  that define the report's *scope* (`report_type`, `program_id`,
  `course_id`, `date_from`, `date_to`, and the five `show_*` filter
  booleans — `FILTER_FIELDS` in `models/training_report.py`) are
  locked. Re-running `action_generate()` on an already-generated,
  not-yet-approved report to refresh its numbers (no scope change) is
  explicitly allowed — only changing what the report covers requires
  `action_new_version()`, which is DEVELOPMENT_PLAN M8's literal "new
  changes create new version" test.

This mirrors `survey.survey`'s `STRUCTURAL_SURVEY_FIELDS` write-guard
pattern (ADR-003) rather than inventing a new mechanism, but is not
identical to it: survey's lock is permanent once any response exists,
with no "regenerate in place" allowance, because a survey's structure
directly determines what historical answers *mean*. A report's KPI
snapshot, by contrast, is expected to be refreshed before approval as
underlying attendance/survey data continues to arrive — hence the two
-tier lock instead of survey's single one.

`action_new_version()` creates an entirely new `training.report`
record via `copy()` (not `write()`), with `version_no + 1` and
`previous_report_id` pointing at the source. The source record is
never touched — `test_new_version_creates_independent_draft` asserts
the original stays at its own state/version after cloning, matching
`survey.action_clone_as_new_version()`'s same guarantee for historical
survey versions (ADR-003).

## 4. Approval Requires the Admin Group, Enforced in Python — Verified Superuser Pitfall

PROJECT_SPEC section 7.2: "Assistant Admin... does not, by default,
approve final reports." Assistant Admin has full ACL
read/write/create on `training.report` (matching the same delegated
-administration pattern already used for `training.program`/`course`/
`day`/`enrollment`/`attendance`), so this could not be enforced by ACL
alone — `action_approve()` explicitly checks
`self.env.user.has_group('training_management.group_training_admin')`
and raises `AccessError` otherwise, before doing anything else.

**Verified pitfall during test-writing, worth recording explicitly:**
`odoo.tests.common.TransactionCase`'s default `self.env` runs as the
superuser (`env.su == True`). Two consequences, both real and both
caught by the first test run rather than assumed:

1. `has_group()` checks actual `res.groups` membership in the
   database and gives the superuser **no** automatic pass — the
   superuser test user is not a member of
   `training_management.group_training_admin` unless explicitly added,
   so a bare (non-`with_user(...)`) call to `action_approve()` in a
   test raises `AccessError` regardless of report state, which
   initially masked a completely different bug (see next point) behind
   a coincidentally-matching exception type (`AccessError` is a
   subclass of `UserError` in `odoo/exceptions.py`, so a too-broad
   `assertRaises(UserError)` did not catch the mismatch).
2. `write()`'s `if not self.env.su:` guard — deliberately modeled on
   `survey.user_input`'s own `env.su`-gated done-lock (ADR-003) so an
   explicit, audited `sudo()` correction path could exist later — is
   **completely bypassed** by the superuser test environment, because
   `self.env.su` is already `True` there with no `sudo()` call
   involved at all. A first version of
   `test_generated_report_filters_locked_without_new_version` called
   `report.write(...)` on the bare `self.env` and failed with
   "UserError not raised" for exactly this reason.

Both are fixed the same way `test_survey_user_input.py` already
handles the identical situation for `survey.user_input`'s own
`env.su`-gated lock: every assertion that needs `action_approve()` to
succeed, or needs a write-lock to actually fire, uses an explicit,
real, non-superuser test user via `.with_user(...)` —
`cls.admin_group_user` (a member of `group_training_admin`) for
successful approvals and for proving the lock holds even for a user
with full ACL write access, and `cls.assistant_admin_user` for the
negative "who cannot approve" case. This is not a new convention
invented for M8; it is the same one already established in M2's test
suite, just not yet needed by any earlier milestone's tests before
this one added the first Python-level (non-ACL) permission check on a
write path.

## 5. PDF Rendering: web.html_container Already Solves RTL, Confirmed Against Source

`report/training_report_reports.xml` defines
`training_management.report_training_report` as a thin
`<t t-call="web.html_container">` wrapper around
`training_management.report_training_report_document`, which itself
`t-call`s `web.external_layout` — the same standard composition every
Odoo PDF report uses, verified directly against
`.odoo-core/addons/web/views/report_templates.xml`: `web.html_container`
calls `web.report_layout`, whose `<body>` sets
`t-att-dir="env['res.lang']._get_data(code=lang or env.user.lang).direction or 'ltr'"`,
and `lang` is populated automatically for every QWeb render call from
`self.env.context.get('lang')` (verified in
`.odoo-core/odoo/addons/base/models/ir_qweb.py`). **No custom RTL CSS,
no manual `dir` attribute, and no per-language template branch was
added** — rendering `training.report`'s PDF with an Arabic language
context produces `dir="rtl"` purely because the existing Odoo report
layout already does this for every report in the system, custom or
standard. `test_pdf_renders_rtl_in_arabic` /
`test_pdf_renders_ltr_in_english` in `tests/test_training_report.py`
assert this directly by calling `_render_qweb_html` with
`lang="ar_001"` / `lang="en_US"` and checking for the literal `dir=`
attribute in the returned HTML (after first calling
`self.env['res.lang']._activate_lang('ar_001')`, since — per the same
already-documented ADR-005 operational prerequisite — `ar_001` is not
guaranteed active in a fresh test database, and `_get_data()` returns
a falsy "dummy" `LangData` — direction `False`, coerced to `'ltr'` by
the template's own `or 'ltr'` — for a language that is not active).

The visual approval stamp is a plain conditional block in the
document template (`t-if="doc.state == 'approved'"`), showing
"Approved", the approver's name, and the approval date/time — no
image asset, no Odoo Sign dependency (unavailable in this Community
environment per ADR-001, and PROJECT_SPEC's own documented fallback
for the non-Sign path). `ir.actions.report.attachment` is deliberately
left unset on `action_report_training_report`: `training.report`
manages its own single canonical `pdf_attachment_id` explicitly
(`_render_report_pdf()`, called from both `action_generate()` and
`action_approve()`, deleting the previous attachment before creating
the new one) rather than also letting Odoo's own automatic
print-time-attachment mechanism create a second, parallel copy on
every print.

**Verified test-environment behavior, not assumed:** `wkhtmltopdf` is
not installed on this development machine. This does not block
testing `action_generate()`/`action_approve()` at all —
`ir.actions.report._pre_render_qweb_pdf()` (verified in
`odoo/addons/base/models/ir_actions_report.py`) unconditionally falls
back to `_render_qweb_html()` whenever
`modules.module.current_test or tools.config['test_enable']` is true
and `force_report_rendering` is not set in context, which is exactly
Odoo's own test-runner state. `pdf_attachment_id` therefore stores
HTML bytes with an `application/pdf` mimetype during automated tests
— cosmetically inconsistent but functionally irrelevant to every
assertion in `tests/test_training_report.py` (none inspect the
attachment's byte content, only its existence/mimetype field/model
linkage). A production deployment with `wkhtmltopdf` actually
installed renders a real PDF through the identical code path; nothing
in `_render_report_pdf()` is test-only or conditionally branched.

## 6. Excel Export: Lightweight, Not a New Dependency

PROJECT_SPEC section 15: "Excel export: lightweight custom export
service if standard export cannot satisfy the required format."
Standard Odoo list-view export dumps raw field values of selected
records; it cannot produce a formatted KPI summary (labeled rows,
"No data" placeholders, a present/late/absent breakdown) from a single
`training.report` record, so a real gap exists and
`action_export_excel()` fills it directly with `xlsxwriter` (already
present in the project's Python virtualenv — verified with `python -c
"import xlsxwriter"` before writing any code — no new dependency was
added to `requirements`/the manifest). It reuses the same
`_kpi_summary_rows()` the PDF template calls (section 2 above) so the
two outputs cannot disagree, requires the report to be at least
`generated` (draft has no snapshot yet — `state == 'draft'` raises
`UserError`), and remains usable after approval (exporting an
approved report's own already-stored numbers does not mutate anything
approved — this is why `pdf_attachment_id`/`excel_attachment_id` are
the two fields exempted from the approved-immutability write-lock in
section 3/4 above). The resulting `ir.attachment` is returned to the
Back-office user via a plain `ir.actions.act_url` to
`/web/content/<id>?download=true` — no new controller route, no
change to the Operational API surface.

## 7. Unauthorized Attachment Access — Denied by the Same ACL Gap Already Used Elsewhere

`training.report` intentionally has **zero** ACL rows for
`group_training_trainee`/`supervisor`/`trainer` in
`ir.model.access.csv` — the same "no ACL row at all" pattern ADR-003
already established for `training.attendance` (trainee/trainer) and
now applied to the entire report model for all three operational
roles, since none of them has any product requirement to see reports
at all (PROJECT_SPEC section 2.2's explicit forbidden-endpoint list;
report approval/administration is Back-office only).

This is also what satisfies DEVELOPMENT_PLAN M8's "Unauthorized
attachment access denied" test without any bespoke attachment
-security code: Odoo's own `ir.attachment` access model defers to the
linked record's own access (`res_model`/`res_id`) when the attachment
carries no explicit `public`/`group_ids` override, which neither
`_render_report_pdf()` nor `action_export_excel()` sets. A
trainee/supervisor/trainer with no ACL row on `training.report` at
all is denied at the model level first, and that denial propagates
transitively to the PDF/Excel attachment linked to it —
`test_trainee_cannot_access_report_model` and
`test_trainee_cannot_access_report_attachment` in
`tests/test_training_report.py` assert both halves of this directly.
No Operational API endpoint for reading or downloading a report was
added (PROJECT_SPEC section 10.6: "Expose read/download endpoints only
if an end-user use case requires them" — none does here; the General
Supervisor/Admin already has full access from the Odoo Back-office
form view, which is the M8 exit criterion's literal wording).

## Test Results

189 backend tests (165 existing + 24 new in
`tests/test_training_report.py`), 0 failed, 0 errors, run against a
real Odoo 19 instance/PostgreSQL database
(`scripts/run_schema_smoke_test.sh`'s pattern, on a disposable
database/port to avoid the developer's already-running Odoo instance
on 8069, per the same precaution ADR-007 already documented).
`flake8` clean. Frontend: unchanged by this milestone (no Next.js
screen or Operational API endpoint was added — see "Context" above);
74 existing frontend tests still pass, `npm run lint` and `npm run
build` both clean, run as part of this milestone's verification since
M8 touches shared backend infrastructure even though it adds no
frontend code. `i18n`: `training_management.pot` regenerated (230
terms, up from 152) and `ar.po` extended with all 78 newly
-introduced terms, verified by actually loading `ar_001` and importing
the updated `.po` into a real database via `odoo-bin i18n
loadlang`/`import`, then reading translated `ir.model.fields`
`field_description` values back from PostgreSQL directly (e.g.
`excel_attachment_id` → "تصدير إكسل", `resolved_date_from` → "تاريخ
البداية الفعلي") — not just checked for `.po` syntax, matching the
verification bar every prior milestone's i18n work has used.
