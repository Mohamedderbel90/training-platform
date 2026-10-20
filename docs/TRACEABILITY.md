# Traceability and Coverage Matrix

- **Date:** 2026-10-03
- **Purpose:** one chain from each business requirement (BRD) to its SRS,
  ERD, API, UI Flow, implementation and test evidence. Business decisions are
  in `docs/DECISIONS.md`; open items in `docs/DECISIONS.md` section 4;
  document authority in `docs/REQUIREMENTS_ALIGNMENT.md`.
- **Implementation status** is taken from the ADRs and the tests named below;
  it is not a substitute for the QA pass.
- Cite NFR ids as "BRD NFR-xxx" / "SRS NFR-xxx" (DEC-37).

## 1. Requirement chain (BRD -> SRS -> ERD -> API -> UI -> implementation)

| BRD | SRS | ERD | API Contract | UI Flow | Implementation | Decision |
|---|---|---|---|---|---|---|
| FR-001/002 login, roles | AUTH-001 | 9, 10 | 3 | NX-01 | Covered (ADR-005) | |
| FR-003 manage users | AUTH-002 | 9 | 5 (Odoo) | Odoo standard Users/Groups | Odoo standard | DEC-34 |
| FR-004 password reset | AUTH-003 | | 3 | NX-02 | Covered (ADR-010) | DEC-27 |
| FR-005 last login, status | AUTH-002 | `res.users` standard | | | Odoo standard `login_date`; audit via ADR-010 | |
| FR-010/011/016 program, courses, multi-program | PROG-001/002 | 6 | 6 (Odoo) | OD-01/02 | Covered | DEC-31 |
| FR-012/013/017/018 days, trainers, window | PROG-003 | `training.day` | 6 (Odoo) | OD-03 | Covered (ADR-004) | DEC-01/02/08 |
| FR-014/015 enrollment | PROG-004 | `training.enrollment` | 7 (Odoo) | OD-04 | Covered (standard Odoo; custom import removed 2026-10-08) | DEC-07 |
| FR-020..029A trainee survey | SURVEY-001..003, TRN-001..003 | 7 | 8 | NX-03..05, OD-05..07 | Covered; read-back added | DEC-10/12 |
| FR-026, BR-008, D-01, D-14 privacy | TRN-003, SEC-007 | 10 | 4, 15 | OD-07 | Covered and tightened (DEC-13/14) | DEC-13/14 |
| FR-030..035 attendance, supervisor evaluation | SUP-001/002 | `training.attendance` | 9 | NX-06..08, OD-08 | Covered; edit lock and explicit status | DEC-04/05/06 |
| FR-040..044 trainer report | INS-001 | 17 | 10 | NX-09/10 | Covered | DEC-33 |
| FR-050..056 dashboards, KPIs | DASH-001/002 | 17 | 11 | OD-10, role dashboards | Covered (standard views; comparison/trend in reports) | DEC-16..22, 24 |
| FR-060..064 course/program report | RPT-001/002 | `training.report` | 12 (Odoo) | OD-09 | Covered (narrative sections added 2026-10-03) | DEC-23 |
| FR-065/066 PDF, Excel | RPT-003 | 11 | 12 | OD-09 | Covered | DEC-15 |
| FR-067, FR-080..083, BR-005 approval | APR-001 | C-010 | 12 | OD-09 | Covered | DEC-25 |
| FR-070..073 reminders, channels | NTF-001 | 12 | 13 (Odoo) | OD-11 | Covered; policy is configuration | DEC-26/27 |
| BR-003 response-rate target | 6.7 | | | | Covered | DEC-17 |
| BR-004 admin exception | 5.3, 6.11 | | 14 | OD-07 (button "Correct Final Response") | Covered (reason mandatory, before/after audited, Odoo wizard) | DEC-11 |
| BR-006 absence from attendance record | 6.7 | | | | Covered | DEC-05 |
| BR-009 / D-17 survey versioning | SURVEY-002 | 7 | | OD-05 | Covered (ADR-003) | |
| NFR-006 audit | 6.11 | `training.audit.log` | 14 | OD-12 | Covered (ADR-010) | |
| FR-021..024 trainee survey content | SURVEY-003 | 7 | 8 | NX-04 | Covered: approved wording seeded (`docs/SURVEY_QUESTIONS.md`) | DEC-43 |
| FR-033/034, FR-041..043 supervisor and trainer content | SURVEY-003, SUP-002, INS-001 | 7 | 9, 10 | NX-08, NX-10 | Covered: approved wording seeded | DEC-43 |
| NFR-004 privacy, D-11 retention | 10 | 14 | | NX-11 (profile); Help/Terms/Privacy pages | Covered: privacy notice active; anonymisation action | DEC-44, DEC-45, DEC-50, DEC-51 |
| FR-072 reminder timing and templates | NTF-001 | 12 | 13 (Odoo) | Odoo: Settings > Settings (native Settings page) | Covered 2026-10-04: GS settings incl. lead time; templates in mail.template | DEC-26 |
| FR-073 notification status | NTF-001 | 12 | | OD-11 | Covered: SMS/WhatsApp `sent` only after real delivery | DEC-26 |
| FR-050..056 GS dashboard | DASH-001 | 17 | 11 (Odoo) | OD-10 | Covered 2026-10-04: Overview (indicators, filters, comparison, trend, drill-down) + Score Analysis | DEC-55 |
| BRD 6 audit log (GS only) | 6.11 | | 14 | OD-12 | Covered 2026-10-04 | DEC-52 |
| BR-009 / D-17 option lock | SURVEY-002 | 7 | | OD-05 | Covered 2026-10-04 | DEC-53 |
| BR-001 / BR-011 survey window | TRN-002 | 7 | 8 | NX-04 | Covered 2026-10-04: public survey routes blocked | DEC-54 |
| FR-012/013 day lifecycle, assignments | PROG-003, 5.2 | `training.day` | 6 (Odoo) | OD-03 | Covered 2026-10-04: reason and new date to postpone, validated assignments | DEC-56, DEC-57 |
| FR-031 attendance history | SUP-001 | `training.attendance` | 9 | OD-08 | Covered: no default status, no deletion of closed-day history | DEC-05, DEC-58 |
| BR-003 response rate | 6.7 | | | | Covered 2026-10-04: targets only, max 100% | DEC-17 |
| FR-072 reminder count and order | NTF-001 | 12 | 13 (Odoo) | Odoo: Settings > Settings | Covered 2026-10-04 | DEC-26 |
| FR-010 program states | 5.1 | `training.program` | | OD-01 | Covered 2026-10-04: enforced transitions | DEC-61 |
| AI-001..005 | | | | | Not built (Phase 3) | DEC-36 |

