# Requirements Alignment and Document Authority

- **Date:** 2026-10-03 (first issued 2026-09-25)
- **Scope:** documentation only. No application code, model, API or UI
  behaviour is changed by this document.
- **Method:** the five `.docx` sources (BRD, SRS, ERD, API Contract, UI
  Flow) were read in full or searched by topic; `PROJECT_SPEC`,
  `DEVELOPMENT_PLAN`, `README`, `RUNBOOK`, ADR-001..011 and the
  implemented addon/frontend were consulted for implementation status.
  Nothing here closes an open product decision; where a source is silent
  the item is listed in section 6 as **open**.

This file is the index of *which document governs what* and where the
documents disagree. The **decisions** that settle the disagreements are in
`docs/DECISIONS.md`; the requirement chain and acceptance criteria are in
`docs/TRACEABILITY.md`; the documentation map is `docs/README.md`. Read it before treating
any `.docx` as an implementation instruction.

---

## 1. Authority hierarchy

| Concern | Governing document | Notes |
|---|---|---|
| Business requirements (what and why) | `BRD_Training_Program_Management_System_v1.4_BILINGUAL_RTL.docx` | Internal version label is **1.2 Final**; see 2. Approved by the project owner on 2026-10-03 in all three roles (DEC-46); the `.docx` approval table itself is unchanged. |
| Detailed functional / system requirements | `SRS_Training_Program_Management_System_v1.5_BILINGUAL_RTL.docx` | Internal label **1.2**. Refines the BRD; must not contradict it. |
| Implementation architecture, ownership boundaries, model names, API conventions | `PROJECT_SPEC_v1.1_BILINGUAL.md` | Wins over older `.docx` on architecture, naming, interface ownership. |
| Execution roadmap | `DEVELOPMENT_PLAN_v1.1_BILINGUAL.md` | Milestones M0..M10. The milestone list inside the API Contract (M1..M7) is superseded. |
| Design decisions and verified runtime deviations | `docs/adr/ADR-001..011` | Later ADRs supersede earlier text where they say so. ADR-001 records the verified Odoo 19 Community runtime. |
| Operations | `docs/RUNBOOK.md` | Deployment/backup/monitoring guidance only. |
| Data model (business intent) | ERD `.docx` | Field/model *names* are governed by `PROJECT_SPEC` sections 4-6 and ADR-001/002, not by the ERD. |
| Operational API contract | API Contract `.docx` for intent; `PROJECT_SPEC` section 10-11 for the endpoint list actually allowed | See 5, item R4. |
| Screens / navigation | UI Flow `.docx` for Odoo menus and screen intent; `PROJECT_SPEC` section 8-9 and ADR-006/011 for the Next.js routes and sidebar actually built | See R11. |
| Visual design | `design/` (approved prototype export and `UI_UX_DESIGN_SPEC.md`) and `noor-login/` (approved login assets) | Visual source of truth only; not requirements. |
| Business decisions settling conflicts and gaps | `docs/DECISIONS.md` | Wins over `.docx` text it supersedes (DEC-xx). |
| Requirement chain, acceptance criteria | `docs/TRACEABILITY.md` | BRD -> SRS -> ERD -> API -> UI -> code. |
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

Moved to `docs/TRACEABILITY.md` (requirement chain and status table). Decisions are in `docs/DECISIONS.md`.

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
- **R11 - Next.js navigation.** UI Flow section 12 and the original
  ADR-011 item lists are superseded: each role has Dashboard and Training
  Days (plus Profile, Logout). The extra pages (`/trainee/program`,
  `/trainee/surveys`, `/supervisor/evaluations`, `/trainer/reports`) were
  folded into Training Days and redirect there (DEC-38).
- **R12 - Runtime deviations.** `res.partner.mobile`, Odoo Sign and
  WhatsApp are absent on the verified Odoo 19 Community runtime (ADR-001).
  ERD/SRS assumptions on those are historical; `PROJECT_SPEC` and ADR-001
  govern.
