from odoo.exceptions import ValidationError
from odoo.tests.common import TransactionCase, tagged


@tagged("post_install", "-at_install", "training_management_survey")
class TestTrainingDaySurveyRoles(TransactionCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        admin = cls.env.ref("base.user_admin")
        cls.program = cls.env["training.program"].create(
            {
                "name": "Survey Role Program",
                "start_date": "2026-01-01",
                "end_date": "2026-04-30",
            }
        )
        cls.course = cls.env["training.course"].create(
            {
                "program_id": cls.program.id,
                "name": "Survey Role Course",
                "start_date": "2026-01-01",
                "end_date": "2026-01-31",
            }
        )
        cls.day = cls.env["training.day"].create(
            {
                "course_id": cls.course.id,
                "date": "2026-01-05",
                "start_datetime": "2026-01-05 08:00:00",
                "end_datetime": "2026-01-05 12:00:00",
                "supervisor_id": admin.id,
                "trainer_ids": [(6, 0, [admin.id])],
                "survey_open_at": "2026-01-05 12:00:00",
                "survey_close_at": "2026-01-06 12:00:00",
            }
        )
        cls.trainee_survey = cls.env["survey.survey"].create(
            {"title": "Trainee Survey", "survey_role": "trainee"}
        )
        cls.supervisor_survey = cls.env["survey.survey"].create(
            {"title": "Supervisor Survey", "survey_role": "supervisor"}
        )
        cls.trainer_survey = cls.env["survey.survey"].create(
            {"title": "Trainer Survey", "survey_role": "trainer"}
        )

    def test_correct_role_assignment_accepted(self):
        self.day.write(
            {
                "trainee_survey_id": self.trainee_survey.id,
                "supervisor_survey_id": self.supervisor_survey.id,
                "trainer_survey_id": self.trainer_survey.id,
            }
        )
        self.assertEqual(self.day.trainee_survey_id, self.trainee_survey)
        self.assertEqual(self.day.supervisor_survey_id, self.supervisor_survey)
        self.assertEqual(self.day.trainer_survey_id, self.trainer_survey)

    def test_trainee_field_rejects_wrong_role(self):
        with self.assertRaises(ValidationError):
            self.day.write({"trainee_survey_id": self.supervisor_survey.id})

    def test_supervisor_field_rejects_wrong_role(self):
        with self.assertRaises(ValidationError):
            self.day.write({"supervisor_survey_id": self.trainer_survey.id})

    def test_trainer_field_rejects_wrong_role(self):
        with self.assertRaises(ValidationError):
            self.day.write({"trainer_survey_id": self.trainee_survey.id})

    def test_role_field_rejects_survey_with_no_role(self):
        generic_survey = self.env["survey.survey"].create({"title": "Generic"})
        with self.assertRaises(ValidationError):
            self.day.write({"trainee_survey_id": generic_survey.id})
