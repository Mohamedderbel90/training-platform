# PROJECT_SPEC.md

## Training Program Management & Evaluation System

**Version:** 1.1  
**Date:** 2026-09-14  
**Status:** Approved implementation baseline  
**Backend / Back-office:** Odoo 19 baseline  
**Operational Frontend:** React + Next.js  
**Database:** PostgreSQL through Odoo ORM only  
**User interface languages:** Arabic (RTL) + English (LTR)
**Codebase language:** English only  

> This file is the implementation source of truth for AI coding and engineering. If an older BRD/SRS/ERD/API/UI document conflicts with this file on architecture, model naming, interface ownership, or implementation boundaries, this file takes precedence. Business requirements remain governed by the latest approved BRD.

---

# 1. Product Goal

Build a multi-program digital system for managing and evaluating training programs. The initial business case is a 4-month / 16-week program for developing female Quran-school managers, with two training days per week, four hours per day, and five specialized courses.

The system must support multiple training programs, daily trainee surveys, supervisor attendance/evaluation, trainer daily reports, analytics, course/final reports, reminders, approvals, auditability, and bilingual Arabic/English operation.

---

# 2. Non-Negotiable Architecture

## 2.1 Odoo owns administration and configuration

The General Supervisor / Admin works primarily in **Odoo Web Client**.

All administrative CRUD/configuration is implemented in Odoo and is **not rebuilt in Next.js** when Odoo can provide the workflow safely.

Odoo Back-office owns:

- Users and roles.
- Programs.
- Courses.
- Training days.
- Trainer/supervisor assignment.
- Enrollments and participant import.
- Survey creation/configuration/versioning.
- Notification templates and schedules.
- Administrative dashboards and analytics.
- Report generation, versioning and approval.
- Audit review.
- Branding and global configuration.

## 2.2 Next.js is an operational portal only

Next.js is used by end users for focused daily tasks:

- Trainee: view assigned/open tasks and submit the daily survey.
- Supervisor: view assigned days, record attendance, submit daily evaluation.
- Trainer: view assigned days, save draft and submit daily report.
- All operational users: login/session/profile/logout.
- Authorized users may read/download outputs only when explicitly required.

**Do not build in Next.js:** Program CRUD, Course CRUD, Training Day CRUD/configuration, user/role administration, Survey Builder, survey version administration, participant import administration, notification configuration, report approval administration, audit administration, or global settings.

## 2.3 Data flow

Administrative flow:

`Admin Browser -> Odoo Web Client -> Odoo Models/Business Logic -> Odoo ORM -> PostgreSQL`

Operational flow:

`User Browser -> Next.js -> Odoo Operational API -> Odoo Models/Business Logic -> Odoo ORM -> PostgreSQL`

Rules:

- Next.js never connects directly to PostgreSQL.
- Next.js never invokes Odoo ORM directly from the browser.
- Odoo is authoritative for validation, permissions and business rules.
- Client-side validation exists only for UX.
- No generic model/domain ORM API is exposed to Next.js.

---

# 2A. Language and Internationalization Requirements

These rules are mandatory from V1.

## Codebase language

All source-code identifiers and technical implementation artifacts must be written in **English only**, including:

- Python classes, methods, variables and model/field technical names.
- TypeScript/JavaScript identifiers, interfaces, types and filenames.
- API paths, request/response property names and internal error codes.
- XML IDs, security IDs, test names and technical comments.
- Git branch/commit conventions and developer-facing implementation notes.

User-facing Arabic or English text may appear only through the localization/translation layer or translatable business content.

## User interface languages

The product is bilingual from V1:

- Arabic (`ar`) with RTL direction.
- English (`en`) with LTR direction.
- Arabic is the default product language unless deployment configuration chooses otherwise.
- Next.js must provide a language switcher and dynamically set `lang` and `dir`.
- No user-facing label, button, validation message, empty state, error message, navigation item or notification text may be hard-coded directly in a component.
- Next.js should use `next-intl` (or an explicitly approved equivalent) with locale message catalogs.
- Odoo custom modules must use Odoo's standard translation mechanism (`i18n` / `.po`) and translatable terms.
- Business fields whose content must exist in both languages should use Odoo translatable fields (`translate=True`) where appropriate instead of parallel `*_ar` / `*_en` fields unless a documented business requirement requires separate values.
- PDF/QWeb reports must be renderable in Arabic or English according to selected report/user language.
- Email, SMS and WhatsApp templates must support both Arabic and English.
- Locale-aware formatting must be used for dates, times and numbers.
- API clients may send `Accept-Language: ar` or `Accept-Language: en`; Odoo remains the source of localized server-side messages.

