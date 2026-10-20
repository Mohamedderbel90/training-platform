from datetime import timedelta

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
    # DEC-26: which reminder of the configured count this row is (1..N).
    reminder_no = fields.Integer(default=1, required=True)
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
        "unique(training_day_id, respondent_role, partner_id, channel, event_type, reminder_no)",
        "Only one reminder log entry is allowed per training day, role, "
        "respondent, channel, event and reminder number.",
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
            # D1/DEC-26: hours before survey_close_at from which reminders
            # are sent. 0 (the ADR-009 default) = no lead-time rule, remind
            # from the moment the survey window opens.
            # DEC-26: how many reminders a recipient may get per channel,
            # the minimum hours between two of them, and the channel order.
            "reminder_count": max(
                int(get_param("training_management.notification_reminder_count", "1") or 1), 1
            ),
            "reminder_interval_hours": max(
                int(get_param("training_management.notification_reminder_interval_hours", "24") or 0), 0  # noqa: E501
            ),
            "channel_order": [
                c for c in (
                    get_param("training_management.notification_channel_order", "email,sms,whatsapp")  # noqa: E501
                    or "email,sms,whatsapp"
                ).split(",")
                if c in ("email", "sms", "whatsapp")
            ] or ["email", "sms", "whatsapp"],
            "lead_hours": int(
                get_param("training_management.notification_reminder_lead_hours", "0")
                or 0
            ),
            "sms_provider_mode": get_param(
                "training_management.sms_provider_mode", "test"
            ),
        }

    @api.model
    def _enabled_channels(self, config):
        enabled = {"email"}
        if config["sms_enabled"]:
            enabled.add("sms")
        if config["whatsapp_enabled"]:
            enabled.add("whatsapp")
        order = list(config["channel_order"])
        for channel in ("email", "sms", "whatsapp"):  # never drop a channel
            if channel not in order:
                order.append(channel)
        return [c for c in order if c in enabled]

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
        lead = timedelta(hours=config["lead_hours"])
        for day in days:
            if config["lead_hours"] > 0 and now < day.survey_close_at - lead:
                continue  # too early: remind only inside the lead-time window
            for role, partner in self._get_pending_recipients(day):
                self._dispatch(day, role, partner, channels, config)

    @api.model
    def _dispatch(self, day, role, partner, channels, config):
        """One (day, role, partner) event: attempt each enabled channel in
        priority order. Channel fallback (M9 task list: "Channel fallback
        if policy enables it"): when enabled, stop at the first channel
        that succeeds; when disabled, every enabled channel is attempted
        and tracked independently."""
        now = fields.Datetime.now()
        previous_end = None
        for round_no in range(1, config["reminder_count"] + 1):
            logs = self.search(
                [
                    ("training_day_id", "=", day.id),
                    ("respondent_role", "=", role),
                    ("partner_id", "=", partner.id),
                    ("event_type", "=", EVENT_DAILY_TASK_REMINDER),
                    ("reminder_no", "=", round_no),
                ]
            )
            if round_no > 1:
                # A further reminder only after the previous one is done
                # and the configured interval has passed.
                if previous_end is None or now < previous_end + timedelta(
                    hours=config["reminder_interval_hours"]
                ):
                    return
            if self._round_complete(logs, channels, config):
                previous_end = max(
                    (log.sent_date or log.write_date for log in logs), default=now
                )
                continue
            self._run_round(day, role, partner, channels, config, round_no)
            return  # at most one reminder round per cron run

    def _round_complete(self, logs, channels, config):
        """A round is complete when it can do nothing more: with fallback,
        one channel sent (or every channel exhausted); without fallback,
        every enabled channel sent or exhausted."""
        by_channel = {log.channel: log for log in logs}

        def done(channel):
            log = by_channel.get(channel)
            return bool(log) and (
                log.status == "sent"
                or (log.status == "failed" and log.retry_count >= config["max_retries"])
            )

        if config["fallback"] and any(log.status == "sent" for log in logs):
            return True
        return all(done(channel) for channel in channels)

    def _run_round(self, day, role, partner, channels, config, round_no):
        for channel in channels:
            log = self._get_or_create_log(day, role, partner, channel, round_no)
            if log.status == "sent":
                if config["fallback"]:
                    return
                continue
            if log.status == "failed" and log.retry_count >= config["max_retries"]:
                continue  # retry budget exhausted for this channel
            log._send()
            if log.status == "sent" and config["fallback"]:
                return

    def _get_or_create_log(self, day, role, partner, channel, round_no=1):
        existing = self.search(
            [
                ("training_day_id", "=", day.id),
                ("respondent_role", "=", role),
                ("partner_id", "=", partner.id),
                ("channel", "=", channel),
                ("event_type", "=", EVENT_DAILY_TASK_REMINDER),
                ("reminder_no", "=", round_no),
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
                "reminder_no": round_no,
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
        mail = self.env["mail.mail"].sudo().browse(mail_id)
        # Hand the mail to the mail server now, so the log shows the real
        # outcome instead of "sent" for a mail that is only queued (an
        # unreachable mail server leaves it in the "exception" state).
        mail.send(raise_exception=False)
        if mail.exists() and mail.state == "exception":
            raise UserError(
                _("The email could not be delivered: %s")
                % (mail.failure_reason or _("unknown error"))
            )
        self.write(
            {
                "status": "sent",
                "sent_date": fields.Datetime.now(),
                # a delivered mail may already be deleted (auto_delete)
                "mail_mail_id": mail.exists().id or False,
                "provider_reference": str(mail_id),
            }
        )

    def _send_sms(self):
        self.ensure_one()
        config = self._get_config()
        if not self.partner_id.phone:
            raise UserError(_("Missing phone number for %s.") % self.partner_id.name)
        body = self._render_reminder_text()
        reference = self._deliver_sms(body, config)
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
        reference = self._deliver_whatsapp(body, config)
        self.write(
            {
                "status": "sent",
                "sent_date": fields.Datetime.now(),
                "body": body,
                "provider_reference": reference,
            }
        )

    def _deliver_sms(self, body, config):
        """C6/FR-073: returns a provider reference ONLY after a real
        delivery succeeded (standard Odoo "sms" module with an IAP
        account); otherwise raises, so the log is "failed" and a message
        that was never sent is never reported as sent."""
        self.ensure_one()
        if config["sms_provider_mode"] != "odoo_sms":
            raise UserError(
                _("No SMS provider is configured: the message was not sent.")
            )
        sms = self.env["sms.sms"].sudo().create(
            {
                "partner_id": self.partner_id.id,
                "number": self.partner_id.phone,
                "body": body,
            }
        )
        sms.send(unlink_sent=False, raise_exception=False)
        if sms.state != "sent":
            raise UserError(
                _("The SMS provider did not send the message (%s).")
                % (sms.failure_type or sms.state)
            )
        return "sms.sms:%s" % sms.id

    def _deliver_whatsapp(self, body, config):
        """No standard WhatsApp connector exists on this Community runtime
        (ADR-001), so no message can be sent: always raises (never
        reports success). A real provider is a future extension point."""
        self.ensure_one()
        raise UserError(
            _("No WhatsApp provider is configured: the message was not sent.")
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
