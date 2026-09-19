from datetime import timedelta

from odoo import fields
from odoo.tests.common import HttpCase


class OperationalApiCase(HttpCase):
    """Shared fixtures for M4 Operational API controller tests. Not a
    test module itself (no test_* methods here); imported by the
    actual test_operational_api_*.py files."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()

        def make_user(login, group_xmlid, password="Test1234!"):
            user = (
                cls.env["res.users"]
                .with_context(no_reset_password=True)
                .create(
                    {
                        "name": login,
                        "login": login,
                        "password": password,
                        "email": "%s@example.com" % login,
                        "group_ids": [
                            (4, cls.env.ref("base.group_user").id),
                            (4, cls.env.ref(group_xmlid).id),
                        ],
                    }
                )
            )
            user.password = password
            return user

        cls.trainee_user = make_user(
            "opapi_trainee", "training_management.group_training_trainee"
        )
        cls.other_trainee_user = make_user(
            "opapi_trainee_other", "training_management.group_training_trainee"
        )
        cls.supervisor_user = make_user(
            "opapi_supervisor", "training_management.group_training_supervisor"
        )
        cls.other_supervisor_user = make_user(
            "opapi_supervisor_other", "training_management.group_training_supervisor"
        )
        cls.trainer_user = make_user(
            "opapi_trainer", "training_management.group_training_trainer"
        )
        cls.other_trainer_user = make_user(
            "opapi_trainer_other", "training_management.group_training_trainer"
        )

        cls.program = cls.env["training.program"].create(
            {
                "name": "OpAPI Program",
                "start_date": "2026-01-01",
                "end_date": "2026-12-31",
            }
        )
        cls.course = cls.env["training.course"].create(
            {
                "program_id": cls.program.id,
                "name": "OpAPI Course",
                "start_date": "2026-01-01",
                "end_date": "2026-12-31",
            }
        )
        cls.enrollment = cls.env["training.enrollment"].create(
            {
                "program_id": cls.program.id,
                "partner_id": cls.trainee_user.partner_id.id,
            }
        )
        cls.other_enrollment = cls.env["training.enrollment"].create(
            {
                "program_id": cls.program.id,
                "partner_id": cls.other_trainee_user.partner_id.id,
            }
        )

        cls.trainee_survey = cls.env["survey.survey"].create(
            {"title": "OpAPI Trainee Survey", "survey_role": "trainee"}
        )
        cls.trainee_question = cls.env["survey.question"].create(
            {
                "survey_id": cls.trainee_survey.id,
                "title": "Rate the trainer",
                "question_type": "simple_choice",
                "kpi_category": "trainer_performance",
            }
        )
        cls.trainee_options = {}
        for label, value in [
            ("Poor", 1),
            ("Acceptable", 2),
            ("Good", 3),
            ("Very Good", 4),
            ("Excellent", 5),
        ]:
            cls.trainee_options[value] = cls.env["survey.question.answer"].create(
                {
                    "question_id": cls.trainee_question.id,
                    "value": label,
                    "rating_value": value,
                }
            )

        cls.supervisor_survey = cls.env["survey.survey"].create(
            {"title": "OpAPI Supervisor Survey", "survey_role": "supervisor"}
        )
        cls.supervisor_question = cls.env["survey.question"].create(
            {
                "survey_id": cls.supervisor_survey.id,
                "title": "Environment notes",
                "question_type": "char_box",
            }
        )

        cls.trainer_survey = cls.env["survey.survey"].create(
            {"title": "OpAPI Trainer Survey", "survey_role": "trainer"}
        )
        cls.trainer_question = cls.env["survey.question"].create(
            {
                "survey_id": cls.trainer_survey.id,
                "title": "Session notes",
                "question_type": "char_box",
                "constr_mandatory": True,
            }
        )

        now = fields.Datetime.now()
        cls.day = cls.env["training.day"].create(
            {
                "course_id": cls.course.id,
                "date": fields.Date.today(),
                "start_datetime": now - timedelta(hours=1),
                "end_datetime": now + timedelta(hours=3),
                "state": "open",
                "supervisor_id": cls.supervisor_user.id,
                "trainer_ids": [(6, 0, [cls.trainer_user.id])],
                "survey_open_at": now - timedelta(minutes=30),
                "survey_close_at": now + timedelta(hours=2),
                "trainee_survey_id": cls.trainee_survey.id,
                "supervisor_survey_id": cls.supervisor_survey.id,
                "trainer_survey_id": cls.trainer_survey.id,
            }
        )

        # A day the "other_*" users are not assigned/enrolled to, for
        # privacy-boundary tests.
        cls.other_program = cls.env["training.program"].create(
            {
                "name": "OpAPI Other Program",
                "start_date": "2026-01-01",
                "end_date": "2026-12-31",
            }
        )
        cls.other_course = cls.env["training.course"].create(
            {
                "program_id": cls.other_program.id,
                "name": "OpAPI Other Course",
                "start_date": "2026-01-01",
                "end_date": "2026-12-31",
            }
        )
        cls.unrelated_day = cls.env["training.day"].create(
            {
                "course_id": cls.other_course.id,
                "date": fields.Date.today(),
                "start_datetime": now - timedelta(hours=1),
                "end_datetime": now + timedelta(hours=3),
                "state": "open",
                "supervisor_id": cls.other_supervisor_user.id,
                "trainer_ids": [(6, 0, [cls.other_trainer_user.id])],
                "survey_open_at": now - timedelta(minutes=30),
                "survey_close_at": now + timedelta(hours=2),
            }
        )

    def api_post(self, path, json_body=None, headers=None):
        return self.url_open(
            "/api/v1" + path, data=None, json=json_body or {}, headers=headers,
            method="POST",
        )

    def api_get(self, path, headers=None):
        return self.url_open("/api/v1" + path, headers=headers, method="GET")

    def api_put(self, path, json_body=None, headers=None):
        return self.url_open(
            "/api/v1" + path, json=json_body or {}, headers=headers, method="PUT"
        )