## 2. Acceptance-criteria namespaces

| Namespace | Where | Relationship |
|---|---|---|
| AC-001..012 | BRD section 18 | business acceptance |
| AC-SRS-001..016 | SRS section 15 | behaviour; mapped to FR in SRS section 16 |
| AC-01..09 | UI Flow section 15 | UI-phase acceptance |
| (unnumbered) | API Contract section 18 | API acceptance |
| AC-ALN-01..22 | section 4 below | clarified rules with test evidence |

## 3. Status per requirement area (from the 2026-09 gap analysis)

OPD references in this table are historical; each is settled or tracked in `docs/DECISIONS.md` (see its section 1 and 4, and `docs/REQUIREMENTS_ALIGNMENT.md` 6.K).

| # | Business requirement | Source(s) | Design / implementation | Status | Action |
|---|---|---|---|---|---|
| 1 | 4-month / 16-week program, 2 days/week, 4 h/day, 5 courses (~1 month each) | BRD 3.1, FR-010..013, FR-016 | `training.program/course/day` (ADR-002/004). Week count, days/week, hours/day and course count are configuration data, not enforced rules. | Covered | None. Do not add validation the BRD does not state. |
| 2a | Trainee: one daily evaluation per day | BRD FR-020..029A, BR-002; SRS-TRN-001..003 | `training.day` survey window, `survey.user_input` final-submit lock, unique per (day, role, partner) (ADR-003, ADR-005) | Covered | None. |
| 2b | Supervisor: attendance (present/absent/late) + daily evaluation | BRD FR-030..035, BR-006; SRS-SUP | `training.attendance`, supervisor survey (ADR-003/004/007) | Covered | None. |
| 2c | Trainer: technical observations + daily report, draft then submit | BRD FR-040..044 | Trainer report API, per-trainer response (ADR-003/005) | Covered | None. |
| 2d | General Supervisor: full monitoring, history, report review/approval | BRD section 6, FR-080..083 | Odoo Back-office (`UI Flow` OD-07..OD-12), record rules | Covered (Odoo) | See 6.A. |
| 3a | Trainee survey items (trainer, style, interaction, content, material, comprehensiveness, practical value, environment, organisation, facilities, logistics) | BRD FR-021..024 | Question content is authored in Odoo Survey; KPI category mapping on `survey.question` | Not code | Initial question set is not seeded and its approval is a stated SRS readiness gate (OPD-09). |
| 3b | Supervisor daily evaluation (attendance, absence, lateness, environment, flow) | BRD FR-031..034 | `training.attendance` + Odoo Survey | Covered | None. |
| 3c | Trainer report (response, notes, recommendations) | BRD FR-041..043 | Odoo Survey via trainer-report API | Covered | None. |
| 4a | GS dashboard aggregates the three inputs automatically after submit | BRD FR-050, AC-006; SRS-DASH-001 | `training.analytics` computes from source data (ADR-004); Odoo Graph/Pivot views on attendance and survey KPI | Covered | Verified (gap analysis 2026-09-26): the survey KPI view carries `respondent_role`, so supervisor-survey and trainer-report *ratings* appear, and Trainee/Supervisor/Trainer filters were added. Free-text answers are not KPIs and do not appear. **Settled by DEC-13 (2026-10-03).** |
| 4b | Day-by-day tracking, cumulative course performance, any of five courses, history | BRD FR-051..056 | Odoo Graph/Pivot + filters; `get_kpi(program, course, day, trainer, dates)` | Covered | Standard views only (permitted by UI Flow 1 / PROJECT_SPEC 8). Bespoke five-course comparison and trend views are not confirmed; see OPD-04 for the undefined trend definition. **Settled by DEC-20 (2026-10-03).** |
| 4c | Where the GS dashboard lives | UI Flow 1-3, 14, OD-10; PROJECT_SPEC 2.1; API 11 | Odoo Back-office. No admin dashboard in Next.js. | Covered / resolved | See 6.A and R3. |
| 5a | Course-end report (trainer, content, environment, attendance/absence) | BRD FR-060/061, 11.1; SRS-RPT-001 | `training.report` (ADR-008): KPI summary + attendance sections, PDF, Excel | Covered | BRD 11.1 also lists executive summary, highest/lowest indicators, qualitative notes and recommendations, day comparison/trend. These sections are **not** in the generated report. **Settled by DEC-23 (2026-10-03).** |
| 5b | Final program report (statistics, analysis, filters, show/hide) | BRD FR-062..064, 11.2; SRS-RPT-002 | Same model, `report_type` program | Covered | BRD 11.2 five-course comparison, 16-week trend, strengths/opportunities, recurring recommendations are not generated. Weighting rule needs approval (OPD-04). **Settled by DEC-23 (2026-10-03).** |
| 5c | Filters and show/hide | BRD FR-055, FR-063, FR-064 | Filters: report type, program, course, date range. Toggles: five KPI sections (`show_*`). | Covered | Scope of "full flexibility" is undefined; see 6.E. **Settled by DEC-24 (2026-10-03).** |
| 5d | PDF and Excel export | BRD FR-065/066, AC-009 | `ir.actions.report` QWeb Arabic RTL PDF, `xlsxwriter` Excel (ADR-008, ADR-010 real render check) | Covered | None. |
| 5e | Versioning, approval, approver, timestamp, immutability, new version on change | BRD FR-067, FR-080..082, BR-005 | Write-guard lock, `action_new_version()`, `action_approve()`, `training.audit.log` entry (ADR-008) | Covered | BRD marks FR-067/FR-082 "Should" while BR-005 is a rule; treated as required (R6). |
| 6a | Automated reminders SMS/WhatsApp before survey closes | BRD FR-070..073, D-08; SRS-NTF-001 | `ir.cron` + `training.notification.log`, three channels behind adapters, duplicate-safe (ADR-009) | Covered | No "N hours before close" variant; policy values undefined (6.C). Providers are infrastructure (section 7). **Settled by DEC-26 (2026-10-03).** |
| 6b | KPI dashboard: comparisons and trends | BRD FR-053/054 | See 4b | Covered | Same as 4b. **Settled by DEC-20 (2026-10-03).** |
| 6c | PDF/Excel export | BRD FR-065/066 | See 5d | Covered | None. |
| 6d | Electronic approval / "digital signature" | BRD 4.2, 18, FR-083, D-10; SRS-APR-001 | Approved-report PDF carries approver, date/time and visual stamp; no PKI (ADR-008) | Covered | Terminology, see 6.F. |
| 8 | Multiple programs with separated data | BRD FR-016, BR-012, D-15, NFR-008; SRS NFR-004 | `program_id` scoping on courses/enrollments/reports | Covered | See 6.G. |
| 9 | Bilingual Arabic RTL / English LTR from first release | BRD "approved decision" section; PROJECT_SPEC 2A | next-intl, `dir` per locale, message parity (ADR-006/010) | Covered | R2. |
| 10 | Audit of sensitive events | BRD NFR-006, FR-005; SRS 6.11; PROJECT_SPEC 17 | `training.audit.log`: `day_reopen`, `day_close`, `report_approval`, `permission_change` (project groups via `res.users` create/write and `res.groups` user changes), `response_correction` (any `su`-scoped write/unlink of an already-final `survey.user_input` or its answer lines), on every code path | Covered | The one existing path able to alter a final response (`su`) is now logged (`response_correction`), closing the pure audit-trail gap; **no corrective workflow, "Administratively Corrected" state, or mandatory reason field exists** (OPD-11 remains open -- that UX/workflow shape is still undecided). SRS 6.11 also lists login, user edit/disable and published-survey edits; PROJECT_SPEC 17 does not require them and they are not logged. **Settled by DEC-11 (2026-10-03).** |
| 11 | AI-assisted analysis | BRD 12 (Phase 2/3) | Not built | Out of phase | Future scope. Must remain human-approved (BRD 12). |

