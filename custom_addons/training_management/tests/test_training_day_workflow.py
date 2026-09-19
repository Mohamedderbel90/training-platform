from datetime import timedelta

from odoo import fields
from odoo.exceptions import UserError
from odoo.tests.common import TransactionCase, tagged


@tagged("post_install", "-at_install", "training_management_workflow")
class TestTrainingDayWorkflow(TransactionCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.admin = cls.env.ref("base.user_admin")
        cls.trainee_user = (
            cls.env["res.users"]
            .with_context(no_reset_password=True)
            .create(
                {
                    "name": "Workflow Trainee",
                    "login": "workflow_trainee",
                    "email": "workflow_trainee@example.com",
                    "group_ids": [
                        (4, cls.env.ref("base.group_user").id),
                        (4, cls.env.ref("training_management.group_training_trainee").id),
                    ],
                }
            )
        )
        cls.program = cls.env["training.program"].create(
            {
                "name": "Workflow Program",
                "start_date": "2026-01-01",
                "end_date": "2026-12-31",
            }
        )
        cls.course = cls.env["training.course"].create(
            {
                "program_id": cls.program.id,
                "name": "Workflow Course",
                "start_date": "2026-01-01",
                "end_date": "2026-12-31",
            }
        )
        cls.env["training.enrollment"].create(
            {"program_id": cls.program.id, "partner_id": cls.trainee_user.partner_id.id}
        )
        cls.trainee_survey = cls.env["survey.survey"].create(
            {"title": "Workflow Trainee Survey", "survey_role": "trainee"}
        )

    def _make_day(self, **overrides):
        now = fields.Datetime.now()
        values = {
            "course_id": self.course.id,
            "date": fields.Date.today(),
            "start_datetime": now - timedelta(hours=2),
            "end_datetime": now + timedelta(hours=2),
            "supervisor_id": self.admin.id,
            "trainer_ids": [(6, 0, [self.admin.id])],
            "survey_open_at": now - timedelta(hours=1),
            "survey_close_at": now + timedelta(hours=1),
            "trainee_survey_id": self.trainee_survey.id,
        }
        values.update(overrides)
        return self.env["training.day"].create(values)

    # ---- open/close/postpone/cancel/reopen transitions ----

    def test_planned_to_open(self):
        day = self._make_day(state="planned")
        day.action_open()
        self.assertEqual(day.state, "open")

    def test_open_to_closed(self):
        day = self._make_day(state="open")
        day.action_close()
        self.assertEqual(day.state, "closed")

    def test_closed_to_open_via_reopen(self):
        day = self._make_day(state="closed")
        day.action_reopen()
        self.assertEqual(day.state, "open")

    def test_postponed_to_open(self):
        day = self._make_day(state="postponed")
        day.action_open()
        self.assertEqual(day.state, "open")

    def test_planned_to_postponed(self):
        day = self._make_day(state="planned")
        day.action_postpone()
        self.assertEqual(day.state, "postponed")

    def test_open_to_postponed(self):
        day = self._make_day(state="open")
        day.action_postpone()
        self.assertEqual(day.state, "postponed")

    def test_planned_to_cancelled(self):
        day = self._make_day(state="planned")
        day.action_cancel()
        self.assertEqual(day.state, "cancelled")

    def test_open_to_cancelled(self):
        day = self._make_day(state="open")
        day.action_cancel()
        self.assertEqual(day.state, "cancelled")

    def test_postponed_to_cancelled(self):
        day = self._make_day(state="postponed")
        day.action_cancel()
        self.assertEqual(day.state, "cancelled")

    # ---- illegal transitions ----

    def test_cannot_close_a_planned_day(self):
        day = self._make_day(state="planned")
        with self.assertRaises(UserError):
            day.action_close()

    def test_cannot_open_a_closed_day_via_action_open(self):
        # action_open is for planned/postponed only; closed days use
        # action_reopen specifically (distinct, documented action).
        day = self._make_day(state="closed")
        with self.assertRaises(UserError):
            day.action_open()

    def test_cannot_reopen_a_planned_day(self):
        day = self._make_day(state="planned")
        with self.assertRaises(UserError):
            day.action_reopen()

    def test_cannot_cancel_a_closed_day(self):
        day = self._make_day(state="closed")
        with self.assertRaises(UserError):
            day.action_cancel()

    def test_cannot_transition_a_cancelled_day(self):
        day = self._make_day(state="cancelled")
        with self.assertRaises(UserError):
            day.action_open()
        with self.assertRaises(UserError):
            day.action_postpone()

    def test_direct_write_bypassing_action_methods_still_validated(self):
        # The statusbar widget (and any other direct write) must be
        # validated the same way as the action_* methods.
        day = self._make_day(state="planned")
        with self.assertRaises(UserError):
            day.write({"state": "closed"})

    # ---- survey cannot submit when day is not open ----

    def test_survey_denied_when_day_planned(self):
        day = self._make_day(state="planned")
        with self.assertRaises(UserError):
            day.check_survey_access("trainee", user=self.trainee_user)

    def test_survey_denied_when_day_closed(self):
        day = self._make_day(state="open")
        day.action_close()
        with self.assertRaises(UserError):
            day.check_survey_access("trainee", user=self.trainee_user)

    def test_survey_allowed_when_day_open_and_window_active(self):
        day = self._make_day(state="planned")
        day.action_open()
        survey, partner = day.check_survey_access("trainee", user=self.trainee_user)
        self.assertEqual(survey, self.trainee_survey)
        self.assertEqual(partner, self.trainee_user.partner_id)

    # ---- survey cannot submit outside the configured time window ----
    # (state == 'open' is necessary but not sufficient -- both
    # conditions are required per the M3 decision.)

    def test_survey_denied_before_window_opens_even_if_day_open(self):
        now = fields.Datetime.now()
        day = self._make_day(
            state="open",
            survey_open_at=now + timedelta(hours=1),
            survey_close_at=now + timedelta(hours=2),
        )
        with self.assertRaises(UserError):
            day.check_survey_access("trainee", user=self.trainee_user)

    def test_survey_denied_after_window_closes_even_if_day_open(self):
        now = fields.Datetime.now()
        day = self._make_day(
            state="open",
            survey_open_at=now - timedelta(hours=2),
            survey_close_at=now - timedelta(hours=1),
        )
        with self.assertRaises(UserError):
            day.check_survey_access("trainee", user=self.trainee_user)

    def test_no_automatic_state_transition_from_time_window(self):
        # A day left in 'planned' state must stay 'planned' even though
        # its survey window is currently open -- state changes only via
        # explicit action_*/write(), never automatically from time.
        now = fields.Datetime.now()
        day = self._make_day(
            state="planned",
            survey_open_at=now - timedelta(minutes=30),
            survey_close_at=now + timedelta(minutes=30),
        )
        self.assertEqual(day.state, "planned")
        with self.assertRaises(UserError):
            day.check_survey_access("trainee", user=self.trainee_user)
