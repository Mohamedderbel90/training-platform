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