## 4. Acceptance criteria for the clarified requirements

Each criterion is a testable behaviour. **Evidence** names an existing test
(in `custom_addons/training_management/tests/`) or frontend test where one
exists. **Pending** means the behaviour depends on an open decision and no
test may be written until the owner decides; the criterion is stated
conditionally.

| ID | Requirement clarified | Acceptance criterion | Evidence |
|---|---|---|---|
| AC-ALN-01 | GS dashboard, analytics, report generation and approval are Odoo | No Next.js route or `/api/v1` endpoint creates, configures, approves or exports a report or serves an admin dashboard; Odoo menus for Analytics, Reports and Approval exist | PROJECT_SPEC 10.7 forbidden list; ADR-008 (no report endpoints); `test_trainee_cannot_access_report_model` |
| AC-ALN-02 | Submitted response is final | After final submit no edit action or endpoint exists for the trainee; lines cannot be added, changed or deleted; a second submit creates no second record | `test_final_response_lines_cannot_be_added_modified_or_deleted`, `test_duplicate_final_response_prevented_at_db_level`, `test_duplicate_final_response_prevented_by_service`, `test_cannot_edit_after_final_submit` (README) |
| AC-ALN-03 | Post-submit status (the day page now also offers the read-only read-back, AC-ALN-04) | `my-survey/status` still returns only `response_id, state, submitted_at, editable` and never answer content | API trainee tests (ADR-006 section 12) |
| AC-ALN-04 | Read-back of own answers (OPD-01, approved 2026-10-03) | A trainee can read only her own final answers (`my-survey/response`, submitted only) and never another trainee's; supervisor and trainer still cannot read any | Isolation tests exist: `test_trainee_cannot_access_another_trainee_response`, `test_supervisor_cannot_access_trainee_response`, `test_trainer_cannot_access_trainee_response` |
| AC-ALN-05 | Survey window | Submit is denied before `survey_open_at` and after `survey_close_at` even when the day is open; the window never changes day state | `test_survey_denied_before_window_opens_even_if_day_open`, `test_survey_denied_after_window_closes_even_if_day_open`, `test_no_automatic_state_transition_from_time_window` |
| AC-ALN-06 | Reminder exclusion and duplicates | A person with a final response is never a pending recipient; a second cron run creates no duplicate row for the same day/role/person/channel/event, enforced by the database | `test_pending_recipients_includes_unsubmitted_trainee_and_supervisor`, `test_duplicate_prevention_second_cron_run_does_not_duplicate`, `test_duplicate_log_row_blocked_at_db_level` |
| AC-ALN-07 | Reminder outside the window | The cron skips a day that is not open or is outside its window | `test_cron_skips_day_outside_survey_window` |
| AC-ALN-08 | Channel fallback and retry | With fallback on, the next channel is tried only after a failure and never after a success; with it off, each enabled channel is attempted independently; automatic retries stop at the configured maximum | `test_fallback_stops_at_first_success`, `test_fallback_tries_next_channel_after_failure`, `test_fallback_disabled_attempts_every_enabled_channel_independently`, `test_retry_budget_exhausted_stops_further_attempts` |
| AC-ALN-09 | Reminder lead time, count, priority values (DEC-26) | These are Odoo configuration values, not fixed requirements; the reminder is sent per the configured values, once per day/role/person/channel/event | `test_duplicate_prevention_second_cron_run_does_not_duplicate` and AC-ALN-06..08 |
| AC-ALN-10 | Attendance, absence, late rates | For a day with p on time, l late, a absent: attendance = (p+l)/(p+l+a), absence = a/(p+l+a), late = l/(p+l); a zero denominator returns no value, never 0 | `test_attendance_rates`, ADR-004 section 5 |
| AC-ALN-11 | Survey KPI averages | Category averages ignore skipped and non-rating lines; no valid data returns no value, never 0 | `test_no_valid_data_is_none_not_zero`, `test_no_data_returns_none_not_zero` |
| AC-ALN-12 | Program/course aggregation | Program averages pool every valid response with equal weight and are not an average of course averages | `test_course_kpi_equal_weight_per_response_not_average_of_days`, `test_program_kpi_pools_all_courses_equal_weight` |
| AC-ALN-13 | Response rate | Absent trainees are excluded from the denominator; no attendance recorded returns no value | `test_trainee_response_rate_excludes_absent`, `test_trainee_response_rate_pending_when_no_attendance` |
| AC-ALN-14 | KPI definitions (DEC-16..22) | Dashboard and report use one service and give identical numbers for identical filters; cancelled and postponed days are excluded; environment is two indicators | `test_not_held_days_are_excluded_from_kpis`, `test_environment_indicators_are_separate_by_role` |
| AC-ALN-15 | Dashboard/report consistency | The same filters give the same KPI numbers in analytics and in the generated report (single `training.analytics` service) | ADR-004 section 7; report tests |
| AC-ALN-16 | Report filters | Scope filters and toggles are fixed once generated; changing them requires a new version; a new version leaves the old one untouched | `test_generated_report_filters_locked_without_new_version`, `test_new_version_creates_independent_draft`, `test_regenerate_allowed_while_generated_not_approved` |
| AC-ALN-17 | Filter scope (DEC-24) | Report filters are program, course, date range; the applied filters are stored and locked once generated | AC-ALN-16 tests |
| AC-ALN-18 | Approval is internal, not legal | Only an admin can approve, only from the generated state; approval stores approver and timestamp, locks the record, writes an audit entry; the PDF carries the approver, date/time and stamp; no PKI signature is produced | `test_approve_requires_admin_group`, `test_approve_requires_generated_state`, `test_approve_sets_metadata_and_locks`, `test_approved_report_is_immutable`, `test_report_approval_is_logged` |
| AC-ALN-19 | Export | PDF (Arabic RTL) and Excel export succeed for an approved report; a trainee cannot reach the report or its attachment | `test_export_excel_allowed_after_approval`, `test_trainee_cannot_access_report_attachment`; ADR-010 section 3 real PDF render |
| AC-ALN-20 | Multi-program separation | Program KPIs, attendance, response rate, program and course reports and the Back-office KPI view never mix programs; each program has its own courses, enrollments and reports; the initial data set is the single Quran-school principals program | SRS AC-SRS-009; `TestMultiProgramIsolation` in `tests/test_requirements_alignment.py` |
| AC-ALN-21 | Document authority | `CLAUDE.md`, `README` and `PROJECT_SPEC` all point to this file; the version table in section 2 decodes every `.docx` citation; sections 5 and 8 mark each superseded example | Manual review of this file and its pointers |
| AC-ALN-22 | Report content (DEC-23) | A generated course report has executive summary, day comparison and trend, notes/recommendations; a program report has the course comparison and trend; each section can be hidden; comments never carry identity | `test_course_report_narrative_and_comments`, `test_program_report_compares_courses`, `test_highlights_use_highest_and_lowest_available_indicator`, `test_excel_follows_narrative_toggles`, `test_narrative_toggles_locked_after_generation` |

All rows now have evidence.