## Directionality

- Arabic pages/components use `dir="rtl"`.
- English pages/components use `dir="ltr"`.
- Layout must be direction-safe; do not create duplicate Arabic and English page implementations.
- Icons whose meaning depends on direction (back/next arrows, chevrons) must mirror correctly.


# 3. Odoo Standard-First Rule

Implementation priority is mandatory:

1. Use Odoo Standard.
2. Extend/Inherit Odoo Standard.
3. Create Custom only for a real functional gap.

A custom model or field must not duplicate data/functionality already available in `res.*`, `survey.*`, `mail.*`, or `ir.*`.

---

# 4. Odoo Standard Models Used

The following names are treated as verified Odoo 19 baseline names.

| Model | Standard fields relied on | Usage |
|---|---|---|
| `res.users` | `login`, `active`, `partner_id` | Login account; no parallel user model |
| `res.partner` | `name`, `email`, `phone`, `lang`, `active` | Person/contact data. `mobile` was removed after runtime verification against Odoo 19 Community (ADR-001); use `phone` only. |
| `res.groups` | `name`, `implied_ids` | Role grouping; ACL/Record Rules enforce access |
| `survey.survey` | `title`, `access_token`, `question_ids` | Survey template; extended with project metadata |
| `survey.question` | `title`, `survey_id`, `question_type`, `suggested_answer_ids`, `sequence` | Survey questions; extended only for analytics metadata |
| `survey.question.answer` | `value`, `question_id`, `sequence` | Standard answer options |
| `survey.user_input` | `survey_id`, `state`, `start_datetime`, `end_datetime`, `deadline`, `access_token`, `partner_id`, `email`, `user_input_line_ids` | Survey response/attempt; extended with training context |
| `survey.user_input.line` | `user_input_id`, `survey_id`, `question_id`, `answer_type`, `skipped`, `value_char_box`, `value_text_box`, `value_numerical_box`, `value_scale`, `value_date`, `value_datetime`, `suggested_answer_id`, `matrix_row_id` | Standard answer storage; no parallel answer table |
| `mail.thread` | standard mixin fields | Chatter/tracking where needed |
| `mail.activity.mixin` | standard mixin fields | Internal activities where needed |
| `mail.activity` | `activity_type_id`, `res_model_id`/`res_model`, `res_id`, `user_id`, `date_deadline` | Internal activities |
| `mail.template` | `name`, `model_id`, `subject`, `body_html`, `email_from`, `email_to` | Email templates |
| `mail.mail` | `subject`, `body_html`, `email_from`, `email_to`, `state` | Email queue |
| `ir.cron` | Odoo 19 scheduled-action fields | Scheduled reminder execution |
| `ir.attachment` | `name`, `datas`, `mimetype`, `res_model`, `res_id` | Generated PDFs/exports/attachments |
| `ir.actions.report` | `name`, `model`, `report_type`, `report_name`, `paperformat_id` | QWeb PDF report definitions |

### Survey state rule

`survey.user_input.state` uses the Odoo 19 standard values:

- `new`
- `in_progress`
- `done`

The business term **Submitted** maps to `state == 'done'`. Do **not** add a standard-style `submitted` value merely to match UI terminology. Post-submit locking is enforced by project business logic and permissions.

---

# 5. Canonical Custom Model Names

The following names are canonical for this project. Older document variants such as `program.training`, `enrollment.training`, `attendance.training`, `report.training`, or `log.audit.training` are superseded by these names.

