from datetime import timedelta

from odoo import fields
from odoo.exceptions import AccessError, UserError
from odoo.tests.common import TransactionCase, tagged


@tagged("post_install", "-at_install", "training_management_survey")
class TestSurveyUserInput(TransactionCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()

        def make_user(login, group_xmlid):
            return (
                cls.env["res.users"]
                .with_context(no_reset_password=True)
                .create(
                    {
                        "name": login,
                        "login": login,
                        "email": "%s@example.com" % login,
                        "group_ids": [
                            (4, cls.env.ref("base.group_user").id),
                            (4, cls.env.ref(group_xmlid).id),
                        ],
                    }
                )
            )

        cls.trainee_user = make_user(
            "survey_trainee", "training_management.group_training_trainee"
        )
        cls.other_trainee_user = make_user(
            "survey_trainee_other", "training_management.group_training_trainee"
        )
        cls.supervisor_user = make_user(
            "survey_supervisor", "training_management.group_training_supervisor"
        )
        cls.other_supervisor_user = make_user(
            "survey_supervisor_other",
            "training_management.group_training_supervisor",
        )
        cls.trainer_user_1 = make_user(
            "survey_trainer_1", "training_management.group_training_trainer"
        )
        cls.trainer_user_2 = make_user(
            "survey_trainer_2", "training_management.group_training_trainer"
        )
        cls.other_trainer_user = make_user(
            "survey_trainer_other", "training_management.group_training_trainer"
        )

        cls.program = cls.env["training.program"].create(
            {
                "name": "Survey UI Program",
                "start_date": "2026-01-01",
                "end_date": "2026-12-31",
            }
        )
        cls.course = cls.env["training.course"].create(
            {
                "program_id": cls.program.id,
                "name": "Survey UI Course",
                "start_date": "2026-01-01",
                "end_date": "2026-12-31",
            }
        )

        cls.env["training.enrollment"].create(
            {"program_id": cls.program.id, "partner_id": cls.trainee_user.partner_id.id}
        )
        cls.env["training.enrollment"].create(
            {
                "program_id": cls.program.id,
                "partner_id": cls.other_trainee_user.partner_id.id,
            }
        )

        cls.trainee_survey = cls.env["survey.survey"].create(
            {"title": "Daily Trainee Survey", "survey_role": "trainee"}
        )
        cls.supervisor_survey = cls.env["survey.survey"].create(
            {"title": "Daily Supervisor Survey", "survey_role": "supervisor"}
        )
        cls.trainer_survey = cls.env["survey.survey"].create(
            {"title": "Daily Trainer Survey", "survey_role": "trainer"}
        )

        now = fields.Datetime.now()

        cls.day = cls.env["training.day"].create(
            {
                "course_id": cls.course.id,
                "date": fields.Date.today(),
                "start_datetime": now - timedelta(hours=4),
                "end_datetime": now + timedelta(hours=4),
                "state": "open",
                "supervisor_id": cls.supervisor_user.id,
                "trainer_ids": [(6, 0, [cls.trainer_user_1.id, cls.trainer_user_2.id])],
                "survey_open_at": now - timedelta(hours=1),
                "survey_close_at": now + timedelta(hours=1),
                "trainee_survey_id": cls.trainee_survey.id,
                "supervisor_survey_id": cls.supervisor_survey.id,
                "trainer_survey_id": cls.trainer_survey.id,
            }
        )

        # A second day whose window has not opened yet / already closed,
        # for the availability-window tests.
        cls.not_yet_open_day = cls.env["training.day"].create(
            {
                "course_id": cls.course.id,
                "date": fields.Date.today(),
                "start_datetime": now + timedelta(hours=5),
                "end_datetime": now + timedelta(hours=9),
                "state": "open",
                "supervisor_id": cls.supervisor_user.id,
                "trainer_ids": [(6, 0, [cls.trainer_user_1.id])],
                "survey_open_at": now + timedelta(hours=1),
                "survey_close_at": now + timedelta(hours=5),
                "trainee_survey_id": cls.trainee_survey.id,
            }
        )
        cls.closed_day = cls.env["training.day"].create(
            {
                "course_id": cls.course.id,
                "date": fields.Date.today() - timedelta(days=1),
                "start_datetime": now - timedelta(days=1, hours=4),
                "end_datetime": now - timedelta(days=1),
                "state": "open",
                "supervisor_id": cls.supervisor_user.id,
                "trainer_ids": [(6, 0, [cls.trainer_user_1.id])],
                "survey_open_at": now - timedelta(days=1, hours=4),
                "survey_close_at": now - timedelta(days=1),
                "trainee_survey_id": cls.trainee_survey.id,
            }
        )

    # ---- response ownership / get-or-create ----

    def test_trainee_get_or_create_own_response(self):
        response = self.day.get_or_create_survey_response(
            "trainee", user=self.trainee_user
        )
        self.assertEqual(response.respondent_role, "trainee")
        self.assertEqual(response.training_day_id, self.day)
        self.assertEqual(response.partner_id, self.trainee_user.partner_id)
        self.assertEqual(response.survey_id, self.trainee_survey)
        again = self.day.get_or_create_survey_response("trainee", user=self.trainee_user)
        self.assertEqual(again, response)

    def test_supervisor_get_or_create_own_response(self):
        response = self.day.get_or_create_survey_response(
            "supervisor", user=self.supervisor_user
        )
        self.assertEqual(response.respondent_role, "supervisor")
        self.assertEqual(response.partner_id, self.supervisor_user.partner_id)

    def test_trainer_get_or_create_own_response(self):
        response = self.day.get_or_create_survey_response(
            "trainer", user=self.trainer_user_1
        )
        self.assertEqual(response.respondent_role, "trainer")
        self.assertEqual(response.partner_id, self.trainer_user_1.partner_id)

    def test_multiple_trainers_have_independent_responses(self):
        response_1 = self.day.get_or_create_survey_response(
            "trainer", user=self.trainer_user_1
        )
        response_2 = self.day.get_or_create_survey_response(
            "trainer", user=self.trainer_user_2
        )
        self.assertNotEqual(response_1.id, response_2.id)
        self.assertEqual(response_1.partner_id, self.trainer_user_1.partner_id)
        self.assertEqual(response_2.partner_id, self.trainer_user_2.partner_id)

    # ---- duplicate final response prevention ----

    def test_duplicate_final_response_prevented_at_db_level(self):
        response = self.day.get_or_create_survey_response(
            "trainee", user=self.trainee_user
        )
        response.write({"state": "done"})
        with self.assertRaises(Exception):
            self.env["survey.user_input"].create(
                {
                    "survey_id": self.trainee_survey.id,
                    "training_day_id": self.day.id,
                    "respondent_role": "trainee",
                    "partner_id": self.trainee_user.partner_id.id,
                }
            )

    def test_duplicate_final_response_prevented_by_service(self):
        response = self.day.get_or_create_survey_response(
            "trainee", user=self.trainee_user
        )
        response.write({"state": "done"})
        with self.assertRaises(UserError):
            self.day.get_or_create_survey_response("trainee", user=self.trainee_user)

    # ---- in_progress draft / done final / locking ----

    def test_in_progress_draft_behavior(self):
        response = self.day.get_or_create_survey_response(
            "trainer", user=self.trainer_user_1
        )
        response.with_user(self.trainer_user_1).write({"state": "in_progress"})
        question = self.env["survey.question"].create(
            {
                "survey_id": self.trainer_survey.id,
                "title": "Comment",
                "question_type": "char_box",
            }
        )
        line = (
            self.env["survey.user_input.line"]
            .with_user(self.trainer_user_1)
            .create(
                {
                    "user_input_id": response.id,
                    "question_id": question.id,
                    "answer_type": "char_box",
                    "value_char_box": "draft answer",
                }
            )
        )
        self.assertEqual(response.state, "in_progress")
        self.assertEqual(line.value_char_box, "draft answer")

    def test_done_is_final_and_locks_further_writes(self):
        response = self.day.get_or_create_survey_response(
            "trainee", user=self.trainee_user
        )
        response.with_user(self.trainee_user).write({"state": "in_progress"})
        response.with_user(self.trainee_user).write({"state": "done"})
        self.assertEqual(response.state, "done")

        with self.assertRaises(UserError):
            response.with_user(self.trainee_user).write({"state": "new"})

    def test_final_response_lines_cannot_be_added_modified_or_deleted(self):
        response = self.day.get_or_create_survey_response(
            "trainer", user=self.trainer_user_1
        )
        question = self.env["survey.question"].create(
            {
                "survey_id": self.trainer_survey.id,
                "title": "Comment",
                "question_type": "char_box",
            }
        )
        line = self.env["survey.user_input.line"].create(
            {
                "user_input_id": response.id,
                "question_id": question.id,
                "answer_type": "char_box",
                "value_char_box": "before submit",
            }
        )
        response.write({"state": "done"})

        with self.assertRaises(UserError):
            line.with_user(self.trainer_user_1).write({"value_char_box": "changed"})
        with self.assertRaises(UserError):
            line.with_user(self.trainer_user_1).unlink()
        with self.assertRaises(UserError):
            self.env["survey.user_input.line"].with_user(self.trainer_user_1).create(
                {
                    "user_input_id": response.id,
                    "question_id": question.id,
                    "answer_type": "char_box",
                    "value_char_box": "new answer after submit",
                }
            )
        with self.assertRaises(UserError):
            response.with_user(self.trainer_user_1).unlink()

    # ---- survey availability window ----

    def test_availability_before_open(self):
        with self.assertRaises(UserError):
            self.not_yet_open_day.check_survey_access(
                "trainee", user=self.trainee_user
            )

    def test_availability_after_close(self):
        with self.assertRaises(UserError):
            self.closed_day.check_survey_access("trainee", user=self.trainee_user)

    # ---- access denied for unassigned trainer/supervisor ----

    def test_unassigned_supervisor_denied(self):
        with self.assertRaises(AccessError):
            self.day.check_survey_access("supervisor", user=self.other_supervisor_user)

    def test_unassigned_trainer_denied(self):
        with self.assertRaises(AccessError):
            self.day.check_survey_access("trainer", user=self.other_trainer_user)

    # ---- privacy isolation on responses ----

    def test_trainee_cannot_access_another_trainee_response(self):
        response = self.day.get_or_create_survey_response(
            "trainee", user=self.trainee_user
        )
        with self.assertRaises(AccessError):
            response.with_user(self.other_trainee_user).read(["state"])

    def test_supervisor_cannot_access_trainee_response(self):
        trainee_response = self.day.get_or_create_survey_response(
            "trainee", user=self.trainee_user
        )
        with self.assertRaises(AccessError):
            trainee_response.with_user(self.supervisor_user).read(["state"])

    def test_trainer_cannot_access_trainee_response(self):
        trainee_response = self.day.get_or_create_survey_response(
            "trainee", user=self.trainee_user
        )
        with self.assertRaises(AccessError):
            trainee_response.with_user(self.trainer_user_1).read(["state"])

    def test_trainer_cannot_access_co_trainer_response(self):
        response_1 = self.day.get_or_create_survey_response(
            "trainer", user=self.trainer_user_1
        )
        with self.assertRaises(AccessError):
            response_1.with_user(self.trainer_user_2).read(["state"])
