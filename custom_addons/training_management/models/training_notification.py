import uuid

from odoo import _, api, fields, models
from odoo.exceptions import UserError

EVENT_DAILY_TASK_REMINDER = "daily_task_reminder"

# Trainee/supervisor/trainer -> the training.day field that holds their
# assigned survey/report for a given day. Reused directly from the M2
# survey-assignment fields (training_day.py) -- this is not a second
# eligibility formula, it is the same "is anything even configured for
# this role on this day" check check_survey_access() already makes.
_SURVEY_FIELD_BY_ROLE = {
    "trainee": "trainee_survey_id",
    "supervisor": "supervisor_survey_id",
    "trainer": "trainer_survey_id",
}


class TrainingNotificationLog(models.Model):
    """Cross-channel reminder log (PROJECT_SPEC section 5: training.notification.log
    is used because neither mail.mail nor sms.sms alone can represent one
    unified, retryable, cross-channel delivery record). This is the single
    place M9's eligibility/duplicate-prevention/retry/traceability rules
    are enforced -- one row per (training day, role, respondent, channel,
    event), never rewritten to add a second attempt at the same channel."""

    _name = "training.notification.log"
    _description = "Training Notification / Reminder Log"
    _order = "create_date desc"

    training_day_id = fields.Many2one(
        "training.day", string="Training Day", required=True, ondelete="restrict"
    )
    # Stored related fields purely for Back-office search/group-by
    # convenience (same rationale as training.attendance.course_id/
    # program_id in M3): plain foreign keys, not derived metrics.
    course_id = fields.Many2one(
        "training.course", related="training_day_id.course_id", store=True
    )
    program_id = fields.Many2one(
        "training.program", related="course_id.program_id", store=True
    )
    respondent_role = fields.Selection(
        selection=[
            ("trainee", "Trainee"),
            ("supervisor", "Supervisor"),
            ("trainer", "Trainer"),
        ],
        required=True,
    )
    partner_id = fields.Many2one(
        "res.partner", string="Recipient", required=True, ondelete="restrict"
    )
    event_type = fields.Selection(
        selection=[(EVENT_DAILY_TASK_REMINDER, "Daily Task Reminder")],
        required=True,
        default=EVENT_DAILY_TASK_REMINDER,
    )
    channel = fields.Selection(
        selection=[
            ("email", "Email"),
            ("sms", "SMS"),
            ("whatsapp", "WhatsApp"),
        ],
        required=True,
    )
    status = fields.Selection(
        selection=[
            ("pending", "Pending"),
            ("sent", "Sent"),
            ("failed", "Failed"),
        ],
        required=True,
        default="pending",
    )
    retry_count = fields.Integer(default=0)
    error_message = fields.Char(readonly=True)
    sent_date = fields.Datetime(readonly=True)
    # Rendered message text, mainly needed for SMS/WhatsApp (which, unlike
    # email, have no standard Odoo record of their own to inspect
    # afterwards in this project's chosen "test" provider mode -- see
    # models/training_notification.py's provider adapters below).
    body = fields.Text(readonly=True)
    # Opaque external id when one exists: a real mail.mail id for email,
    # or a provider message id for SMS/WhatsApp. "Delivery status
    # tracking where supported" (M9 task list) for email is the linked
    # mail_mail_id's own state, exposed as a related field below.
    provider_reference = fields.Char(readonly=True)
    mail_mail_id = fields.Many2one("mail.mail", readonly=True, ondelete="set null")
    mail_state = fields.Selection(
        related="mail_mail_id.state", string="Email Delivery Status", readonly=True
    )

    _day_role_partner_channel_event_uniq = models.Constraint(
        "unique(training_day_id, respondent_role, partner_id, channel, event_type)",
        "Only one reminder log entry is allowed per training day, role, "
        "respondent, channel and event.",
    )

    # ------------------------------------------------------------------
    # Configuration (res.config.settings-backed system parameters --
    # PROJECT_SPEC section 8: "Configuration ... res.config.settings
    # extension for global configuration"; never configurable from
    # Next.js, per PROJECT_SPEC section 16's explicit rule).
    # ------------------------------------------------------------------

    @api.model
    def _get_config(self):
        get_param = self.env["ir.config_parameter"].sudo().get_param

        def get_bool(key, default):
            return get_param("training_management.%s" % key, str(default)) == "True"

        return {
            "reminders_enabled": get_bool("notification_reminders_enabled", True),
            "sms_enabled": get_bool("notification_sms_enabled", False),
            "whatsapp_enabled": get_bool("notification_whatsapp_enabled", False),
            "fallback": get_bool("notification_channel_fallback", False),
            "max_retries": int(
                get_param("training_management.notification_max_retries", "3")
            ),
            "sms_provider_mode": get_param(
                "training_management.sms_provider_mode", "test"
            ),
            "whatsapp_provider_mode": get_param(
                "training_management.whatsapp_provider_mode", "test"
            ),
        }

    @api.model
    def _enabled_channels(self, config):
        channels = ["email"]
        if config["sms_enabled"]:
            channels.append("sms")
        if config["whatsapp_enabled"]:
            channels.append("whatsapp")
        return channels

    # ------------------------------------------------------------------
    # Eligibility (M9 task: "ir.cron eligibility checks" /
    # "Do-not-remind-finalized logic"). Resolves recipients directly from
    # the same relations M1/M2 already define (enrollment, supervisor_id,
    # trainer_ids) and the same survey.user_input final-response check
    # ADR-003's uniqueness constraint already relies on -- no new
    # eligibility formula is invented here.
    # ------------------------------------------------------------------

    @api.model
    def _get_pending_recipients(self, day):
        """[(role, partner)] for this day's respondents who have not yet
        submitted their required task for a role that actually has a
        survey configured. PROJECT_SPEC section 16: "Do not remind users
        whose required task is already final/submitted."."""
        role_partners = {
            "trainee": day.course_id.program_id.enrollment_ids.filtered(
                lambda e: e.state == "active"
            ).mapped("partner_id"),
            "supervisor": day.supervisor_id.partner_id,
            "trainer": day.trainer_ids.mapped("partner_id"),
        }
        UserInput = self.env["survey.user_input"]
        result = []
        for role, partners in role_partners.items():
            if not day[_SURVEY_FIELD_BY_ROLE[role]]:
                continue  # nothing configured for this role on this day
            for partner in partners:
                already_done = UserInput.search_count(
                    [
                        ("training_day_id", "=", day.id),
                        ("respondent_role", "=", role),
                        ("partner_id", "=", partner.id),
                        ("state", "=", "done"),
                    ]
                )
                if already_done:
                    continue
                result.append((role, partner))
        return result

    # ------------------------------------------------------------------
    # Cron entry point
    # ------------------------------------------------------------------

    @api.model
    def cron_send_reminders(self):
        """Called by ir.cron (data/ir_cron_data.xml). Scans every
        training.day currently open and inside its survey window --
        exactly the same two conditions training.day.check_survey_access()
        already enforces for submission itself (M2/M3) -- and dispatches a
        reminder to each pending recipient over every enabled channel."""
        config = self._get_config()
        if not config["reminders_enabled"]:
            return
        now = fields.Datetime.now()
        days = self.env["training.day"].search(
            [
                ("state", "=", "open"),
                ("survey_open_at", "<=", now),
                ("survey_close_at", ">=", now),
            ]
        )
        channels = self._enabled_channels(config)
        for day in days:
            for role, partner in self._get_pending_recipients(day):
                self._dispatch(day, role, partner, channels, config)

    @api.model
    def _dispatch(self, day, role, partner, channels, config):
        """One (day, role, partner) event: attempt each enabled channel in
        priority order. Channel fallback (M9 task list: "Channel fallback
        if policy enables it"): when enabled, stop at the first channel
        that succeeds; when disabled, every enabled channel is attempted
        and tracked independently."""
        for channel in channels:
            log = self._get_or_create_log(day, role, partner, channel)
            if log.status == "sent":
                if config["fallback"]:
                    return
                continue
            if log.status == "failed" and log.retry_count >= config["max_retries"]:
                continue  # retry budget exhausted for this channel
            log._send()
            if log.status == "sent" and config["fallback"]:
                return

    def _get_or_create_log(self, day, role, partner, channel):
        existing = self.search(
            [
                ("training_day_id", "=", day.id),
                ("respondent_role", "=", role),
                ("partner_id", "=", partner.id),
                ("channel", "=", channel),
                ("event_type", "=", EVENT_DAILY_TASK_REMINDER),
            ],
            limit=1,
        )
        if existing:
            return existing
        return self.create(
            {
                "training_day_id": day.id,
                "respondent_role": role,
                "partner_id": partner.id,
                "channel": channel,
                "event_type": EVENT_DAILY_TASK_REMINDER,
            }
        )

    # ------------------------------------------------------------------
    # Sending / provider adapters
    # ------------------------------------------------------------------

    def action_retry(self):
        """Manual retry button (Back-office only). Does not reset
        retry_count, so the configured maximum still applies across manual
        and automatic attempts alike."""
        for log in self:
            if log.status == "sent":
                continue
            log._send()

    def _send(self):
        self.ensure_one()
        try:
            if self.channel == "email":
                self._send_email()
            elif self.channel == "sms":
                self._send_sms()
            elif self.channel == "whatsapp":
                self._send_whatsapp()
            else:
                raise UserError(_("Unknown notification channel: %s") % self.channel)
        except Exception as exc:  # noqa: BLE001 -- a single recipient's
            # provider failure must never abort the whole cron run; every
            # failure is captured here, logged, and left retryable.
            self.write(
                {
                    "status": "failed",
                    "error_message": str(exc),
                    "retry_count": self.retry_count + 1,
                }
            )

    def _send_email(self):
        self.ensure_one()
        if not self.partner_id.email:
            raise UserError(_("Missing email address for %s.") % self.partner_id.name)
        template = self.env.ref(
            "training_management.mail_template_daily_task_reminder"
        )
        mail_id = template.send_mail(self.id, force_send=False)
        self.write(
            {
                "status": "sent",
                "sent_date": fields.Datetime.now(),
                "mail_mail_id": mail_id,
                "provider_reference": str(mail_id),
            }
        )

    def _send_sms(self):
        self.ensure_one()
        config = self._get_config()
        if not self.partner_id.phone:
            raise UserError(_("Missing phone number for %s.") % self.partner_id.name)
        body = self._render_reminder_text()
        if config["sms_provider_mode"] == "odoo_sms":
            # Standard Odoo functionality (the "sms" module, verified
            # present on this Odoo 19 Community runtime -- ADR-001) for a
            # deployment with a real IAP SMS account/credits configured.
            # Never exercised by this project's own automated tests (it
            # would require real IAP network access), per the instruction
            # not to invent provider credentials during development.
            sms = self.env["sms.sms"].sudo().create(
                {
                    "partner_id": self.partner_id.id,
                    "number": self.partner_id.phone,
                    "body": body,
                }
            )
            sms.send()
            reference = "sms.sms:%s" % sms.id
        else:
            # Safe test/mock adapter (default): simulates a successful
            # provider hand-off with no network call and no real
            # credentials, so the reminder pipeline is fully exercised in
            # development/CI without ever sending a real SMS.
            reference = "test-sms-%s" % uuid.uuid4().hex[:12]
        self.write(
            {
                "status": "sent",
                "sent_date": fields.Datetime.now(),
                "body": body,
                "provider_reference": reference,
            }
        )

    def _send_whatsapp(self):
        self.ensure_one()
        config = self._get_config()
        if not self.partner_id.phone:
            raise UserError(_("Missing phone number for %s.") % self.partner_id.name)
        body = self._render_reminder_text()
        if config["whatsapp_provider_mode"] != "test":
            # No standard Odoo WhatsApp connector exists on this Community
            # runtime (ADR-001: the "whatsapp" module is Enterprise-only).
            # A real provider (e.g. WhatsApp Business Cloud API) is a
            # documented future extension point, not implemented here
            # with invented credentials -- see ADR-009.
            raise UserError(
                _("No WhatsApp provider is configured for this deployment.")
            )
        reference = "test-whatsapp-%s" % uuid.uuid4().hex[:12]
        self.write(
            {
                "status": "sent",
                "sent_date": fields.Datetime.now(),
                "body": body,
                "provider_reference": reference,
            }
        )

    def _render_reminder_text(self):
        """Plain-text reminder body for SMS/WhatsApp, rendered in the
        recipient's own language (mail.template's body_html/subject are
        already translate=True and handle this for email automatically;
        this is the equivalent for the two channels that have no
        mail.template rendering involved)."""
        self.ensure_one()
        return self.with_context(
            lang=self.partner_id.lang or self.env.user.lang
        )._build_reminder_text()

    def _build_reminder_text(self):
        self.ensure_one()
        day = self.training_day_id
        return _(
            "Reminder: you have a pending task for %(course)s on %(date)s. "
            "Please complete it in the training portal."
        ) % {"course": day.course_id.name, "date": day.date}