| Model | Type | Responsibility |
|---|---|---|
| `training.program` | Custom | Program master, dates, state, branding/program-level settings |
| `training.course` | Custom | Course belonging to a program |
| `training.day` | Custom | Training date/time, state, trainer(s), one supervisor in v1, survey windows |
| `training.enrollment` | Custom | Participant enrollment in program with status/metadata |
| `training.attendance` | Custom | Per trainee/per day Present/Absent/Late + late metadata |
| `training.report` | Custom | Course/program report metadata, versioning and approval; files in `ir.attachment` |
| `training.audit.log` | Minimal Custom | Sensitive events not sufficiently covered by standard tracking |
| `training.trainer.assignment` | Optional Custom | Use only if trainer/day assignment needs metadata beyond a plain Many2many relation |
| `training.notification.log` | Optional Custom | Use only if provider/mail logs cannot represent required cross-channel delivery results |

### Core relationships

- `training.program` 1 -> N `training.course`
- `training.program` 1 -> N `training.enrollment`
- `training.course` 1 -> N `training.day`
- `training.day` -> one supervisor in v1
- `training.day` -> one or more trainers
- `training.day` 1 -> N `training.attendance`
- `survey.user_input` -> `training.day` through custom field `training_day_id`
- `training.report` -> program or course depending report type
- Approved PDF/export -> `ir.attachment`

### Critical constraints

- One enrollment per participant per program.
- One attendance record per enrolled trainee per training day.
- One final trainee survey response per trainee + training day + survey role/type.
- Final survey response cannot be edited by the end user after Odoo state becomes `done`.
- Approved report versions are immutable; later changes create a new report version.
- Historical survey versions/responses must never be rewritten by future survey edits.

---

# 6. Canonical Custom Fields on Standard Models

These are addon-defined fields, not Odoo standard fields. Final Python names must follow this specification unless a migration/design note explicitly changes them.

## `survey.survey`

- `training_program_id`: Many2one -> `training.program`, optional depending ownership.
- `training_course_id`: Many2one -> `training.course`, optional depending ownership.
- `survey_role`: Selection: `trainee`, `supervisor`, `trainer`.
- `version_no`: Integer.
- `previous_version_id`: Many2one -> `survey.survey`.
- `effective_from`: Datetime/Date according to implementation needs.

## `survey.question`

- `kpi_category`: Selection or normalized category used for analytics, e.g. `trainer_performance`, `content`, `environment`.

## `survey.user_input`

- `training_day_id`: Many2one -> `training.day`.
- `respondent_role`: Selection: `trainee`, `supervisor`, `trainer` where useful.
- `is_business_locked`: Boolean, if needed in addition to the standard `state='done'` rule.

Python addon fields do **not** require an `x_` prefix. `x_` is primarily associated with manual/Studio fields.

---

# 7. Roles and Permissions

## 7.1 General Supervisor / Admin

Primary UI: Odoo Web Client.

Can:

- Manage programs/courses/days/enrollments.
- Manage users/roles according to security configuration.
- Configure surveys and versions.
- View detailed trainee survey responses including trainee identity.
- View/manage reports, analytics, approval, exports.
- Configure notifications/settings.
- Review audit events.

## 7.2 Assistant System Admin (optional)

Primary UI: Odoo Web Client.

Gets only explicitly delegated operational administration. By default cannot approve final reports.

## 7.3 Trainee

Primary UI: Next.js.

Can:

- View own training-day tasks.
- Open own active survey.
- Submit once.
- View own submission status.

Cannot:

- See other trainees' answers.
- Edit a final submitted answer.
- Perform admin/configuration CRUD.

## 7.4 Supervisor

Primary UI: Next.js.

Can:

- See assigned days.
- Record/update attendance within allowed business window.
- Submit daily supervisor evaluation.

Cannot:

- See individual trainee survey details.
- Edit training day configuration.
- Modify survey templates.

## 7.5 Trainer

Primary UI: Next.js.

Can:

- See assigned days.
- Save own daily report as draft.
- Submit final daily report.

Cannot:

- See individual trainee evaluation details.
- Modify admin configuration.

### Security implementation

Use:

- `res.groups`
- `ir.model.access`
- `ir.rule`
- server-side ownership checks in business services/controllers where required

