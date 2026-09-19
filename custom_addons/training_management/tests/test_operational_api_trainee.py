from datetime import timedelta

from odoo import fields
from odoo.tests.common import tagged

from .common import OperationalApiCase


@tagged("post_install", "-at_install", "training_management_api")
class TestOperationalApiTrainee(OperationalApiCase):
    def test_get_my_survey_definition(self):
        self.authenticate("opapi_trainee", "Test1234!")
        resp = self.api_get("/training-days/%d/my-survey" % self.day.id)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()["data"]
        self.assertEqual(data["survey_id"], self.trainee_survey.id)
        questions = data["sections"][0]["questions"]
        self.assertEqual(len(questions), 1)
        self.assertEqual(questions[0]["question_id"], self.trainee_question.id)
        self.assertEqual(len(questions[0]["options"]), 5)
        # No internal Odoo fields beyond safe IDs (M4 point 10).
        self.assertNotIn("access_token", data)

    def test_get_my_survey_status_not_started(self):
        self.authenticate("opapi_trainee", "Test1234!")
        resp = self.api_get("/training-days/%d/my-survey/status" % self.day.id)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()["data"]
        self.assertIsNone(data["response"])
        self.assertTrue(data["can_submit"])

    def test_submit_my_survey(self):
        self.authenticate("opapi_trainee", "Test1234!")
        option_id = self.trainee_options[5].id
        resp = self.api_post(
            "/training-days/%d/my-survey/submit" % self.day.id,
            {"answers": [{"question_id": self.trainee_question.id, "answer_option_id": option_id}]},
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()["data"]
        self.assertEqual(data["state"], "submitted")
        self.assertFalse(data["editable"])

        status_resp = self.api_get("/training-days/%d/my-survey/status" % self.day.id)
        status_data = status_resp.json()["data"]
        self.assertEqual(status_data["response"]["state"], "submitted")
        self.assertFalse(status_data["can_submit"])

    def test_repeated_submit_is_idempotent(self):
        self.authenticate("opapi_trainee", "Test1234!")
        first_option = self.trainee_options[5].id
        second_option = self.trainee_options[1].id
        resp1 = self.api_post(
            "/training-days/%d/my-survey/submit" % self.day.id,
            {
                "answers": [
                    {"question_id": self.trainee_question.id, "answer_option_id": first_option}
                ]
            },
        )
        resp2 = self.api_post(
            "/training-days/%d/my-survey/submit" % self.day.id,
            {
                "answers": [
                    {"question_id": self.trainee_question.id, "answer_option_id": second_option}
                ]
            },
        )
        self.assertEqual(resp1.status_code, 200)
        self.assertEqual(resp2.status_code, 200)
        self.assertEqual(
            resp1.json()["data"]["response_id"], resp2.json()["data"]["response_id"]
        )
        response = self.env["survey.user_input"].browse(
            resp1.json()["data"]["response_id"]
        )
        line = response.user_input_line_ids.filtered(
            lambda line: line.question_id == self.trainee_question
        )
        # The second (repeated) submit must not have overwritten the
        # original answer (M4 point 14).
        self.assertEqual(line.suggested_answer_id.id, first_option)

    def test_cannot_submit_missing_required_answer(self):
        self.authenticate("opapi_trainer", "Test1234!")
        resp = self.api_post(
            "/training-days/%d/trainer-report/submit" % self.day.id, {"answers": []}
        )
        self.assertEqual(resp.status_code, 422)

    def test_cannot_access_another_trainees_response(self):
        self.authenticate("opapi_trainee", "Test1234!")
        self.api_post(
            "/training-days/%d/my-survey/submit" % self.day.id,
            {
                "answers": [
                    {
                        "question_id": self.trainee_question.id,
                        "answer_option_id": self.trainee_options[3].id,
                    }
                ]
            },
        )
        # The other trainee logs in and must not see the first
        # trainee's response via the status endpoint.
        self.authenticate("opapi_trainee_other", "Test1234!")
        status_resp = self.api_get("/training-days/%d/my-survey/status" % self.day.id)
        self.assertEqual(status_resp.status_code, 200)
        self.assertIsNone(status_resp.json()["data"]["response"])

    def test_trainee_cannot_access_supervisor_endpoint(self):
        self.authenticate("opapi_trainee", "Test1234!")
        resp = self.api_get("/training-days/%d/attendance" % self.day.id)
        self.assertEqual(resp.status_code, 403)

    def test_trainee_cannot_access_trainer_endpoint(self):
        self.authenticate("opapi_trainee", "Test1234!")
        resp = self.api_get("/training-days/%d/trainer-report" % self.day.id)
        self.assertEqual(resp.status_code, 403)

    def test_trainee_cannot_access_unrelated_day(self):
        self.authenticate("opapi_trainee", "Test1234!")
        resp = self.api_get("/training-days/%d/my-survey" % self.unrelated_day.id)
        self.assertEqual(resp.status_code, 403)

    def test_submit_denied_outside_time_window(self):
        # Move the whole window into the past (close must stay after
        # open, per the model's own constraint) so it's already closed.
        now = fields.Datetime.now()
        self.day.sudo().write(
            {
                "survey_open_at": now - timedelta(hours=2),
                "survey_close_at": now - timedelta(hours=1),
            }
        )
        self.authenticate("opapi_trainee", "Test1234!")
        resp = self.api_post(
            "/training-days/%d/my-survey/submit" % self.day.id,
            {
                "answers": [
                    {
                        "question_id": self.trainee_question.id,
                        "answer_option_id": self.trainee_options[3].id,
                    }
                ]
            },
        )
        self.assertEqual(resp.status_code, 400)

    def test_submit_denied_when_day_not_open(self):
        # open -> closed is a legal transition (open -> planned is not,
        # per the M3 workflow matrix, which applies unconditionally --
        # even to this test).
        self.day.sudo().action_close()
        self.authenticate("opapi_trainee", "Test1234!")
        resp = self.api_post(
            "/training-days/%d/my-survey/submit" % self.day.id,
            {
                "answers": [
                    {
                        "question_id": self.trainee_question.id,
                        "answer_option_id": self.trainee_options[3].id,
                    }
                ]
            },
        )
        self.assertEqual(resp.status_code, 400)
