from datetime import timedelta
from unittest.mock import patch

from odoo import fields
from odoo.exceptions import AccessError
from odoo.tests.common import TransactionCase, tagged


@tagged("post_install", "-at_install", "training_management_notification")
class TestTrainingNotification(TransactionCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.Log = cls.env["training.notification.log"]
        cls.set_param = cls.env["ir.config_parameter"].sudo().set_param

        def make_user(login, group_xmlid, email=True, phone=True):
            user = (
                cls.env["res.users"]
                .with_context(no_reset_password=True)
                .create(
                    {
                        "name": login,
                        "login": login,
                        "email": "%s@example.com" % login if email else False,
                        "group_ids": [
                            (4, cls.env.ref("base.group_user").id),
                            (4, cls.env.ref(group_xmlid).id),
                        ],
                    }
                )
            )
            if phone:
                user.partner_id.phone = "+10000000000"
            return user

        cls.trainee_user = make_user(
            "notif_trainee", "training_management.group_training_trainee"
        )
        cls.trainee_no_email_user = make_user(
            "notif_trainee_no_email",
            "training_management.group_training_trainee",
            email=False,
        )
        cls.trainee_no_phone_user = make_user(
            "notif_trainee_no_phone",
            "training_management.group_training_trainee",
            phone=False,
        )
        cls.supervisor_user = make_user(
            "notif_supervisor", "training_management.group_training_supervisor"
        )
        cls.trainer_user = make_user(
            "notif_trainer", "training_management.group_training_trainer"
        )

        cls.program = cls.env["training.program"].create(
            {
                "name": "Notification Program",
                "start_date": "2000-01-01",
                "end_date": "2099-12-31",
            }
        )
        cls.course = cls.env["training.course"].create(
            {
                "program_id": cls.program.id,
                "name": "Notification Course",
                "start_date": "2000-01-01",
                "end_date": "2099-12-31",
            }
        )

        cls.trainee_survey = cls.env["survey.survey"].create(
            {"title": "Notif Trainee Survey", "survey_role": "trainee"}
        )
        cls.env["survey.question"].create(
            {
                "survey_id": cls.trainee_survey.id,
                "title": "Rate the trainer",
                "question_type": "simple_choice",
                "kpi_category": "trainer_performance",
            }
        )
        cls.supervisor_survey = cls.env["survey.survey"].create(
            {"title": "Notif Supervisor Survey", "survey_role": "supervisor"}
        )
        cls.env["survey.question"].create(
            {
                "survey_id": cls.supervisor_survey.id,
                "title": "Notes",
                "question_type": "char_box",
            }
        )

        now = fields.Datetime.now()

        def make_day(**overrides):
            values = {
                "course_id": cls.course.id,
                "date": fields.Date.today(),
                "start_datetime": now - timedelta(hours=2),
                "end_datetime": now + timedelta(hours=2),
                "state": "open",
                "supervisor_id": cls.supervisor_user.id,
                "trainer_ids": [(6, 0, [cls.trainer_user.id])],
                "survey_open_at": now - timedelta(hours=1),
                "survey_close_at": now + timedelta(hours=1),
                "trainee_survey_id": cls.trainee_survey.id,
                "supervisor_survey_id": cls.supervisor_survey.id,
            }
            values.update(overrides)
            return cls.env["training.day"].create(values)

        cls.day = make_day()
        cls.make_day = staticmethod(make_day)

        cls.enrollment = cls.env["training.enrollment"].create(
            {
                "program_id": cls.program.id,
                "partner_id": cls.trainee_user.partner_id.id,
            }
        )

    def setUp(self):
        super().setUp()
        # Deterministic defaults for every test: reminders on, only
        # email enabled, no fallback, max 3 retries -- individual tests
        # override only what they need via set_param.
        self.set_param("training_management.notification_reminders_enabled", "True")
        self.set_param("training_management.notification_sms_enabled", "False")
        self.set_param("training_management.notification_whatsapp_enabled", "False")
        self.set_param("training_management.notification_channel_fallback", "False")
        self.set_param("training_management.notification_max_retries", "3")
        self.set_param("training_management.sms_provider_mode", "test")
        self.set_param("training_management.whatsapp_provider_mode", "test")

    # ---- eligibility ----

    def test_pending_recipients_includes_unsubmitted_trainee_and_supervisor(self):
        pending = self.Log._get_pending_recipients(self.day)
        roles_partners = {(role, partner.id) for role, partner in pending}
        self.assertIn(("trainee", self.trainee_user.partner_id.id), roles_partners)
        self.assertIn(
            ("supervisor", self.supervisor_user.partner_id.id), roles_partners
        )
        # No trainer survey configured on this day -- trainer must not
        # appear at all, matching check_survey_access()'s own
        # "nothing configured" rule.
        self.assertNotIn(
            "trainer", {role for role, _partner in pending}
        )

    def test_pending_recipients_excludes_finalized_trainee(self):
        self.env["survey.user_input"].create(
            {
                "survey_id": self.trainee_survey.id,
                "training_day_id": self.day.id,
                "respondent_role": "trainee",
                "partner_id": self.trainee_user.partner_id.id,
                "state": "done",
            }
        )
        pending = self.Log._get_pending_recipients(self.day)
        roles_partners = {(role, partner.id) for role, partner in pending}
        self.assertNotIn(("trainee", self.trainee_user.partner_id.id), roles_partners)
        # Supervisor has not submitted yet -- still eligible.
        self.assertIn(
            ("supervisor", self.supervisor_user.partner_id.id), roles_partners
        )

    def test_pending_recipients_excludes_inactive_enrollment(self):
        self.enrollment.state = "inactive"
        pending = self.Log._get_pending_recipients(self.day)
        roles_partners = {(role, partner.id) for role, partner in pending}
        self.assertNotIn(("trainee", self.trainee_user.partner_id.id), roles_partners)
        self.enrollment.state = "active"

    def test_cron_skips_day_outside_survey_window(self):
        closed_day = self.make_day(
            state="planned",
            survey_open_at=fields.Datetime.now() + timedelta(days=1),
            survey_close_at=fields.Datetime.now() + timedelta(days=2),
        )
        self.Log.cron_send_reminders()
        self.assertFalse(
            self.Log.search([("training_day_id", "=", closed_day.id)])
        )

    # ---- reminders_enabled master switch ----

    def test_master_switch_disabled_sends_nothing(self):
        self.set_param("training_management.notification_reminders_enabled", "False")
        self.Log.cron_send_reminders()
        self.assertFalse(self.Log.search([("training_day_id", "=", self.day.id)]))

    # ---- email channel / duplicate prevention ----

    def test_cron_sends_email_and_creates_log(self):
        self.Log.cron_send_reminders()
        log = self.Log.search(
            [
                ("training_day_id", "=", self.day.id),
                ("respondent_role", "=", "trainee"),
                ("partner_id", "=", self.trainee_user.partner_id.id),
                ("channel", "=", "email"),
            ]
        )
        self.assertEqual(len(log), 1)
        self.assertEqual(log.status, "sent")
        self.assertTrue(log.mail_mail_id)
        self.assertTrue(log.sent_date)

    def test_duplicate_prevention_second_cron_run_does_not_duplicate(self):
        self.Log.cron_send_reminders()
        self.Log.cron_send_reminders()
        logs = self.Log.search(
            [
                ("training_day_id", "=", self.day.id),
                ("respondent_role", "=", "trainee"),
                ("partner_id", "=", self.trainee_user.partner_id.id),
                ("channel", "=", "email"),
            ]
        )
        self.assertEqual(len(logs), 1)
        self.assertEqual(logs.status, "sent")

    def test_duplicate_log_row_blocked_at_db_level(self):
        self.Log.cron_send_reminders()
        with self.assertRaises(Exception):
            self.Log.create(
                {
                    "training_day_id": self.day.id,
                    "respondent_role": "trainee",
                    "partner_id": self.trainee_user.partner_id.id,
                    "channel": "email",
                }
            )

    # ---- provider failure handling / retries ----

    def test_email_failure_missing_address_is_logged_and_retryable(self):
        self.env["training.enrollment"].create(
            {
                "program_id": self.program.id,
                "partner_id": self.trainee_no_email_user.partner_id.id,
            }
        )
        self.Log.cron_send_reminders()
        log = self.Log.search(
            [
                ("training_day_id", "=", self.day.id),
                ("partner_id", "=", self.trainee_no_email_user.partner_id.id),
                ("channel", "=", "email"),
            ]
        )
        self.assertEqual(log.status, "failed")
        self.assertTrue(log.error_message)
        self.assertEqual(log.retry_count, 1)

        # Second cron run retries the same row (not a new one) and
        # increments retry_count again since the address is still missing.
        self.Log.cron_send_reminders()
        self.assertEqual(
            self.Log.search_count(
                [
                    ("training_day_id", "=", self.day.id),
                    ("partner_id", "=", self.trainee_no_email_user.partner_id.id),
                    ("channel", "=", "email"),
                ]
            ),
            1,
        )
        self.assertEqual(log.retry_count, 2)

    def test_retry_budget_exhausted_stops_further_attempts(self):
        self.set_param("training_management.notification_max_retries", "1")
        self.env["training.enrollment"].create(
            {
                "program_id": self.program.id,
                "partner_id": self.trainee_no_email_user.partner_id.id,
            }
        )
        self.Log.cron_send_reminders()  # attempt 1 -> retry_count 1
        self.Log.cron_send_reminders()  # retry_count (1) >= max (1) -> skipped
        log = self.Log.search(
            [
                ("training_day_id", "=", self.day.id),
                ("partner_id", "=", self.trainee_no_email_user.partner_id.id),
                ("channel", "=", "email"),
            ]
        )
        self.assertEqual(log.retry_count, 1)

    def test_manual_retry_succeeds_once_recipient_is_fixed(self):
        self.env["training.enrollment"].create(
            {
                "program_id": self.program.id,
                "partner_id": self.trainee_no_email_user.partner_id.id,
            }
        )
        self.Log.cron_send_reminders()
        log = self.Log.search(
            [
                ("training_day_id", "=", self.day.id),
                ("partner_id", "=", self.trainee_no_email_user.partner_id.id),
                ("channel", "=", "email"),
            ]
        )
        self.assertEqual(log.status, "failed")
        self.trainee_no_email_user.partner_id.email = "fixed@example.com"
        log.action_retry()
        self.assertEqual(log.status, "sent")

    # ---- SMS channel (test provider, opt-in) ----

    def test_sms_disabled_by_default_creates_no_sms_log(self):
        self.Log.cron_send_reminders()
        self.assertFalse(
            self.Log.search(
                [
                    ("training_day_id", "=", self.day.id),
                    ("channel", "=", "sms"),
                ]
            )
        )

    def test_sms_without_provider_is_never_marked_sent(self):
        """C6 / FR-073: with no real SMS provider the attempt is logged as
        failed -- a message that was not sent is never reported as sent."""
        self.set_param("training_management.notification_sms_enabled", "True")
        self.Log.cron_send_reminders()
        log = self.Log.search(
            [
                ("training_day_id", "=", self.day.id),
                ("partner_id", "=", self.trainee_user.partner_id.id),
                ("channel", "=", "sms"),
            ]
        )
        self.assertEqual(log.status, "failed")
        self.assertIn("not sent", log.error_message)
        self.assertFalse(log.provider_reference)
        self.assertFalse(log.sent_date)

    def test_sms_marked_sent_only_after_real_delivery(self):
        self.set_param("training_management.notification_sms_enabled", "True")
        with patch.object(
            self.Log.__class__, "_deliver_sms", return_value="sms.sms:99"
        ):
            self.Log.cron_send_reminders()
        log = self.Log.search(
            [
                ("training_day_id", "=", self.day.id),
                ("partner_id", "=", self.trainee_user.partner_id.id),
                ("channel", "=", "sms"),
            ]
        )
        self.assertEqual(log.status, "sent")
        self.assertEqual(log.provider_reference, "sms.sms:99")
        self.assertTrue(log.body)

    def test_email_delivery_failure_is_logged_failed_not_sent(self):
        """An unreachable mail server must not leave a log row saying
        "sent" for a mail that was only queued."""
        mail_server_cls = type(self.env["ir.mail_server"])
        with patch.object(
            mail_server_cls, "_connect__", side_effect=ConnectionRefusedError("no smtp")
        ):
            self.Log.cron_send_reminders()
        log = self.Log.search(
            [
                ("training_day_id", "=", self.day.id),
                ("partner_id", "=", self.trainee_user.partner_id.id),
                ("channel", "=", "email"),
            ]
        )
        self.assertEqual(log.status, "failed")
        self.assertIn("could not be delivered", log.error_message)
        self.assertEqual(log.retry_count, 1)

    def test_odoo_sms_provider_failure_is_logged_failed(self):
        self.set_param("training_management.notification_sms_enabled", "True")
        self.set_param("training_management.sms_provider_mode", "odoo_sms")
        with patch(
            "odoo.addons.sms.models.sms_sms.SmsSms.send", autospec=True
        ) as send:
            send.side_effect = lambda sms, *a, **k: sms.write({"state": "error"})
            self.Log.cron_send_reminders()
        log = self.Log.search(
            [
                ("training_day_id", "=", self.day.id),
                ("partner_id", "=", self.trainee_user.partner_id.id),
                ("channel", "=", "sms"),
            ]
        )
        self.assertEqual(log.status, "failed")

    def test_sms_missing_phone_fails(self):
        self.set_param("training_management.notification_sms_enabled", "True")
        self.env["training.enrollment"].create(
            {
                "program_id": self.program.id,
                "partner_id": self.trainee_no_phone_user.partner_id.id,
            }
        )
        self.Log.cron_send_reminders()
        log = self.Log.search(
            [
                ("training_day_id", "=", self.day.id),
                ("partner_id", "=", self.trainee_no_phone_user.partner_id.id),
                ("channel", "=", "sms"),
            ]
        )
        self.assertEqual(log.status, "failed")
        self.assertTrue(log.error_message)

    # ---- WhatsApp channel (test-only adapter, no standard connector) ----

    def test_whatsapp_without_provider_is_never_marked_sent(self):
        self.set_param("training_management.notification_whatsapp_enabled", "True")
        self.Log.cron_send_reminders()
        log = self.Log.search(
            [
                ("training_day_id", "=", self.day.id),
                ("partner_id", "=", self.trainee_user.partner_id.id),
                ("channel", "=", "whatsapp"),
            ]
        )
        self.assertEqual(log.status, "failed")
        self.assertFalse(log.provider_reference)

    def test_whatsapp_unconfigured_provider_mode_fails_cleanly(self):
        self.set_param("training_management.notification_whatsapp_enabled", "True")
        self.set_param(
            "training_management.whatsapp_provider_mode", "real_provider_unconfigured"
        )
        self.Log.cron_send_reminders()
        log = self.Log.search(
            [
                ("training_day_id", "=", self.day.id),
                ("partner_id", "=", self.trainee_user.partner_id.id),
                ("channel", "=", "whatsapp"),
            ]
        )
        self.assertEqual(log.status, "failed")
        self.assertIn("WhatsApp", log.error_message)

    # ---- channel fallback policy ----

    def test_fallback_stops_at_first_success(self):
        self.set_param("training_management.notification_sms_enabled", "True")
        self.set_param("training_management.notification_whatsapp_enabled", "True")
        self.set_param("training_management.notification_channel_fallback", "True")
        self.Log.cron_send_reminders()
        logs = self.Log.search(
            [
                ("training_day_id", "=", self.day.id),
                ("partner_id", "=", self.trainee_user.partner_id.id),
            ]
        )
        # Email succeeds first -> sms/whatsapp are never even attempted,
        # so no log row exists for them at all.
        self.assertEqual(logs.mapped("channel"), ["email"])
        self.assertEqual(logs.status, "sent")

    def test_fallback_tries_next_channel_after_failure(self):
        self.set_param("training_management.notification_sms_enabled", "True")
        self.set_param("training_management.notification_whatsapp_enabled", "True")
        self.set_param("training_management.notification_channel_fallback", "True")
        self.trainee_user.partner_id.email = False
        with patch.object(
            self.Log.__class__, "_deliver_sms", return_value="sms:t"
        ), patch.object(self.Log.__class__, "_deliver_whatsapp", return_value="wa:t"):
            self.Log.cron_send_reminders()
        logs = self.Log.search(
            [
                ("training_day_id", "=", self.day.id),
                ("partner_id", "=", self.trainee_user.partner_id.id),
            ]
        )
        by_channel = {log.channel: log.status for log in logs}
        self.assertEqual(by_channel.get("email"), "failed")
        self.assertEqual(by_channel.get("sms"), "sent")
        # WhatsApp is never attempted once SMS succeeded.
        self.assertNotIn("whatsapp", by_channel)

    def test_fallback_disabled_attempts_every_enabled_channel_independently(self):
        self.set_param("training_management.notification_sms_enabled", "True")
        self.set_param("training_management.notification_whatsapp_enabled", "True")
        self.set_param("training_management.notification_channel_fallback", "False")
        with patch.object(
            self.Log.__class__, "_deliver_sms", return_value="sms:t"
        ), patch.object(self.Log.__class__, "_deliver_whatsapp", return_value="wa:t"):
            self.Log.cron_send_reminders()
        logs = self.Log.search(
            [
                ("training_day_id", "=", self.day.id),
                ("partner_id", "=", self.trainee_user.partner_id.id),
            ]
        )
        self.assertEqual(
            {log.channel: log.status for log in logs},
            {"email": "sent", "sms": "sent", "whatsapp": "sent"},
        )

    # ---- bilingual templates (mechanism, not translated content --
    # content is verified by loading ar.po into a real database, same as
    # every other milestone's i18n verification in this project) ----

    def test_email_template_resolves_recipient_language(self):
        self.env["res.lang"]._activate_lang("ar_001")
        self.trainee_user.partner_id.lang = "ar_001"
        self.Log.cron_send_reminders()
        log = self.Log.search(
            [
                ("training_day_id", "=", self.day.id),
                ("partner_id", "=", self.trainee_user.partner_id.id),
                ("channel", "=", "email"),
            ]
        )
        template = self.env.ref(
            "training_management.mail_template_daily_task_reminder"
        )
        langs = template._render_lang(log.ids)
        self.assertEqual(langs[log.id], "ar_001")

    def test_sms_reminder_text_binds_recipient_language_context(self):
        self.env["res.lang"]._activate_lang("ar_001")
        self.trainee_user.partner_id.lang = "ar_001"
        log = self.Log.create(
            {
                "training_day_id": self.day.id,
                "respondent_role": "trainee",
                "partner_id": self.trainee_user.partner_id.id,
                "channel": "sms",
            }
        )
        bound = log.with_context(
            lang=log.partner_id.lang or self.env.user.lang
        )
        self.assertEqual(bound.env.lang, "ar_001")

    # ---- unauthorized access ----

    def test_trainee_cannot_access_notification_log(self):
        self.Log.cron_send_reminders()
        with self.assertRaises(AccessError):
            self.Log.with_user(self.trainee_user).search(
                [("training_day_id", "=", self.day.id)]
            )

    # ---- D1: reminder lead time (configurable, DEC-26) ----

    def test_lead_time_zero_reminds_from_window_open(self):
        self.set_param("training_management.notification_reminder_lead_hours", "0")
        self.Log.cron_send_reminders()
        self.assertTrue(
            self.Log.search_count([("training_day_id", "=", self.day.id)])
        )

    def test_lead_time_waits_until_inside_lead_window(self):
        self.day.survey_close_at = fields.Datetime.now() + timedelta(hours=5)
        self.set_param("training_management.notification_reminder_lead_hours", "1")
        self.Log.cron_send_reminders()
        self.assertFalse(
            self.Log.search_count([("training_day_id", "=", self.day.id)])
        )

    def test_lead_time_sends_inside_lead_window(self):
        self.day.survey_close_at = fields.Datetime.now() + timedelta(hours=5)
        self.set_param("training_management.notification_reminder_lead_hours", "6")
        self.Log.cron_send_reminders()
        self.assertTrue(
            self.Log.search_count([("training_day_id", "=", self.day.id)])
        )

    # ---- C5: the General Supervisor configures reminders ----

    def test_general_supervisor_can_save_reminder_settings(self):
        gs = self.env["res.users"].with_context(no_reset_password=True).create(
            {
                "name": "notif_gs",
                "login": "notif_gs",
                "email": "notif_gs@example.com",
                "group_ids": [
                    (4, self.env.ref("base.group_user").id),
                    (4, self.env.ref("training_management.group_training_admin").id),
                ],
            }
        )
        Settings = self.env["res.config.settings"].with_user(gs)
        settings = Settings.create(
            {
                "training_reminder_lead_hours": 6,
                "training_notification_max_retries": 0,
                "training_reminders_enabled": False,
                "training_reminder_count": 2,
                "training_reminder_interval_hours": 12,
                "training_channel_order": "sms,email,whatsapp",
                "training_notification_sms_enabled": True,
            }
        )
        settings.execute()
        get = self.env["ir.config_parameter"].sudo().get_param
        self.assertEqual(
            get("training_management.notification_reminder_lead_hours"), "6"
        )
        # zero and False are real values, not "unset"
        self.assertEqual(get("training_management.notification_max_retries"), "0")
        self.assertEqual(get("training_management.notification_reminders_enabled"), "False")
        self.assertEqual(get("training_management.notification_reminder_count"), "2")
        self.assertEqual(
            get("training_management.notification_channel_order"), "sms,email,whatsapp"
        )
        self.assertEqual(get("training_management.notification_sms_enabled"), "True")
        values = Settings.default_get(
            ["training_reminder_lead_hours", "training_reminders_enabled",
             "training_channel_order"]
        )
        self.assertEqual(values["training_reminder_lead_hours"], 6)
        self.assertFalse(values["training_reminders_enabled"])
        self.assertEqual(values["training_channel_order"], "sms,email,whatsapp")
        # the cron really stops when reminders are switched off
        self.Log.cron_send_reminders()
        self.assertFalse(self.Log.search_count([("training_day_id", "=", self.day.id)]))

    def test_general_supervisor_can_open_the_settings_page_like_the_web_client(self):
        """The web client reads display_name (and the form fields) on open;
        core searched ir.actions.act_window as the user and failed for a
        General Supervisor without technical rights."""
        gs = self.env["res.users"].with_context(no_reset_password=True).create(
            {
                "name": "notif_gs3",
                "login": "notif_gs3",
                "email": "notif_gs3@example.com",
                "group_ids": [
                    (4, self.env.ref("base.group_user").id),
                    (4, self.env.ref("training_management.group_training_admin").id),
                ],
            }
        )
        Settings = self.env["res.config.settings"].with_user(gs).with_context(
            module="training_management"
        )
        views = Settings.get_views([(False, "form")])
        fields_spec = {
            name: {}
            for name in views["models"]["res.config.settings"]["fields"]
            if name not in ("create_date", "write_date", "create_uid", "write_uid")
        }
        fields_spec["display_name"] = {}
        result = Settings.onchange({}, [], fields_spec)
        self.assertEqual(result["value"]["display_name"], "Settings")

    def test_general_supervisor_cannot_change_other_settings_through_the_page(self):
        gs = self.env["res.users"].with_context(no_reset_password=True).create(
            {
                "name": "notif_gs2",
                "login": "notif_gs2",
                "email": "notif_gs2@example.com",
                "group_ids": [
                    (4, self.env.ref("base.group_user").id),
                    (4, self.env.ref("training_management.group_training_admin").id),
                ],
            }
        )
        self.env["ir.config_parameter"].sudo().set_param("web.base.url", "http://keep.me")
        settings = self.env["res.config.settings"].with_user(gs).create(
            {"training_reminder_lead_hours": 3}
        )
        settings.execute()
        self.assertEqual(
            self.env["ir.config_parameter"].sudo().get_param("web.base.url"), "http://keep.me"
        )

    def test_non_admin_cannot_change_reminder_settings(self):
        with self.assertRaises(AccessError):
            self.env["res.config.settings"].with_user(self.supervisor_user).create(
                {"training_reminder_lead_hours": 3}
            )

    # ---- DEC-26: reminder count, interval and channel order ----

    def _logs(self):
        return self.Log.search(
            [
                ("training_day_id", "=", self.day.id),
                ("partner_id", "=", self.trainee_user.partner_id.id),
            ],
            order="reminder_no, id",
        )

    def test_reminder_count_one_sends_a_single_reminder(self):
        self.Log.cron_send_reminders()
        self.Log.cron_send_reminders()
        self.assertEqual(self._logs().mapped("reminder_no"), [1])

    def test_second_reminder_waits_for_the_interval(self):
        self.set_param("training_management.notification_reminder_count", "2")
        self.set_param("training_management.notification_reminder_interval_hours", "24")
        self.Log.cron_send_reminders()
        self.Log.cron_send_reminders()
        self.assertEqual(self._logs().mapped("reminder_no"), [1])

    def test_second_reminder_is_sent_after_the_interval_and_never_a_third(self):
        self.set_param("training_management.notification_reminder_count", "2")
        self.set_param("training_management.notification_reminder_interval_hours", "0")
        self.Log.cron_send_reminders()
        self.Log.cron_send_reminders()
        self.Log.cron_send_reminders()
        self.assertEqual(self._logs().mapped("reminder_no"), [1, 2])
        self.assertEqual(set(self._logs().mapped("status")), {"sent"})

    def test_no_further_reminder_after_the_final_submission(self):
        self.set_param("training_management.notification_reminder_count", "3")
        self.set_param("training_management.notification_reminder_interval_hours", "0")
        self.Log.cron_send_reminders()
        survey_input = self.env["survey.user_input"].create(
            {
                "survey_id": self.day.trainee_survey_id.id,
                "training_day_id": self.day.id,
                "respondent_role": "trainee",
                "partner_id": self.trainee_user.partner_id.id,
                "state": "in_progress",
            }
        )
        survey_input.write({"state": "done"})
        self.Log.cron_send_reminders()
        self.assertEqual(self._logs().mapped("reminder_no"), [1])

    def test_channel_order_decides_which_channel_goes_first_with_fallback(self):
        self.set_param("training_management.notification_sms_enabled", "True")
        self.set_param("training_management.notification_channel_fallback", "True")
        self.set_param("training_management.notification_channel_order", "sms,email,whatsapp")
        with patch.object(self.Log.__class__, "_deliver_sms", return_value="sms:t"):
            self.Log.cron_send_reminders()
        self.assertEqual(self._logs().mapped("channel"), ["sms"])
        self.assertEqual(self._logs().status, "sent")
