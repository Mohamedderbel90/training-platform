from odoo.tests.common import tagged

from .common import OperationalApiCase


@tagged("post_install", "-at_install", "training_management_api")
class TestOperationalApiSupervisor(OperationalApiCase):
    def test_get_attendance(self):
        self.authenticate("opapi_supervisor", "Test1234!")
        resp = self.api_get("/training-days/%d/attendance" % self.day.id)
        self.assertEqual(resp.status_code, 200)
        items = resp.json()["data"]["items"]
        self.assertEqual(len(items), 2)
        trainee_ids = {item["trainee_id"] for item in items}
        self.assertEqual(trainee_ids, {self.enrollment.id, self.other_enrollment.id})

    def test_put_attendance_bulk_upsert(self):
        self.authenticate("opapi_supervisor", "Test1234!")
        resp = self.api_put(
            "/training-days/%d/attendance" % self.day.id,
            {
                "items": [
                    {"trainee_id": self.enrollment.id, "status": "present"},
                    {
                        "trainee_id": self.other_enrollment.id,
                        "status": "late",
                        "late_minutes": 12,
                    },
                ]
            },
        )
        self.assertEqual(resp.status_code, 200)
        items = {item["trainee_id"]: item for item in resp.json()["data"]["items"]}
        self.assertEqual(items[self.enrollment.id]["status"], "present")
        self.assertEqual(items[self.other_enrollment.id]["status"], "late")
        self.assertEqual(items[self.other_enrollment.id]["late_minutes"], 12)

        # Re-PUT (upsert) must update, not duplicate.
        resp2 = self.api_put(
            "/training-days/%d/attendance" % self.day.id,
            {"items": [{"trainee_id": self.enrollment.id, "status": "absent"}]},
        )
        self.assertEqual(resp2.status_code, 200)
        count = self.env["training.attendance"].search_count(
            [("training_day_id", "=", self.day.id), ("enrollment_id", "=", self.enrollment.id)]
        )
        self.assertEqual(count, 1)

    def test_put_attendance_rejects_foreign_enrollment(self):
        self.authenticate("opapi_supervisor", "Test1234!")
        foreign_enrollment = self.env["training.enrollment"].create(
            {
                "program_id": self.other_program.id,
                "partner_id": self.other_trainer_user.partner_id.id,
            }
        )
        resp = self.api_put(
            "/training-days/%d/attendance" % self.day.id,
            {"items": [{"trainee_id": foreign_enrollment.id, "status": "present"}]},
        )
        self.assertEqual(resp.status_code, 422)

    def test_supervisor_cannot_access_unassigned_day(self):
        self.authenticate("opapi_supervisor_other", "Test1234!")
        resp = self.api_get("/training-days/%d/attendance" % self.day.id)
        self.assertEqual(resp.status_code, 403)

    def test_supervisor_survey_submit(self):
        self.authenticate("opapi_supervisor", "Test1234!")
        resp = self.api_post(
            "/training-days/%d/supervisor-survey/submit" % self.day.id,
            {
                "answers": [
                    {"question_id": self.supervisor_question.id, "text": "All good"}
                ]
            },
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["data"]["state"], "submitted")

    def test_get_supervisor_survey_status_not_started(self):
        self.authenticate("opapi_supervisor", "Test1234!")
        resp = self.api_get("/training-days/%d/supervisor-survey/status" % self.day.id)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()["data"]
        self.assertTrue(data["configured"])
        self.assertIsNone(data["response"])
        self.assertTrue(data["can_submit"])

    def test_get_supervisor_survey_status_after_submit(self):
        self.authenticate("opapi_supervisor", "Test1234!")
        self.api_post(
            "/training-days/%d/supervisor-survey/submit" % self.day.id,
            {
                "answers": [
                    {"question_id": self.supervisor_question.id, "text": "All good"}
                ]
            },
        )
        resp = self.api_get("/training-days/%d/supervisor-survey/status" % self.day.id)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()["data"]
        self.assertEqual(data["response"]["state"], "submitted")
        self.assertFalse(data["can_submit"])

    def test_supervisor_survey_status_requires_supervisor_role(self):
        self.authenticate("opapi_trainee", "Test1234!")
        resp = self.api_get("/training-days/%d/supervisor-survey/status" % self.day.id)
        self.assertEqual(resp.status_code, 403)

    def test_supervisor_survey_status_denied_for_unassigned_supervisor(self):
        self.authenticate("opapi_supervisor_other", "Test1234!")
        resp = self.api_get("/training-days/%d/supervisor-survey/status" % self.day.id)
        self.assertEqual(resp.status_code, 403)

    def test_supervisor_cannot_retrieve_detailed_trainee_responses(self):
        self.authenticate("opapi_trainee", "Test1234!")
        self.api_post(
            "/training-days/%d/my-survey/submit" % self.day.id,
            {
                "answers": [
                    {
                        "question_id": self.trainee_question.id,
                        "answer_option_id": self.trainee_options[2].id,
                    }
                ]
            },
        )
        self.authenticate("opapi_supervisor", "Test1234!")
        dashboard_resp = self.api_get("/dashboard/supervisor")
        body = str(dashboard_resp.json())
        self.assertNotIn("Rate the trainer", body)
        self.assertNotIn("answer_option_id", body)
        # No endpoint exists for a supervisor to fetch a trainee's
        # individual response at all.
        no_route_resp = self.api_get(
            "/training-days/%d/my-survey" % self.day.id
        )
        self.assertEqual(no_route_resp.status_code, 403)

    def test_supervisor_cannot_access_trainer_endpoint(self):
        self.authenticate("opapi_supervisor", "Test1234!")
        resp = self.api_get("/training-days/%d/trainer-report" % self.day.id)
        self.assertEqual(resp.status_code, 403)