Menu visibility is never considered sufficient security.

---

# 8. Odoo Back-office Menu Design

Main menu: **Training Management**

Recommended submenus:

1. Dashboard / Analytics
2. Programs
3. Courses
4. Training Days
5. Enrollments
6. Surveys
7. Reports
8. Notifications
9. Audit
10. Configuration

## Standard-first views

### Programs — `training.program`

- List
- Form
- Search
- Archive, not hard delete when historical data exists

### Courses — `training.course`

- List
- Form
- Search
- Group/filter by program

### Training Days — `training.day`

- List
- Form
- Search
- Calendar
- State buttons/actions: Open / Close / Postpone / Cancel according to business rules

### Enrollments — `training.enrollment`

- List
- Form
- Search
- Import preview wizard when needed

### Surveys

Use Odoo Survey standard UI over:

- `survey.survey`
- `survey.question`
- `survey.user_input`

Do not build a parallel survey builder.

### Reports — `training.report`

- List
- Form
- Search
- QWeb PDF actions
- Approval action
- Version history

### Analytics

Prefer standard:

- Graph
- Pivot
- Search filters

Build a custom Odoo client action/dashboard only when standard analysis views cannot meet a confirmed requirement.

### Configuration

Use `res.config.settings` extension for global configuration. Program-specific settings belong on `training.program`, not global settings.

Odoo 19 XML list views must use `<list>`, not legacy `<tree>`.

---

# 9. Next.js Operational Screens

## Shared

- `/login`
- `/forgot-password`
- `/reset-password`
- `/profile`

## Trainee

- `/trainee`
- `/trainee/training-days/[dayId]/survey`
- `/trainee/training-days/[dayId]/survey/result`

Flow:

`Login -> Dashboard -> Open Day -> Survey -> Validate -> Confirm -> Submit -> Odoo state=done -> Success/read-only`

## Supervisor

- `/supervisor`
- `/supervisor/training-days/[dayId]/attendance`
- `/supervisor/training-days/[dayId]/evaluation`

Flow:

`Login -> Assigned Days -> Attendance -> Save/Update -> Daily Evaluation -> Submit -> Completed`

## Trainer

- `/trainer`
- `/trainer/training-days/[dayId]/report`

Flow:

`Login -> Assigned Days -> Daily Report -> Save Draft -> Resume -> Confirm -> Final Submit`

### Mandatory screen states

Every API-backed screen must support:

- Loading
- Empty
- Validation Error
- Generic Error
- Unauthorized / Forbidden
- Expired Session
- Success

Mobile-first Arabic RTL behavior is mandatory.

---

# 10. Operational API Contract

Base path:

`/api/v1`

Transport:

- HTTPS
- JSON UTF-8
- ISO 8601 timestamps
- Storage in UTC; display according to user/program timezone

### General rule

Only operational endpoints required by Next.js are exposed. Administrative CRUD remains in Odoo Back-office.

## 10.1 Authentication

