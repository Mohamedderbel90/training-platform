# Requirements Alignment and Document Authority

- **Date:** 2026-09-25
- **Scope:** documentation only. No application code, model, API or UI
  behaviour is changed by this document.
- **Method:** the five `.docx` sources (BRD, SRS, ERD, API Contract, UI
  Flow) were read in full or searched by topic; `PROJECT_SPEC`,
  `DEVELOPMENT_PLAN`, `README`, `RUNBOOK`, ADR-001..011 and the
  implemented addon/frontend were consulted for implementation status.
  Nothing here closes an open product decision; where a source is silent
  the item is listed in section 6 as **open**.

This file is the single index of *which document governs what*, where the
documents disagree, and what is still undecided. Read it before treating
any `.docx` as an implementation instruction.

---

## 1. Authority hierarchy

| Concern | Governing document | Notes |
|---|---|---|
| Business requirements (what and why) | `BRD_Training_Program_Management_System_v1.4_BILINGUAL_RTL.docx` | Internal version label is **1.2 Final**; see 2. Formal sign-off is **not recorded** (OPD-07). |
| Detailed functional / system requirements | `SRS_Training_Program_Management_System_v1.5_BILINGUAL_RTL.docx` | Internal label **1.2**. Refines the BRD; must not contradict it. |
| Implementation architecture, ownership boundaries, model names, API conventions | `PROJECT_SPEC_v1.1_BILINGUAL.md` | Wins over older `.docx` on architecture, naming, interface ownership. |
| Execution roadmap | `DEVELOPMENT_PLAN_v1.1_BILINGUAL.md` | Milestones M0..M10. The milestone list inside the API Contract (M1..M7) is superseded. |
| Design decisions and verified runtime deviations | `docs/adr/ADR-001..011` | Later ADRs supersede earlier text where they say so. ADR-001 records the verified Odoo 19 Community runtime. |
| Operations | `docs/RUNBOOK.md` | Deployment/backup/monitoring guidance only. |
| Data model (business intent) | ERD `.docx` | Field/model *names* are governed by `PROJECT_SPEC` sections 4-6 and ADR-001/002, not by the ERD. |
| Operational API contract | API Contract `.docx` for intent; `PROJECT_SPEC` section 10-11 for the endpoint list actually allowed | See 5, item R4. |
| Screens / navigation | UI Flow `.docx` for Odoo menus and screen intent; `PROJECT_SPEC` section 8-9 and ADR-006/011 for the Next.js routes and sidebar actually built | See R11. |
| Visual design | `Sidebar + Header + Trainee Dashboard-html/` and `noor-login/` (approved exports/assets) | Visual source of truth only; not requirements. |
| Agent working rules | `CLAUDE.md` | Points here for document authority. |

Precedence when documents disagree: latest **explicitly approved** BRD for
business intent; `PROJECT_SPEC` for implementation; an ADR that says it
supersedes a passage wins over the passage. Older `.docx` text that
conflicts is **historical** (section 8) and must not be used to add
scope. The repository holds exactly one copy of each `.docx`; there are no
parallel BRD/SRS files to confuse, only mismatched version *labels*.

## 2. Version-label reconciliation

The file names, the version printed inside each file, and the versions the
other documents cite do not agree. Until the owner re-issues the files
with consistent labels (not done here: the `.docx` files are left
unmodified per the README policy), use the **file name** as the identifier
and this table to decode citations.

| File name says | Internal header says | Cited elsewhere as |
|---|---|---|
| BRD v1.4 | 1.2 Final (13/09/2026) | "BRD v1.3 Final" (SRS, API, ERD, UI Flow) |
| SRS v1.5 | 1.2 | "SRS v1.3" (API, ERD), "SRS v1.4" (UI Flow), "SRS v1.1" (SRS section 19) |
| ERD v1.3 | 1.0 Draft for Technical Review | "ERD v1.1" (API), "ERD v1.2" (UI Flow) |
| API Contract v1.3 | 1.1 | "API Contract v1.2" (UI Flow) |
| UI Flow v1.1 | 1.0 | - |
| PROJECT_SPEC v1.1 | 1.1 | - |
| DEVELOPMENT_PLAN v1.1 | 1.1 | - |

Reading: every "BRD v1.3" citation means the single BRD file above.

## 3. Status legend

- **Covered** - documented and implemented/tested.
- **Partial** - documented; implementation or documentation is incomplete.
- **Missing** - required by the BRD, not implemented.
- **Ambiguous** - sources are silent or admit two readings.
- **Conflicting** - sources disagree (resolution in section 5 or 6).
- **Not code** - satisfied by Odoo configuration/content, not code.

