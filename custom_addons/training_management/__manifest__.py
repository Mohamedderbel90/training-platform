{
    "name": "Training Program Management",
    "summary": "Training program management and evaluation system",
    "description": """
Custom addon for the Training Program Management & Evaluation System.

This module is the single custom Odoo addon for the project, per
PROJECT_SPEC_v1.1_BILINGUAL.md. It extends Odoo Standard models
(res.users, res.partner, res.groups, survey.*, mail.*, ir.*) and adds
project-specific business models only where no standard equivalent
exists (training.program, training.course, training.day,
training.enrollment, training.attendance, training.report,
training.audit.log).

Milestone M4 status: adds the Operational API foundation under
/api/v1 -- Odoo-native session authentication
(/api/v1/auth/login|logout|me), role/capability resolution from
project groups, and thin controllers for the trainee/supervisor/
trainer dashboards, trainee survey, supervisor attendance +
evaluation, and trainer daily report, all reusing M2/M3 model/service
logic with no duplicated business rules -- see
docs/adr/ADR-005-operational-api-authentication.md. No administrative
CRUD/workflow endpoints exist here (those remain Odoo Back-office
only).

Milestone M8 status: adds training.report (course/final program
reports), reusing training.analytics (M3) for every KPI/attendance/
response-rate number rather than recomputing them -- generate/approve
workflow, filters/show-hide sections, versioning (approved versions
are immutable; changes create a new version), a QWeb PDF with a
visual approval stamp, and a lightweight xlsxwriter-based Excel
export. Admin/Assistant Admin only in Odoo Back-office; Approve is
further restricted to Admin. See
docs/adr/ADR-008-training-report-approval-and-export.md.

Milestone M9 status: adds training.notification.log, a cross-channel
(email/SMS/WhatsApp) reminder log reused for eligibility, duplicate
-prevention (one row per training day/role/respondent/channel/event),
retry/failure tracking, and delivery-status tracking where a standard
Odoo record exists (mail.mail). Reminders are computed by
training.notification.log.cron_send_reminders() (ir.cron, hourly),
reusing the exact training.day relations/survey-final-response checks
M1-M3 already define -- no new eligibility formula. Email uses
standard mail.template/mail.mail; SMS defaults to a safe test/mock
adapter with the standard IAP-based "sms" module available as an
opt-in production mode; WhatsApp has no standard Odoo connector on
this Community runtime (ADR-001) and is therefore a thin, test-mode
-only adapter. All channel/retry/fallback policy is configured via
res.config.settings, Odoo Back-office only. See
docs/adr/ADR-009-notifications-and-reminder-automation.md.

Milestone M10 status: hardening/E2E/performance/deployment readiness.
Adds training.audit.log (PROJECT_SPEC section 17's remaining
audit-worthy events: training-day reopen, report approval, and
training-group permission changes -- a real gap ADR-004 flagged and
deliberately left open in M3) and the previously-deferred password
recovery endpoints (POST /api/v1/auth/password/forgot|reset, required
by PROJECT_SPEC section 10.1 since M4, using Odoo's own standard
partner signup-token mechanism). See
docs/adr/ADR-010-hardening-and-deployment-readiness.md.
""",
    "version": "19.0.1.0.0",
    "category": "Human Resources/Training",
    "author": "Training Platform Project",
    "license": "LGPL-3",
    "depends": [
        "base",
        "base_setup",
        "mail",
        "sms",
        "survey",
    ],
    "data": [
        "security/security_groups.xml",
        "security/ir.model.access.csv",
        "security/security_rules.xml",
        "views/training_program_views.xml",
        "views/training_course_views.xml",
        "views/training_day_views.xml",
        "views/training_enrollment_views.xml",
        "views/training_attendance_views.xml",
        "views/survey_survey_views.xml",
        "views/survey_question_views.xml",
        "views/survey_user_input_views.xml",
        "views/training_survey_response_kpi_views.xml",
        "views/training_report_views.xml",
        "report/training_report_reports.xml",
        "views/training_notification_views.xml",
        "views/training_audit_log_views.xml",
        "views/res_config_settings_views.xml",
        "data/mail_templates.xml",
        "data/cron.xml",
        "views/menus.xml",
    ],
    "installable": True,
    "application": True,
    "auto_install": False,
}