Required contract:

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/password/forgot`
- `POST /api/v1/auth/password/reset`

Implementation transport decision:

- Prefer an Odoo-owned secure session mechanism and HttpOnly cookies where deployment topology permits.
- Never store long-lived credentials/tokens in `localStorage`.
- If deployment topology requires a token gateway, document it before implementation and preserve the same API contract/permission semantics.

## 10.2 Trainee survey

- `GET /api/v1/training-days/{day_id}/my-survey`
- `GET /api/v1/training-days/{day_id}/my-survey/status`
- `POST /api/v1/training-days/{day_id}/my-survey/submit`

Final submit must support idempotency. No trainee `PATCH` endpoint exists after final submission.

## 10.3 Supervisor attendance/evaluation

- `GET /api/v1/training-days/{day_id}/attendance`
- `PUT /api/v1/training-days/{day_id}/attendance`
- `GET /api/v1/training-days/{day_id}/supervisor-survey`
- `POST /api/v1/training-days/{day_id}/supervisor-survey/submit`

## 10.4 Trainer report

- `GET /api/v1/training-days/{day_id}/trainer-report`
- `PUT /api/v1/training-days/{day_id}/trainer-report/draft`
- `POST /api/v1/training-days/{day_id}/trainer-report/submit`

## 10.5 Operational dashboards

- `GET /api/v1/dashboard/trainee`
- `GET /api/v1/dashboard/supervisor`
- `GET /api/v1/dashboard/trainer`

## 10.6 Authorized downloads

Expose read/download endpoints only if an end-user use case requires them. Report creation, approval and configuration stay in Odoo.

## 10.7 Explicitly forbidden admin endpoints

Do not implement Next.js-facing endpoints for:

- creating/updating/deleting programs
- creating/updating/deleting courses
- creating/updating/configuring training days
- managing users/roles
- managing enrollments/import
- survey builder/version configuration
- report approval/configuration
- notification settings
- audit administration
- global system settings

Any older API-document example showing an admin POST such as `POST /courses/{id}/days` is historical and **must not be implemented for Next.js**.

---

# 11. API Response and Error Rules

Recommended envelope:

```json
{
  "data": {},
  "meta": {"request_id": "req_..."},
  "error": null
}
```

Error envelope:

```json
{
  "data": null,
  "meta": {"request_id": "req_..."},
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "تعذر حفظ البيانات",
    "fields": {}
  }
}
```

HTTP mapping:

- `400` malformed/bad request
- `401` unauthenticated
- `403` forbidden
- `404` resource missing or intentionally not visible
- `409` state/idempotency/business conflict
- `422` validation error
- `429` rate limited
- `500` internal error with `request_id`, no traceback leakage

Security rules:

- No raw Odoo model names/domains accepted from the client for generic ORM execution.
- Do not return trainee identifiers in aggregated trainer/supervisor payloads unless required and authorized.
- Every write is revalidated in Odoo.
- All sensitive operations produce traceable logs/audit metadata.

---

# 12. Survey Rules

Three daily survey/report contexts exist:

1. Trainee survey
   - trainer performance
   - content
   - training environment
   - comments where configured

2. Supervisor evaluation
   - attendance is stored in `training.attendance`
   - environment/execution evaluation may use Odoo Survey

3. Trainer daily report
   - trainee interaction/response
   - scientific/technical notes
   - improvement recommendations
   - may use Odoo Survey if standard structure is adequate

Descriptive rating scale shown to users:

- ضعيف
- مقبول
- جيد
- جيد جداً
- ممتاز

Analytics mapping only:

- ضعيف = 1
- مقبول = 2
- جيد = 3
- جيد جداً = 4
- ممتاز = 5

Survey versioning:

- Once a survey version has historical responses, structural edits that alter meaning/KPI mapping create a new `survey.survey` version.
- Historical `survey.user_input` and `survey.user_input.line` remain linked to original survey/questions.
- Future training days can point to the new version.

---

# 13. Attendance Rules

Attendance statuses only:

- `present`
- `absent`
- `late`

No excused-absence state in v1.

Rules:

- One attendance record per trainee/day.
- Trainee must be enrolled in the program.
- When `late`, late minutes/time may be recorded.
- Late counts as present for general attendance rate and separately in late rate.
- Supervisor may only operate on assigned training days.

---

# 14. KPI and Analytics Rules

Required KPIs include:

- Trainer rating average.
- Content rating average.
- Training environment average.
- Attendance rate.
- Absence rate.
- Late rate.
- Survey response rate.
- Trends/comparisons across days/courses/programs.

Important rules:

- Analytics logic lives in Odoo services/computed/query layer, not in Next.js.
- Next.js only displays returned KPI data.
- Missing data is not treated as zero.
- Weighted averages must document their denominator/weighting.
- Same filters must produce the same numbers in dashboard and report.

---

# 15. Reports and Approval

Report types:

- Course-end report.
- Final program report.

Odoo implementation:

- Metadata/version state: `training.report`.
- PDF rendering: `ir.actions.report` + QWeb.
- Approved PDF storage: `ir.attachment`.
- Excel export: lightweight custom export service if standard export cannot satisfy the required format.

Approval rules:

- General Supervisor approves.
- Approval stores approver and timestamp.
- Approved report version is immutable.
- Re-generation after changes creates a new version.
- Visual approval stamp/signature is included in PDF.
- Odoo Sign is optional only if available/licensed and a stronger signature workflow is required.

---

# 16. Notifications

Channels required by business:

- Email
- SMS
- WhatsApp

Standard-first implementation:

- Email: `mail.template` + `mail.mail`.
- Scheduling: `ir.cron`.
- WhatsApp/SMS: use available supported Odoo connector when suitable; otherwise implement a thin provider adapter.

Rules:

- Do not remind users whose required task is already final/submitted.
- Prevent accidental duplicate sends for the same rule/channel/event.
- Provider failure must be logged and may retry according to a documented policy.
- Notification configuration exists in Odoo, never Next.js.

---

# 17. Audit and Tracking

Use standard Odoo metadata/tracking first:

- `create_uid`
- `create_date`
- `write_uid`
- `write_date`
- `mail.thread` tracking where useful

Use `training.audit.log` only for sensitive events such as:

- exceptional reopen/close of a training day
- exceptional administrative correction of final response/data
- report approval
- permission/role changes
- other events not sufficiently represented by standard tracking

Audit records are not editable from normal user interfaces.

---

# 18. Import and Data Management

Participant import:

- Managed in Odoo Back-office.
- Prefer Odoo standard import where sufficient.
- Build a custom preview/validation wizard only for project-specific checks/preview needs.
- Re-import must not create duplicate users/enrollments.
- Invalid rows should be reported individually without necessarily rejecting the entire file.

Data retention:

- No automatic operational-data deletion by default.
- Use archive/active patterns for historical business entities.
- Daily backup plus periodic recoverable backups are required at infrastructure level.

---

# 19. Non-Functional Requirements

- Arabic RTL first-class support.
- Responsive/mobile-first Next.js operational UI.
- Modern supported browsers.
- HTTPS only in production.
- Server-side RBAC and validation.
- Typical interactive responses should target approximately 2–3 seconds under expected load, excluding third-party provider latency/heavy report generation.
- No secrets in source code.
- Environment-specific configuration through environment variables/Odoo configuration/system parameters as appropriate.
- Structured technical logging with request correlation IDs.
- Backups and restore procedures must be tested.
- PostgreSQL accessed through Odoo ORM; custom SQL only for documented performance needs after review.

---

# 20. Odoo Addon Structure

Recommended custom addon name:

`training_management`

Suggested structure:

```text
training_management/
├── __init__.py
├── __manifest__.py
├── models/
│   ├── __init__.py
│   ├── training_program.py
│   ├── training_course.py
│   ├── training_day.py
│   ├── training_enrollment.py
│   ├── training_attendance.py
│   ├── training_report.py
│   ├── survey_survey.py
│   ├── survey_question.py
│   ├── survey_user_input.py
│   ├── res_config_settings.py
│   └── training_audit_log.py
├── controllers/
│   ├── __init__.py
│   ├── auth.py
│   ├── trainee.py
│   ├── supervisor.py
│   ├── trainer.py
│   └── common.py
├── security/
│   ├── security.xml
│   └── ir.model.access.csv
├── views/
│   ├── training_program_views.xml
│   ├── training_course_views.xml
│   ├── training_day_views.xml
│   ├── training_enrollment_views.xml
│   ├── training_attendance_views.xml
│   ├── training_report_views.xml
│   ├── survey_views.xml
│   ├── res_config_settings_views.xml
│   └── menus.xml
├── report/
│   ├── training_report_actions.xml
│   └── training_report_templates.xml
├── wizard/
│   ├── __init__.py
│   └── enrollment_import_wizard.py
├── data/
│   ├── mail_templates.xml
│   └── cron.xml
└── tests/
    ├── test_security.py
    ├── test_training_models.py
    ├── test_survey_flow.py
    ├── test_attendance.py
    ├── test_reports.py
    └── test_operational_api.py