- **R13 - Multi-program wording.** See 6.G.
- **R14 - Conflicts settled by decision.** State vocabularies, day lifecycle, rate definitions, group names, trainer-report cardinality, Email requirement, AI phase and the standard-field annex are settled in `docs/DECISIONS.md` (DEC-01..DEC-40, section 2 maps each audit finding).

## 6. Focus areas and open product decisions

Open items use the prefix **OPD** and are the only place a decision is
requested. None is closed by this document.

### 6.A General Supervisor dashboard - resolved (R3)

Odoo owns it. Next.js has role dashboards for trainee, supervisor and
trainer only. Adding a GS dashboard to Next.js would be a Change Request.

### 6.B Trainee read-back of a submitted survey - RESOLVED 2026-10-03 (OPD-01)

**Decision (owner instruction, 2026-10-03):** a trainee may read back her *own*
final answers, read-only. Implemented as `GET /api/v1/training-days/{day_id}/my-survey/response`
(`training.day.get_trainee_submitted_response_dto`): trainee role only, day record
rule + enrolment check, search scoped to the caller's own partner and `state = done`
(a draft or another trainee's response is never returned; no draft -> 400).
The Next.js day page opens it in read-only mode ("View Survey"): inputs disabled,
no save/submit actions. Supervisor and trainer access is unchanged. Comments are
included only to the extent the survey's own free-text questions are answers.
Tests: `test_get_my_submitted_response_read_back`, `..._denied_before_submit`,
`..._never_returns_another_trainees_answers`, `..._is_trainee_only_and_day_scoped`.

The text below records the pre-decision analysis.

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

### 6.C Survey window and reminder policy - RESOLVED as configuration (DEC-26)

> Lead time, count, channel order, fallback and retry are Odoo configuration values, not fixed requirements. The table records the analysis behind that decision.

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

### 6.D KPI definitions - RESOLVED (DEC-16..22)

> Response-rate denominator = present or late (DEC-17); weighting = pooled equal weight per response (DEC-19); trend = days within a course, courses within a program (DEC-20); environment = two separate indicators (DEC-21); not-held days excluded (DEC-22). The table records the analysis behind those decisions.

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

### 6.E Report filters and show/hide - RESOLVED (DEC-23, DEC-24)

> Required filters: program, course, date range (trainer on dashboards; "status" = training-day state). BRD 11.1/11.2 sections are required report content. The table records the analysis behind those decisions.

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
covered and tested (security/API test classes). Tightening rules (per-response scores GS-only, no single-response aggregates) are DEC-13/DEC-14.

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

Resolved items point to `docs/DECISIONS.md`; the still-open register is
`docs/DECISIONS.md` section 4.

| ID | Status | Resolution |
|---|---|---|
| OPD-01 | Resolved (owner, 2026-10-03) | Trainee reads back own final answers, read-only (DEC-12) |
| OPD-02 | Resolved | Help, Terms and Privacy texts approved and active; contact email (DEC-50, DEC-51) |
| OPD-03 | Resolved | Reminder policy values are configuration (DEC-26) |
| OPD-04 | Resolved | KPI definitions (DEC-16..22) |
| OPD-05 | Resolved | Filters and show/hide (DEC-23, DEC-24) |
| OPD-06 | Closed | Legal/PKI signature out of scope (DEC-41) |
| OPD-07 | Resolved | BRD approved 2026-10-03 (DEC-46) |
| OPD-08 | Resolved | BRD 11.1/11.2 sections are required (DEC-23); implemented 2026-10-03 |
| OPD-09 | Resolved | Survey wording approved and seeded (DEC-43, `docs/SURVEY_QUESTIONS.md`) |
| OPD-11 | Resolved | Correction policy (DEC-11); reason mandatory, implemented 2026-10-03 |
| OPD-12 | Resolved (owner, 2026-10-01) | Attendance editable only while the day is open (DEC-04) |
| OPD-13 | Resolved | Per-response scores are GS-only (DEC-13); ACL changed 2026-10-03 |
| OPD-14 | Resolved | Saudi PDPL; retention until requested (DEC-44, DEC-45) |
| OPD-15 | **Open** | Expected trainees and concurrent programs not defined; no system limit (DEC-47 withdrawn) |
| OPD-16 | Resolved | RPO 24 h, RTO 4 h on training days (DEC-42, DEC-48) |
| OPD-17 | Resolved | No KPI targets in v1 (DEC-49) |

### 6.L Residual risks recorded by the 2026-09-26 gap analysis (not decisions)

- **Standard Odoo `/survey/start/<token>` route (resolved 2026-10-04, DEC-54: project surveys are refused there; the text below is the original analysis).** Trainees have read access
  to `survey.survey`, which includes its `access_token`; the API never
  returns it. Responses created through the standard route are not linked
  to a training day, so they do not enter KPIs, but they bypass the
  project's window checks. Not changed (survey access mode is Odoo
  configuration); recommended follow-up: set survey access to invitation/
  login-required and hide the token from operational roles.
