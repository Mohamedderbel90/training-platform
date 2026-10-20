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

    def test_rejected_attendance_request_stores_nothing(self):
        """A request answered with a validation error must not leave any
        of its writes behind (negative late minutes were stored although
        the API answered 422)."""
        self.authenticate("opapi_supervisor", "Test1234!")
        url = "/training-days/%d/attendance" % self.day.id
        ok = self.api_put(url, {"items": [{"trainee_id": self.enrollment.id, "status": "present"}]})
        self.assertEqual(ok.status_code, 200)
        bad = self.api_put(
            url,
            {"items": [{"trainee_id": self.enrollment.id, "status": "late", "late_minutes": -5}]},
        )
        self.assertEqual(bad.status_code, 422)
        record = self.env["training.attendance"].search(
            [("training_day_id", "=", self.day.id), ("enrollment_id", "=", self.enrollment.id)]
        )
        self.assertEqual((record.status, record.late_minutes), ("present", 0))

    def test_put_attendance_rejected_once_day_closed(self):
        """OPD-12: attendance edits must close once the day reaches a
        final state, mirroring the day-state gate already enforced for
        survey submission."""
        self.authenticate("opapi_supervisor", "Test1234!")
        self.day.action_close()
        resp = self.api_put(
            "/training-days/%d/attendance" % self.day.id,
            {"items": [{"trainee_id": self.enrollment.id, "status": "present"}]},
        )
        self.assertEqual(resp.status_code, 400)

    def test_get_attendance_allowed_after_day_closed(self):
        """Closing the day must not prevent viewing previously recorded
        attendance -- only saving/editing is locked."""
        self.authenticate("opapi_supervisor", "Test1234!")
        put_resp = self.api_put(
            "/training-days/%d/attendance" % self.day.id,
            {"items": [{"trainee_id": self.enrollment.id, "status": "present"}]},
        )
        self.assertEqual(put_resp.status_code, 200)
        self.day.action_close()
        get_resp = self.api_get("/training-days/%d/attendance" % self.day.id)
        self.assertEqual(get_resp.status_code, 200)
        items = {item["trainee_id"]: item for item in get_resp.json()["data"]["items"]}
        self.assertEqual(items[self.enrollment.id]["status"], "present")

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

    # ------------------------------------------------------------------
    # Dashboard attendance summary counts the same population as the
    # attendance list/save endpoints: ACTIVE enrollments only.
    # ------------------------------------------------------------------

    def _dashboard_attendance(self):
        resp = self.api_get("/dashboard/supervisor/days/%d" % self.day.id)
        self.assertEqual(resp.status_code, 200)
        return resp.json()["data"]["attendance"]

    def test_attendance_summary_ignores_inactive_enrollments(self):
        self.other_enrollment.state = "inactive"
        self.authenticate("opapi_supervisor", "Test1234!")
        self.assertEqual(
            self._dashboard_attendance(),
            {"recorded_count": 0, "total_enrolled": 1, "complete": False},
        )
        resp = self.api_put(
            "/training-days/%d/attendance" % self.day.id,
            {"items": [{"trainee_id": self.enrollment.id, "status": "present"}]},
        )
        self.assertEqual(resp.status_code, 200)
        # Matches the attendance list: one active trainee, recorded.
        self.assertEqual(len(resp.json()["data"]["items"]), 1)
        self.assertEqual(
            self._dashboard_attendance(),
            {"recorded_count": 1, "total_enrolled": 1, "complete": True},
        )

    def test_attendance_summary_ignores_records_of_deactivated_enrollment(self):
        self.authenticate("opapi_supervisor", "Test1234!")
        resp = self.api_put(
            "/training-days/%d/attendance" % self.day.id,
            {
                "items": [
                    {"trainee_id": self.enrollment.id, "status": "present"},
                    {"trainee_id": self.other_enrollment.id, "status": "absent"},
                ]
            },
        )
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(self._dashboard_attendance()["complete"])

        # The other trainee's enrollment is deactivated afterwards: the
        # leftover attendance record must not be counted either.
        self.other_enrollment.state = "inactive"
        self.assertEqual(
            self._dashboard_attendance(),
            {"recorded_count": 1, "total_enrolled": 1, "complete": True},
        )

    def test_attendance_summary_incomplete_until_all_active_recorded(self):
        self.authenticate("opapi_supervisor", "Test1234!")
        self.api_put(
            "/training-days/%d/attendance" % self.day.id,
            {"items": [{"trainee_id": self.enrollment.id, "status": "present"}]},
        )
        self.assertEqual(
            self._dashboard_attendance(),
            {"recorded_count": 1, "total_enrolled": 2, "complete": False},
        )
