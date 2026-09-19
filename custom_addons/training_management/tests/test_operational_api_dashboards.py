from odoo.tests.common import tagged

from .common import OperationalApiCase


@tagged("post_install", "-at_install", "training_management_api")
class TestOperationalApiDashboards(OperationalApiCase):
    def test_trainee_dashboard(self):
        self.authenticate("opapi_trainee", "Test1234!")
        resp = self.api_get("/dashboard/trainee")
        self.assertEqual(resp.status_code, 200)
        days = resp.json()["data"]["days"]
        self.assertEqual(len(days), 1)
        self.assertEqual(days[0]["training_day_id"], self.day.id)
        self.assertIn("survey", days[0])
        self.assertNotIn("attendance", days[0])
        self.assertNotIn("trainer_report", days[0])

    def test_supervisor_dashboard(self):
        self.authenticate("opapi_supervisor", "Test1234!")
        resp = self.api_get("/dashboard/supervisor")
        self.assertEqual(resp.status_code, 200)
        days = resp.json()["data"]["days"]
        self.assertEqual(len(days), 1)
        self.assertEqual(days[0]["training_day_id"], self.day.id)
        self.assertIn("attendance", days[0])
        self.assertIn("survey", days[0])
        # No detailed trainee survey answers on the supervisor dashboard.
        self.assertNotIn("answers", days[0])

    def test_trainer_dashboard(self):
        self.authenticate("opapi_trainer", "Test1234!")
        resp = self.api_get("/dashboard/trainer")
        self.assertEqual(resp.status_code, 200)
        days = resp.json()["data"]["days"]
        self.assertEqual(len(days), 1)
        self.assertEqual(days[0]["training_day_id"], self.day.id)
        self.assertIn("trainer_report", days[0])
        self.assertNotIn("answers", days[0])

    def test_dashboard_excludes_unrelated_days(self):
        self.authenticate("opapi_supervisor", "Test1234!")
        resp = self.api_get("/dashboard/supervisor")
        ids = [d["training_day_id"] for d in resp.json()["data"]["days"]]
        self.assertNotIn(self.unrelated_day.id, ids)

    def test_wrong_role_denied_trainee_on_supervisor_dashboard(self):
        self.authenticate("opapi_trainee", "Test1234!")
        resp = self.api_get("/dashboard/supervisor")
        self.assertEqual(resp.status_code, 403)

    def test_wrong_role_denied_supervisor_on_trainer_dashboard(self):
        self.authenticate("opapi_supervisor", "Test1234!")
        resp = self.api_get("/dashboard/trainer")
        self.assertEqual(resp.status_code, 403)

    def test_no_admin_dashboard_endpoint(self):
        self.authenticate("opapi_trainee", "Test1234!")
        resp = self.api_get("/dashboard/admin")
        self.assertEqual(resp.status_code, 404)

    def test_trainee_dashboard_summary_program_and_stats(self):
        self.authenticate("opapi_trainee", "Test1234!")
        resp = self.api_get("/dashboard/trainee")
        data = resp.json()["data"]

        self.assertEqual(data["program"]["id"], self.program.id)
        self.assertEqual(data["program"]["name"], "OpAPI Program")

        # self.day: one course, one day, a 4-hour (-1h to +3h) session,
        # still "open" (not "closed") -- see common.py's fixture.
        self.assertEqual(
            data["stats"],
            {
                "courses_count": 1,
                "training_days_count": 1,
                "training_hours": 4.0,
                "progress_percent": 0.0,
            },
        )

    def test_trainee_dashboard_summary_next_session(self):
        self.authenticate("opapi_trainee", "Test1234!")
        resp = self.api_get("/dashboard/trainee")
        data = resp.json()["data"]

        self.assertIsNotNone(data["next_session"])
        self.assertEqual(data["next_session"]["training_day_id"], self.day.id)
        self.assertEqual(
            data["next_session"]["trainers"],
            [{"id": self.trainer_user.id, "name": self.trainer_user.name}],
        )
        # Real ownership-scoped survey/course/program fields only --
        # never an invented location or description field.
        self.assertNotIn("location", data["next_session"])

    def test_dashboard_summary_progress_reflects_closed_days(self):
        self.day.write({"state": "closed"})
        self.authenticate("opapi_trainee", "Test1234!")
        resp = self.api_get("/dashboard/trainee")
        data = resp.json()["data"]

        self.assertEqual(data["stats"]["progress_percent"], 100.0)
        # A closed-only day is not "upcoming": no next session to show.
        self.assertIsNone(data["next_session"])

    def test_dashboard_summary_none_with_no_accessible_days(self):
        self.authenticate("opapi_trainee_other", "Test1234!")
        self.enrollment.unlink()
        self.other_enrollment.unlink()
        resp = self.api_get("/dashboard/trainee")
        data = resp.json()["data"]

        self.assertEqual(data["days"], [])
        self.assertIsNone(data["program"])
        self.assertIsNone(data["stats"])
        self.assertIsNone(data["next_session"])