- **Minimum cohort** (resolved 2026-10-03, DEC-13/DEC-14): per-response
  scores are General Supervisor only; the Assistant Admin role, the only
  one a single-response suppression applied to, was removed (DEC-64). A
  larger threshold would be a configuration value; none is defined.
- **Environment KPI** (resolved 2026-10-03, DEC-21): reported as two
  separate indicators, trainees and supervisor.
- **Cancelled / postponed days** (resolved 2026-10-03, DEC-22): excluded
  from every KPI, attendance and response-rate figure.
- **Group `implied_ids` propagation** that grants a project group is not
  audited (project groups imply only base/survey groups today).
- **Attendance default in the UI** (resolved 2026-10-03, DEC-05): nothing
  is pre-selected; only rows the supervisor chose are saved, and "Mark
  remaining as Present" is an explicit action.
- **Odoo `admin` account and `group_training_admin`.** The model-level
  guards and report approval treat only `group_training_admin` (and `su`)
  as privileged; `base.group_system` alone is not. The go-live administrator
  account must be a member of `group_training_admin`, otherwise Back-office
  approval and response management will be refused.
- **Duplicating a generated/approved report** from the Odoo UI is rejected
  ("A report can only be created as a draft."); the sanctioned path is the
  "New Version" action. Behaviour is correct; the message is terse.
- **`list_db` / listen interface.** `env/odoo.conf` shows `list_db = True`
  and the default interface; harden both for production (infrastructure).
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
| UI Flow section 12 navigation | Superseded for Next.js sidebar | DEC-38, `roleNav.ts` |
| SRS sections 7 (UI-06..09, 14..19) and 8 admin CRUD rows; SRS/ERD/API standard-field annexes; ERD section 9 group names and course `state`; SRS 5.1/5.3/5.4 state lists | Historical | DEC-31, DEC-32, DEC-34, DEC-40 |
| PROJECT_SPEC former routes `/trainee/surveys`, `/trainee/program`, `/supervisor/evaluations`, `/trainer/reports` | Removed | DEC-38 |
| ERD/SRS use of `res.partner.mobile`, Odoo Sign, WhatsApp module | Not available on the verified runtime | ADR-001, PROJECT_SPEC 4 |
| PROJECT_SPEC 25 "trainer assignment model" open item | Resolved | R8 |

Historical `.docx` files are **not deleted or edited**; the README already
records that they are intentionally left unmodified. This section and
`CLAUDE.md` are the mechanism that prevents them being used as the active
source of truth.

## 9. Acceptance criteria for the clarified requirements

Moved to `docs/TRACEABILITY.md` section 4.

## 10. Documentation clarifications applied alongside this file

- 2026-10-03: decisions moved to `docs/DECISIONS.md`; traceability and acceptance criteria moved to `docs/TRACEABILITY.md` (sections 4 and 9 here are pointers); visual reference is `design/`.
- Sections 6.E (explicit filter model) and the acceptance criteria were added in a second review pass.
- `PROJECT_SPEC`: authority block, section 9 routes and section 10.5
  endpoints brought in line with ADR-011, section 25 status, pointers to
  this file. No requirement removed.
- `DEVELOPMENT_PLAN`: authority pointer only.
- `README`, `CLAUDE.md`: pointer to this file.
- ADR-006 (section 12), ADR-010 (section 8), ADR-011: cross-reference to
  OPD-01/OPD-02 and the dashboard-ownership decision. No decision changed.