Statuses reflect what was checked in this review (documents, model/view
files, ADRs, tests present). They are not a substitute for the QA pass.

## 4. Traceability matrix

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
| 4a | GS dashboard aggregates the three inputs automatically after submit | BRD FR-050, AC-006; SRS-DASH-001 | `training.analytics` computes from source data (ADR-004); Odoo Graph/Pivot views on attendance and survey KPI | Partial | Verified (gap analysis 2026-09-26): the survey KPI view carries `respondent_role`, so supervisor-survey and trainer-report *ratings* appear, and Trainee/Supervisor/Trainer filters were added. Free-text answers are not KPIs and do not appear. |
| 4b | Day-by-day tracking, cumulative course performance, any of five courses, history | BRD FR-051..056 | Odoo Graph/Pivot + filters; `get_kpi(program, course, day, trainer, dates)` | Partial | Standard views only (permitted by UI Flow 1 / PROJECT_SPEC 8). Bespoke five-course comparison and trend views are not confirmed; see OPD-04 for the undefined trend definition. |
| 4c | Where the GS dashboard lives | UI Flow 1-3, 14, OD-10; PROJECT_SPEC 2.1; API 11 | Odoo Back-office. No admin dashboard in Next.js. | Covered / resolved | See 6.A and R3. |
| 5a | Course-end report (trainer, content, environment, attendance/absence) | BRD FR-060/061, 11.1; SRS-RPT-001 | `training.report` (ADR-008): KPI summary + attendance sections, PDF, Excel | Partial | BRD 11.1 also lists executive summary, highest/lowest indicators, qualitative notes and recommendations, day comparison/trend. These sections are **not** in the generated report. |
| 5b | Final program report (statistics, analysis, filters, show/hide) | BRD FR-062..064, 11.2; SRS-RPT-002 | Same model, `report_type` program | Partial | BRD 11.2 five-course comparison, 16-week trend, strengths/opportunities, recurring recommendations are not generated. Weighting rule needs approval (OPD-04). |
| 5c | Filters and show/hide | BRD FR-055, FR-063, FR-064 | Filters: report type, program, course, date range. Toggles: five KPI sections (`show_*`). | Ambiguous | Scope of "full flexibility" is undefined; see 6.E. |
| 5d | PDF and Excel export | BRD FR-065/066, AC-009 | `ir.actions.report` QWeb Arabic RTL PDF, `xlsxwriter` Excel (ADR-008, ADR-010 real render check) | Covered | None. |
| 5e | Versioning, approval, approver, timestamp, immutability, new version on change | BRD FR-067, FR-080..082, BR-005 | Write-guard lock, `action_new_version()`, `action_approve()`, `training.audit.log` entry (ADR-008) | Covered | BRD marks FR-067/FR-082 "Should" while BR-005 is a rule; treated as required (R6). |
| 6a | Automated reminders SMS/WhatsApp before survey closes | BRD FR-070..073, D-08; SRS-NTF-001 | `ir.cron` + `training.notification.log`, three channels behind adapters, duplicate-safe (ADR-009) | Partial | No "N hours before close" variant; policy values undefined (6.C). Providers are infrastructure (section 7). |
| 6b | KPI dashboard: comparisons and trends | BRD FR-053/054 | See 4b | Partial | Same as 4b. |
| 6c | PDF/Excel export | BRD FR-065/066 | See 5d | Covered | None. |
| 6d | Electronic approval / "digital signature" | BRD 4.2, 18, FR-083, D-10; SRS-APR-001 | Approved-report PDF carries approver, date/time and visual stamp; no PKI (ADR-008) | Covered | Terminology, see 6.F. |
| 7 | Participant list import from Excel | BRD FR-015, D-09; SRS AC-SRS-014 | Odoo standard import + `unique(program_id, partner_id)` (PROJECT_SPEC 18) | Partial | The SRS acceptance criterion asks for a valid/invalid-row **preview**; no custom preview wizard exists. Standard Odoo import is the documented path. Confirm it is acceptable (OPD-10). |
| 8 | Multiple programs with separated data | BRD FR-016, BR-012, D-15, NFR-008; SRS NFR-004 | `program_id` scoping on courses/enrollments/reports | Covered | See 6.G. |
| 9 | Bilingual Arabic RTL / English LTR from first release | BRD "approved decision" section; PROJECT_SPEC 2A | next-intl, `dir` per locale, message parity (ADR-006/010) | Covered | R2. |
| 10 | Audit of sensitive events | BRD NFR-006, FR-005; SRS 6.11; PROJECT_SPEC 17 | `training.audit.log`: `day_reopen`, `day_close`, `report_approval`, `permission_change` (project groups via `res.users` create/write and `res.groups` user changes), on every code path | Partial | PROJECT_SPEC 17 events are logged except **exceptional administrative correction of a final response**, for which no workflow exists (OPD-11). SRS 6.11 also lists login, user edit/disable and published-survey edits; PROJECT_SPEC 17 does not require them and they are not logged. |
| 11 | AI-assisted analysis | BRD 12 (Phase 2/3) | Not built | Out of phase | Future scope. Must remain human-approved (BRD 12). |

