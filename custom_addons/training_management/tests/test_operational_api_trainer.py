from odoo.tests.common import tagged

from .common import OperationalApiCase


@tagged("post_install", "-at_install", "training_management_api")
class TestOperationalApiTrainer(OperationalApiCase):
    def test_get_trainer_report_empty(self):
        self.authenticate("opapi_trainer", "Test1234!")
        resp = self.api_get("/training-days/%d/trainer-report" % self.day.id)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()["data"]
        self.assertEqual(data["definition"]["survey_id"], self.trainer_survey.id)
        self.assertIsNone(data["status"]["response"])
        self.assertIsNone(data["answers"])

    def test_save_draft_then_resume(self):
        self.authenticate("opapi_trainer", "Test1234!")
        resp = self.api_put(
            "/training-days/%d/trainer-report/draft" % self.day.id,
            {
                "answers": [
                    {"question_id": self.trainer_question.id, "text": "Draft notes"}
                ]
            },
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["data"]["state"], "in_progress")
        self.assertTrue(resp.json()["data"]["editable"])

        resume_resp = self.api_get("/training-days/%d/trainer-report" % self.day.id)
        resume_data = resume_resp.json()["data"]
        self.assertEqual(resume_data["status"]["response"]["state"], "in_progress")
        self.assertEqual(resume_data["answers"][0]["text"], "Draft notes")

    def test_final_submit(self):
        self.authenticate("opapi_trainer", "Test1234!")
        self.api_put(
            "/training-days/%d/trainer-report/draft" % self.day.id,
            {
                "answers": [
                    {"question_id": self.trainer_question.id, "text": "Notes"}
                ]
            },
        )
        resp = self.api_post(
            "/training-days/%d/trainer-report/submit" % self.day.id, {}
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["data"]["state"], "submitted")
        self.assertFalse(resp.json()["data"]["editable"])

    def test_final_submit_requires_mandatory_question(self):
        self.authenticate("opapi_trainer", "Test1234!")
        resp = self.api_post(
            "/training-days/%d/trainer-report/submit" % self.day.id, {"answers": []}
        )
        self.assertEqual(resp.status_code, 422)

    def test_cannot_edit_after_final_submit(self):
        self.authenticate("opapi_trainer", "Test1234!")
        self.api_post(
            "/training-days/%d/trainer-report/submit" % self.day.id,
            {"answers": [{"question_id": self.trainer_question.id, "text": "Final"}]},
        )
        resp = self.api_put(
            "/training-days/%d/trainer-report/draft" % self.day.id,
            {"answers": [{"question_id": self.trainer_question.id, "text": "Changed"}]},
        )
        # The draft endpoint's own write goes through
        # get_or_create_survey_response -> check_survey_access, which
        # rejects because a final response already exists.
        self.assertEqual(resp.status_code, 400)

    def test_multiple_trainers_have_independent_reports(self):
        self.day.sudo().write(
            {"trainer_ids": [(4, self.other_trainer_user.id)]}
        )
        self.authenticate("opapi_trainer", "Test1234!")
        self.api_put(
            "/training-days/%d/trainer-report/draft" % self.day.id,
            {"answers": [{"question_id": self.trainer_question.id, "text": "Trainer A"}]},
        )
        self.authenticate("opapi_trainer_other", "Test1234!")
        resp = self.api_get("/training-days/%d/trainer-report" % self.day.id)
        # The other trainer's report starts empty -- independent of the
        # first trainer's draft.
        self.assertIsNone(resp.json()["data"]["answers"])

    def test_trainer_cannot_access_unassigned_day(self):
        self.authenticate("opapi_trainer_other", "Test1234!")
        resp = self.api_get("/training-days/%d/trainer-report" % self.day.id)
        self.assertEqual(resp.status_code, 403)

    def test_trainer_cannot_retrieve_detailed_trainee_responses(self):
        self.authenticate("opapi_trainee", "Test1234!")
        self.api_post(
            "/training-days/%d/my-survey/submit" % self.day.id,
            {
                "answers": [
                    {
                        "question_id": self.trainee_question.id,
                        "answer_option_id": self.trainee_options[4].id,
                    }
                ]
            },
        )
        self.authenticate("opapi_trainer", "Test1234!")
        resp = self.api_get("/training-days/%d/my-survey" % self.day.id)
        self.assertEqual(resp.status_code, 403)
        dashboard_resp = self.api_get("/dashboard/trainer")
        self.assertNotIn("Rate the trainer", str(dashboard_resp.json()))

    def test_trainer_cannot_access_supervisor_endpoint(self):
        self.authenticate("opapi_trainer", "Test1234!")
        resp = self.api_get("/training-days/%d/attendance" % self.day.id)
        self.assertEqual(resp.status_code, 403)