```

Do not split into many addons prematurely. Split only if a clear deployment/ownership reason appears.

---

# 21. Next.js Project Structure

Recommended high-level structure:

```text
frontend/
├── app/
│   ├── (auth)/
│   ├── trainee/
│   ├── supervisor/
│   ├── trainer/
│   └── api/                # optional same-origin proxy/BFF if adopted
├── components/
│   ├── ui/
│   ├── survey/
│   ├── attendance/
│   └── layout/
├── lib/
│   ├── api/
│   ├── auth/
│   ├── validation/
│   └── i18n/
├── types/
├── tests/
└── public/
```

Rules:

- No Odoo model/business logic duplication in React components.
- API DTOs live in a clear client layer.
- Avoid storing sensitive session material in browser storage.
- Route guards improve UX; Odoo still enforces authorization.
- Arabic RTL layout is the default.

---

# 22. Testing Strategy

## Odoo unit/integration tests

Must cover:

- Model constraints.
- ACLs and Record Rules.
- Program/course/day relationships.
- Enrollment uniqueness.
- Attendance uniqueness and allowed states.
- Survey linkage/versioning.
- Final-submit locking/idempotency.
- Role privacy boundaries.
- KPI calculations.
- Report version/approval immutability.
- Notification eligibility rules.
- Operational API authorization.

## Next.js tests

Must cover:

- Role routing.
- Loading/empty/error/session-expired states.
- Survey validation and final-submit confirmation.
- Attendance editing behavior.
- Trainer draft/final behavior.
- RTL/mobile layouts.

## E2E

At minimum:

1. Admin creates program/course/day in Odoo.
2. Admin enrolls a trainee and assigns supervisor/trainer.
3. Trainee logs into Next.js and submits survey.
4. Supervisor records attendance and submits evaluation.
5. Trainer saves draft then submits daily report.
6. Admin sees results/analytics in Odoo.
7. Admin generates and approves report.
8. Approved PDF can be retrieved according to permissions.
9. Privacy tests prove trainer/supervisor cannot view individual trainee survey details.

---

# 23. Definition of Done

A feature is done only when:

- Business behavior matches BRD/SRS.
- Architecture boundaries in this file are respected.
- Standard Odoo is reused where defined.
- No duplicate admin UI exists in Next.js.
- Security is enforced server-side.
- Required tests pass.
- Arabic RTL behavior is verified where user-facing.
- Error/loading/empty states are implemented.
- Audit/tracking exists for sensitive operations.
- Documentation/migrations are updated if schema/API changes.

---

# 24. Implementation Guardrails for AI Coding

AI coding agents must follow these rules:

1. Read this file before modifying code.
2. Do not invent an Odoo standard field/model. Verify against the actual Odoo 19 runtime/source before use.
3. Use canonical custom names from this file.
4. Do not create a parallel Survey/Answer engine.
5. Do not create a parallel User model.
6. Do not use `hr.attendance` for trainee course attendance.
7. Do not expose generic ORM/XML-RPC-style admin access to Next.js.
8. Do not build admin CRUD/config screens in Next.js unless this spec is explicitly changed.
9. Do not put authoritative KPI calculations in Next.js.
10. Do not mutate approved report versions or historical survey responses.
11. Do not bypass ACL/Record Rules with `sudo()` unless the exact operation has a documented security reason and explicit checks.
12. Do not hard-delete historical business records unless explicitly allowed.
13. Every schema/API change requires updating this spec or a versioned ADR/change note.

---

# 25. Open Technical Decisions Before Production

These decisions do not change business scope but must be finalized during implementation planning:

- Exact production Odoo 19 edition/build and installed optional modules.
- Authentication transport/deployment topology (default preference: secure Odoo-owned session + HttpOnly cookie/same-origin proxy where practical).
- SMS provider.
- WhatsApp provider/available Odoo connector.
- Cloud/hosting provider.
- Backup infrastructure/tooling.
- Whether Odoo Sign is available/licensed and required.
- Whether trainer assignment needs a separate `training.trainer.assignment` model or a Many2many on `training.day` is sufficient.

No coding agent should guess provider-specific details without configuration or an explicit decision.

---

# 26. Delivery Sequence

Implementation follows `DEVELOPMENT_PLAN.md` in the same project documentation set.

The first coding milestone must start with Odoo addon skeleton, security, verified standard schema smoke tests, and core custom models before building Next.js screens.