## 5. Resolved inconsistencies

Each entry keeps the older text visible as historical rather than deleting it.

- **R1 - Version labels.** See 2.
- **R2 - Localization.** BRD NFR-009 and SRS NFR-006 say "Arabic primary,
  English possible later". The BRD's own later *approved decision* section,
  UI Flow ("Bilingual UI"), PROJECT_SPEC 2A and the implementation require
  Arabic **and** English from the first release. The later approved decision
  governs; NFR-009 / SRS NFR-006 are outdated on this point.
- **R3 - GS dashboard ownership.** BRD section 16 and SRS UI-02 list a
  "General Supervisor dashboard" without naming the interface. UI Flow
  sections 1-3/14 and OD-10, API Contract section 11 ("N/A - Odoo
  Back-office") and PROJECT_SPEC 2.1 place administrative dashboards and
  analytics in **Odoo** (Graph/Pivot first). Decision of record: no
  duplicate full admin dashboard in Next.js unless a business requirement
  is raised as a Change Request (UI Flow 14).
- **R4 - Admin endpoints in the API Contract.** The API Contract states
  admin functions are "N/A - Odoo Back-office" yet still shows examples
  `POST /courses/{id}/days`, `POST /reports/course/preview`,
  `POST /reports/{id}/approve` and an "Admin dashboard response" (section
  11.2). SRS section 8 also lists Users/Programs/TrainingDays CRUD rows.
  These are **illustrative and historical**; PROJECT_SPEC 10.7 forbids
  them for Next.js, ADR-008 confirms none were built. The endpoints
  actually allowed are PROJECT_SPEC 10.1-10.6 plus ADR-011's role day
  endpoints.
- **R5 - Reminder priority.** BRD FR-070 "Should", FR-071 "Must",
  SRS-NTF-001 "Must", and the BRD phase table places automation in Phase 2.
  Resolution: channels (FR-071) are a business requirement; provider
  credentials are an infrastructure prerequisite, not a product gap.
- **R6 - Approved-report immutability.** FR-067/FR-082 are "Should" but
  BR-005, SRS-APR-001 and AC-SRS-011 state it as a rule. Treated as
  required; implemented.
- **R7 - Attendance vocabulary.** BRD/SRS say "present" both for "on time"
  and for "attended". Fixed reading (SRS 6.7, PROJECT_SPEC 13, ADR-004):
  status is one of `present`, `absent`, `late`; **late counts as present**
  for attendance rate and also appears in late rate.
- **R8 - Trainer assignment.** PROJECT_SPEC 25 left "separate assignment
  model vs Many2many" open. Implemented as `Many2many trainer_ids` on
  `training.day`; per-trainer independent report preserved.
- **R9 - Milestone lists.** API Contract M1..M7 and DEVELOPMENT_PLAN
  M0..M10 differ; DEVELOPMENT_PLAN governs.
- **R10 - Numbering.** BRD jumps from section 16 to 18 and carries an
  appended architecture/bilingual block after section 24. Cosmetic; no
  requirement is missing (FR/BR/D identifiers are contiguous).
- **R11 - Next.js navigation.** UI Flow section 12 lists a shorter sidebar
  per role. ADR-011 (accepted) sets the current sidebar (adds "Training
  Program" for trainees) and the routes `/trainee/surveys`,
  `/trainee/program`, `/supervisor/evaluations`, `/trainer/reports`.
  ADR-011 supersedes UI Flow 12 for navigation. The trainee "Training
  Program" page is a display of already-supplied data and is not a BRD
  functional requirement.
- **R12 - Runtime deviations.** `res.partner.mobile`, Odoo Sign and
  WhatsApp are absent on the verified Odoo 19 Community runtime (ADR-001).
  ERD/SRS assumptions on those are historical; `PROJECT_SPEC` and ADR-001
  govern.
- **R13 - Multi-program wording.** See 6.G.

## 6. Focus areas and open product decisions

Open items use the prefix **OPD** and are the only place a decision is
requested. None is closed by this document.

### 6.A General Supervisor dashboard - resolved (R3)

Odoo owns it. Next.js has role dashboards for trainee, supervisor and
trainer only. Adding a GS dashboard to Next.js would be a Change Request.

### 6.B Trainee read-back of a submitted survey - OPEN (OPD-01)

Every mention found, grouped by what it actually says:

- **Confirmation only / status only (consistent with current build):**
  BRD FR-027 ("show completion status after submit"); SRS section 4 (trainee
  sees "completion status"); SRS-TRN-001 (closed day = "read-only status");
  UI Flow NX-05 and section 8 ("Submitted - status only, no Edit");
  PROJECT_SPEC 7.3 ("view own submission status"), section 9 note and
  `my-survey/status` returning `{response_id, state, submitted_at,
  editable}` only; DEVELOPMENT_PLAN success/read-only state.
- **Read-only access to the trainee's own answers:** *no approved source
  requires or forbids it.* It appears only as a conditional gap in ADR-006
  section 12, ADR-010 section 8, README and the PROJECT_SPEC section 9 note.
- **Related privacy rule:** BRD FR-026, BR-008, D-01, D-14 and SRS
  SRS-TRN-003 restrict *detailed trainee evaluations and identity* to the
  General Supervisor. They do not say whether a trainee may see her *own*
  answers.
- The phrase "read-only" in UI Flow NX-05 / DEVELOPMENT_PLAN is
  **ambiguous** between the two meanings and must not be read as
  answer read-back.

Current behaviour: confirmation/status only. Decision needed: keep
status-only, or allow read-only access to the trainee's own final
answers (and if so, whether comments are included).

### 6.C Survey window and reminder policy - PARTLY OPEN (OPD-03)

| Item | Defined by | Status |
|---|---|---|
| Opening time / closing time | BRD FR-018, BR-011, D-16; `training.day.survey_open_at/close_at` | Defined |
| Who controls the window | General Supervisor, in Odoo | Defined |
| Reminder before close | BRD FR-070 ("before close") | Defined in principle; **lead time not defined** |
| Reminder timing configurable | BRD FR-072 (Should) | Global settings exist; per-rule timing not defined |
| Number / frequency of reminders | none | **Open** (current build: hourly cron, one log row per day/role/person/channel/event, i.e. one reminder per channel) |
| Who is eligible | SRS-NTF-001, AC-SRS-013: not those who already submitted | Defined; ADR-009 reminds trainee, supervisor and trainer with an unsubmitted task |
| No reminder after final submit | SRS-NTF-001, AC-SRS-013, PROJECT_SPEC 16 | Defined and implemented |
| Channels | BRD FR-071, D-08 | Defined |
| Channel fallback | BRD risk table: Email as interim; SRS: continue with other channels; ADR-009: boolean, default off | **Policy not approved** |
| Retry policy | SRS: "Retry اختياري" | Open (build default 3 attempts) |

Nothing above may be filled in with invented values.

### 6.D KPI definitions - PARTLY OPEN (OPD-04)

Same filters must give the same numbers in dashboard and report
(PROJECT_SPEC 14; ADR-004 single `training.analytics` service).

| KPI | Formula in approved sources | Aggregation level | Missing data | Status |
|---|---|---|---|---|
| Trainer / content / environment average | Mean of category questions, with descriptive scale mapped 1..5 (SRS 6.7) | day, course, program | `None`, never 0 (ADR-004; SRS-RPT-002 "No Data") | Formula defined; **1..5 mapping is "proposed" in SRS** and asserted as a rule in PROJECT_SPEC; approval not recorded |
| Attendance rate | (present + late) / enrolled x 100 (SRS 6.7, ADR-004) | day, course, program | `None` if denominator 0 | Defined (late counts as present) |
| Absence rate | absent / enrolled x 100; no excused absence | same | same | Defined |
| Late rate | late / (present + late) x 100 | same | same | Defined |
| Survey response rate | BRD: completed / *targeted* x 100 (BR-003). SRS: Target = expected respondents for the day. ADR-004: denominator = attendance rows with status present or late | day, course | `None` if no attendance recorded | **Conflict of reading:** "targeted" (enrolled) vs implemented "attended"; approval needed |
| Trend | BRD/SRS: difference between period averages; reference period shown | course, program | - | **Period unit (day/week/month/course) undefined** |
| Program-level average | BRD 11.2 "weighted averages"; SRS: weights must be declared, no undocumented average of averages | program | No Data, not 0 | Implemented as equal weight per valid response (ADR-004); weighting choice needs confirmation |
| Environment source | SRS: trainees and supervisor as separate indicators or a labelled composite | - | - | Undefined which is the headline KPI |

Also undefined: treatment of cancelled/postponed days beyond SRS 5.2
(cancelled days excluded unless documented data exists), and whether late
minutes affect any KPI (they do not in any source).

### 6.E Report filters and show/hide - AMBIGUOUS (OPD-05)

"Full flexibility" (requirement text) is not defined by the BRD. It is
replaced here by an explicit model. **Basis** says where the source
supports each item; nothing marked *recommended* is a business
requirement.

| Filter | Basis | Dashboard / analytics | Generated report | Class |
|---|---|---|---|---|
| Program | BRD FR-016, BR-012, SRS AC-SRS-009 (never mix programs) | scoped by program | `program_id` | Required |
| Course | BRD FR-055, FR-063 | `get_kpi(course=)` | `course_id` (course report) | Required |
| Date range | BRD FR-055, FR-063 | `get_kpi(date_from, date_to)` | `date_from`, `date_to` | Required |
| Trainer | BRD FR-055; SRS-DASH-001 | `get_kpi(trainer=)` | not a report filter (API Contract preview example is illustrative, R4) | Required for dashboard; **report use = recommended** |
| Status | BRD FR-055 ("status", undefined which entity) | not specified | not specified | **Ambiguous** |
| Training day | BRD FR-056 (drill-down to a day) | `get_kpi(day=)` | not a report filter | Drill-down, not a report filter |
| Attendance status (present/absent/late) | none | none | none | *Recommended* only |
| Survey completion status | none | none | none | *Recommended* only |

Show/hide (BRD FR-064, "sections or indicators before export"):

- **Implemented:** five toggles - trainer score, content score,
  environment score, attendance, response rate.
- **Named by the BRD as report content (11.1/11.2) but not toggleable or
  not generated:** executive summary, highest/lowest indicators,
  qualitative notes and recommendations, day/course comparison, trend,
  strengths/opportunities, approval status block.
- **Rule to preserve:** filters and the applied toggles are stored on the
  report and locked once generated; a change creates a new version
  (ADR-008); the report states the period and filters applied (SRS-RPT-001).
- Any additional filter or toggle is optional customization until OPD-05
  is answered.

### 6.F Digital signature vs electronic approval - RESOLVED by BRD

BRD 4.2, section 18 and D-10 (and SRS-APR-001) define the required
mechanism: **internal electronic approval** - approver identity, date and
time, immutable approved snapshot, audit entry, visual stamp/signature
inside the PDF. A legal/cryptographic (PKI, certificate-based) signature is
**out of scope** for the first release and listed as Future; Odoo Sign is
optional and absent on the Community runtime (ADR-001). The two must not be
treated as equivalent. The phrase "digital signature" in informal
requirement text means the visual stamp unless the owner asks otherwise.

### 6.G Multi-program support - CLARIFIED, not reinterpreted

The initial business case is one program (4 months, five courses).
However the approved BRD makes **structural multi-program support a Must
from the base release**: FR-016 (Must) and BR-012 (independent programs with
separated data and reports), NFR-008, and the Phase 1 MVP scope ("manage
multiple programs"). D-15 words it as "supports multiple training programs in
the future, and from the base release in terms of structure", which is the
same intent: structure now, more programs later. The BRD phase table lists
only "advanced multi-program" as Future. So it is both a scalability decision *and* an
approved requirement (independent programs with separated data and
reports); it does not add first-release UI beyond what the BRD lists. The
"Program" administration stays in Odoo. "Advanced" is undefined and is
future scope.

### 6.H Privacy and role boundaries

Sources agree: the trainee sees only her own permitted data; the
supervisor and trainer do not see individual trainee answers or identity;
only the General Supervisor does (BRD BR-008, D-01/D-14; SRS section 4,
SEC-007, AC-SRS-001). Aggregates exposed to non-GS roles must be
anonymous (SRS-TRN-003). Enforcement is in Odoo (groups, ACL, record
rules, server-side ownership checks); the frontend only hides UI. Status:
covered and tested (security/API test classes). Open: OPD-01 above.

### 6.I Reporting and approvals

Covered: course and program reports, `version_no`, states
(draft -> generated -> approved, new version on change), approver and
timestamp, write-guard immutability, PDF stored in `ir.attachment`,
Excel export, audit entry on approval. SRS 5.4 also names
"Under Review" and "Superseded". The implemented `training.report` states
are `draft`, `generated`, `approved`; a newer version is a separate record
(`version_no + 1`) and the older one is left untouched, so "Superseded" is
expressed by version rather than by a state value. The BRD only requires
immutability and a new version on change (FR-067, FR-082, BR-005), so this is
an SRS vocabulary difference, not an open decision; ADR-008 governs the
implemented names. Partial: report *content* (5a/5b).

### 6.J Notifications

Covered: email (`mail.template`), SMS and WhatsApp behind provider
adapters (default safe "test" mode), retry limit, fallback switch,
duplicate prevention by a unique constraint, failure logging, scheduled
via `ir.cron`. Implementation readiness is separate from provider
credentials (section 7).

### 6.K Open product decisions (summary)

| ID | Decision needed | Why open |
|---|---|---|
| OPD-01 | May a trainee read back her own submitted answers, or status only? | No approved source decides (6.B) |
| OPD-02 | Content and channels for Help / Contact / Terms / Privacy sidebar items | Not in BRD/SRS/UI Flow; referenced only in ADR-011 and the nav config |
| OPD-03 | Reminder policy: lead time, number/frequency, fallback order, retry values | 6.C |
| OPD-04 | KPI approvals: 1..5 mapping, response-rate denominator, trend period, weighting, headline environment source | 6.D |
| OPD-05 | Scope of report filters and toggleable sections ("full flexibility") | 6.E |
| OPD-06 | Whether any legal/PKI signature is wanted later | Currently out of scope (6.F); listed only so it is not silently added |
| OPD-07 | Formal BRD sign-off | BRD approvals table shows all three approvers "not approved / to be named"; SRS section 19 nonetheless states the BRD is approved |
| OPD-08 | Confirm the report-content gap: are the BRD 11.1/11.2 narrative and comparison sections required in the generated report? | Documented in the BRD, absent in the build (5a/5b) |
| OPD-09 | Approval of the initial survey question sets (three roles) | SRS section 19 readiness item; no seeded surveys |
| OPD-10 | Is standard Odoo import (no preview wizard) acceptable for FR-015? | SRS AC-SRS-014 asks for preview |
| OPD-11 | Administrative correction of a final response: workflow, "Administratively Corrected" state, reason, before/after audit | BRD BR-004, SRS 5.3/6.11 and PROJECT_SPEC 17 require it to be audited but define no workflow; today nobody can alter a done response without `su`, and a `su` write is unaudited |
| OPD-12 | Attendance edit window: may a supervisor edit attendance after the day is closed/postponed/cancelled, and for how long? | BRD says "within a defined time window" without a value; the API currently does not check day state |
| OPD-13 | Should Assistant Admin see anonymous per-response scores (`training.survey.response.kpi`, no identity)? | Read access exists; tension with BR-008/SEC-007 if "individual details" includes scores |

### 6.L Residual risks recorded by the 2026-09-26 gap analysis (not decisions)

- **Standard Odoo `/survey/start/<token>` route.** Trainees have read access
  to `survey.survey`, which includes its `access_token`; the API never
  returns it. Responses created through the standard route are not linked
  to a training day, so they do not enter KPIs, but they bypass the
  project's window checks. Not changed (survey access mode is Odoo
  configuration); recommended follow-up: set survey access to invitation/
  login-required and hide the token from operational roles.
- **No minimum cohort size** for aggregates: an Assistant Admin (or any
  reader of aggregates) filtering to one day or trainer can see effectively
  one person's score. No identity is exposed. Needs a policy if individual
  scores must stay General Supervisor-only.
- **Environment KPI mixes roles.** `get_kpi` pools trainee and supervisor
  ratings for the same category; SRS 6.7 wants separate indicators or a
  labelled composite (part of OPD-04).
- **Cancelled days** are not excluded from analytics; SRS 5.2 has a
  historical-data caveat (part of OPD-04).
- **Group `implied_ids` propagation** that grants a project group is not
  audited (project groups imply only base/survey groups today).
- **Attendance default in the UI.** Trainees with no recorded status are
  preselected "present" and a bulk save records them as present. The BRD
  requires an explicit status per trainee (FR-031) but does not say whether
  an unrecorded trainee defaults to present; kept as is pending a decision
  (part of OPD-12).
- **PostgreSQL 13+** suite run still pending (section 7).

## 7. Infrastructure and deployment prerequisites

These are **not** missing product features; they need infrastructure or
external accounts (ADR-010 "Remaining Blockers", RUNBOOK):

- Full test suite against a production-equivalent PostgreSQL **13+**.
- SMS / WhatsApp provider selection, credentials, IAP credits or a WhatsApp
  Business account (BRD 15 lists selection and cost approval as pending).
- Outgoing mail server (also needed for password reset delivery).
- TLS and a real domain.
- Backup and restore drill on the production-equivalent environment
  (NFR-008: daily backup plus periodic restore test).
- Monitoring and log collection (SRS NFR-009).
- Cloud/hosting provider (BRD D-13: any suitable cloud).

## 8. Superseded, deprecated and historical references

| Reference | Status | Use instead |
|---|---|---|
| "BRD v1.3", "SRS v1.3/1.4", "ERD v1.1/1.2", "API Contract v1.2" citations | Label mismatch | Section 2 table |
| BRD NFR-009 / SRS NFR-006 (English "later") | Outdated | BRD approved bilingual decision, PROJECT_SPEC 2A |
| API Contract examples: `POST /courses/{id}/days`, `POST /reports/course/preview`, `POST /reports/{id}/approve`, "Admin dashboard response" | Historical, illustrative | PROJECT_SPEC 10, ADR-008 |
| SRS section 8 rows for Users/Programs/TrainingDays CRUD as "operational" APIs | Historical | PROJECT_SPEC 10.7 |
| API Contract milestone list M1..M7 | Superseded | DEVELOPMENT_PLAN M0..M10 |
| UI Flow section 12 navigation | Superseded for Next.js sidebar | ADR-011, `roleNav.ts` |
| ERD/SRS use of `res.partner.mobile`, Odoo Sign, WhatsApp module | Not available on the verified runtime | ADR-001, PROJECT_SPEC 4 |
| PROJECT_SPEC 25 "trainer assignment model" open item | Resolved | R8 |

Historical `.docx` files are **not deleted or edited**; the README already
records that they are intentionally left unmodified. This section and
`CLAUDE.md` are the mechanism that prevents them being used as the active
source of truth.

## 9. Acceptance criteria for the clarified requirements

Each criterion is a testable behaviour. **Evidence** names an existing test
(in `custom_addons/training_management/tests/`) or frontend test where one
exists. **Pending** means the behaviour depends on an open decision and no
test may be written until the owner decides; the criterion is stated
conditionally.

| ID | Requirement clarified | Acceptance criterion | Evidence |
|---|---|---|---|
| AC-ALN-01 | GS dashboard, analytics, report generation and approval are Odoo | No Next.js route or `/api/v1` endpoint creates, configures, approves or exports a report or serves an admin dashboard; Odoo menus for Analytics, Reports and Approval exist | PROJECT_SPEC 10.7 forbidden list; ADR-008 (no report endpoints); `test_trainee_cannot_access_report_model` |
| AC-ALN-02 | Submitted response is final | After final submit no edit action or endpoint exists for the trainee; lines cannot be added, changed or deleted; a second submit creates no second record | `test_final_response_lines_cannot_be_added_modified_or_deleted`, `test_duplicate_final_response_prevented_at_db_level`, `test_duplicate_final_response_prevented_by_service`, `test_cannot_edit_after_final_submit` (README) |
| AC-ALN-03 | Post-submit view (status only, current behaviour) | `my-survey/status` returns only `response_id, state, submitted_at, editable` and never answer content | API trainee tests (ADR-006 section 12) |
| AC-ALN-04 | Read-back of own answers (OPD-01) | **Pending.** If approved: a trainee can read only her own final answers and never another trainee's; supervisor and trainer still cannot read any | Isolation tests exist: `test_trainee_cannot_access_another_trainee_response`, `test_supervisor_cannot_access_trainee_response`, `test_trainer_cannot_access_trainee_response` |
| AC-ALN-05 | Survey window | Submit is denied before `survey_open_at` and after `survey_close_at` even when the day is open; the window never changes day state | `test_survey_denied_before_window_opens_even_if_day_open`, `test_survey_denied_after_window_closes_even_if_day_open`, `test_no_automatic_state_transition_from_time_window` |
| AC-ALN-06 | Reminder exclusion and duplicates | A person with a final response is never a pending recipient; a second cron run creates no duplicate row for the same day/role/person/channel/event, enforced by the database | `test_pending_recipients_includes_unsubmitted_trainee_and_supervisor`, `test_duplicate_prevention_second_cron_run_does_not_duplicate`, `test_duplicate_log_row_blocked_at_db_level` |
| AC-ALN-07 | Reminder outside the window | The cron skips a day that is not open or is outside its window | `test_cron_skips_day_outside_survey_window` |
| AC-ALN-08 | Channel fallback and retry | With fallback on, the next channel is tried only after a failure and never after a success; with it off, each enabled channel is attempted independently; automatic retries stop at the configured maximum | `test_fallback_stops_at_first_success`, `test_fallback_tries_next_channel_after_failure`, `test_fallback_disabled_attempts_every_enabled_channel_independently`, `test_retry_budget_exhausted_stops_further_attempts` |
| AC-ALN-09 | Reminder lead time, count, priority values (OPD-03) | **Pending.** If approved: a reminder is sent at the approved lead time before `survey_close_at`, not more than the approved number of times per recipient, in the approved channel order | none |
| AC-ALN-10 | Attendance, absence, late rates | For a day with p on time, l late, a absent: attendance = (p+l)/(p+l+a), absence = a/(p+l+a), late = l/(p+l); a zero denominator returns no value, never 0 | `test_attendance_rates`, ADR-004 section 5 |
| AC-ALN-11 | Survey KPI averages | Category averages ignore skipped and non-rating lines; no valid data returns no value, never 0 | `test_no_valid_data_is_none_not_zero`, `test_no_data_returns_none_not_zero` |
| AC-ALN-12 | Program/course aggregation | Program averages pool every valid response with equal weight and are not an average of course averages | `test_course_kpi_equal_weight_per_response_not_average_of_days`, `test_program_kpi_pools_all_courses_equal_weight` |
| AC-ALN-13 | Response rate | Absent trainees are excluded from the denominator; no attendance recorded returns no value | `test_trainee_response_rate_excludes_absent`, `test_trainee_response_rate_pending_when_no_attendance` |
| AC-ALN-14 | KPI approvals (OPD-04) | **Pending.** If the denominator becomes "enrolled targets", or the mapping, trend period or weighting changes, dashboard and report must both change together and produce identical numbers for identical filters | none |
| AC-ALN-15 | Dashboard/report consistency | The same filters give the same KPI numbers in analytics and in the generated report (single `training.analytics` service) | ADR-004 section 7; report tests |
| AC-ALN-16 | Report filters | Scope filters and toggles are fixed once generated; changing them requires a new version; a new version leaves the old one untouched | `test_generated_report_filters_locked_without_new_version`, `test_new_version_creates_independent_draft`, `test_regenerate_allowed_while_generated_not_approved` |
| AC-ALN-17 | Filter scope (OPD-05) | **Pending.** If additional report filters (trainer, attendance status, survey completion) are approved, the report shows the applied filters and dashboard and report agree | none |
| AC-ALN-18 | Approval is internal, not legal | Only an admin can approve, only from the generated state; approval stores approver and timestamp, locks the record, writes an audit entry; the PDF carries the approver, date/time and stamp; no PKI signature is produced | `test_approve_requires_admin_group`, `test_approve_requires_generated_state`, `test_approve_sets_metadata_and_locks`, `test_approved_report_is_immutable`, `test_report_approval_is_logged` |
| AC-ALN-19 | Export | PDF (Arabic RTL) and Excel export succeed for an approved report; a trainee cannot reach the report or its attachment | `test_export_excel_allowed_after_approval`, `test_trainee_cannot_access_report_attachment`; ADR-010 section 3 real PDF render |
| AC-ALN-20 | Multi-program separation | Program KPIs and reports never mix programs; each program has its own courses, enrollments and reports; the initial data set is the single Quran-school principals program | SRS AC-SRS-009; ORM scoping by `program_id`; a second program (`other_program`) is used in `test_security.py` and the supervisor API tests for record-rule isolation; no test was found that asserts KPI or report separation across two programs |
| AC-ALN-21 | Document authority | `CLAUDE.md`, `README` and `PROJECT_SPEC` all point to this file; the version table in section 2 decodes every `.docx` citation; sections 5 and 8 mark each superseded example | Manual review of this file and its pointers |
| AC-ALN-22 | Report content gap (OPD-08) | **Pending.** If the BRD 11.1/11.2 sections are confirmed as required, the generated course report shows the narrative and comparison sections and the program report shows the five-course comparison and 16-week trend | none |

Missing tests worth adding once the decisions above are made are exactly
the rows whose Evidence is "none" plus a KPI/report two-program separation check
(AC-ALN-20).

## 10. Documentation clarifications applied alongside this file

- Sections 6.E (explicit filter model) and 9 (acceptance criteria) were added in a second review pass.
- `PROJECT_SPEC`: authority block, section 9 routes and section 10.5
  endpoints brought in line with ADR-011, section 25 status, pointers to
  this file. No requirement removed.
- `DEVELOPMENT_PLAN`: authority pointer only.
- `README`, `CLAUDE.md`: pointer to this file.
- ADR-006 (section 12), ADR-010 (section 8), ADR-011: cross-reference to
  OPD-01/OPD-02 and the dashboard-ownership decision. No decision changed.
