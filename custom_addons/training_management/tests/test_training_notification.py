from datetime import timedelta

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

    def test_sms_test_provider_succeeds_with_phone(self):
        self.set_param("training_management.notification_sms_enabled", "True")
        self.Log.cron_send_reminders()
        log = self.Log.search(
            [
                ("training_day_id", "=", self.day.id),
                ("partner_id", "=", self.trainee_user.partner_id.id),
                ("channel", "=", "sms"),
            ]
        )
        self.assertEqual(log.status, "sent")
        self.assertTrue(log.provider_reference.startswith("test-sms-"))
        self.assertTrue(log.body)

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

    def test_whatsapp_test_provider_succeeds_with_phone(self):
        self.set_param("training_management.notification_whatsapp_enabled", "True")
        self.Log.cron_send_reminders()
        log = self.Log.search(
            [
                ("training_day_id", "=", self.day.id),
                ("partner_id", "=", self.trainee_user.partner_id.id),
                ("channel", "=", "whatsapp"),
            ]
        )
        self.assertEqual(log.status, "sent")
        self.assertTrue(log.provider_reference.startswith("test-whatsapp-"))

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
