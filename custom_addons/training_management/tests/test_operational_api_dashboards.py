from datetime import timedelta

from odoo import fields
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

    # ------------------------------------------------------------------
    # S1-B / ADR-011 additive fields and the single-day endpoint.
    # ------------------------------------------------------------------

    def _expected_trainers(self):
        return [{"id": self.trainer_user.id, "name": self.trainer_user.name}]

    def test_trainers_present_on_every_dashboard_entry(self):
        for login, role in (
            ("opapi_trainee", "trainee"),
            ("opapi_supervisor", "supervisor"),
            ("opapi_trainer", "trainer"),
        ):
            self.authenticate(login, "Test1234!")
            data = self.api_get("/dashboard/%s" % role).json()["data"]
            self.assertTrue(data["days"], role)
            for entry in data["days"]:
                self.assertEqual(entry["trainers"], self._expected_trainers(), role)
            # next_session keeps exactly the same trainers payload.
            self.assertEqual(
                data["next_session"]["trainers"], self._expected_trainers(), role
            )

    def test_dashboard_summary_program_state_and_courses(self):
        second_course = self.env["training.course"].create(
            {
                "program_id": self.program.id,
                "name": "OpAPI Course 2",
                "sequence": 20,
                "start_date": "2026-01-01",
                "end_date": "2026-12-31",
            }
        )
        now = fields.Datetime.now()
        self.env["training.day"].create(
            {
                "course_id": second_course.id,
                "date": fields.Date.today() - timedelta(days=1),
                "start_datetime": now - timedelta(days=1, hours=2),
                "end_datetime": now - timedelta(days=1),
                "state": "closed",
                "supervisor_id": self.supervisor_user.id,
                "trainer_ids": [(6, 0, [self.trainer_user.id])],
                "survey_open_at": now - timedelta(days=1, hours=1),
                "survey_close_at": now - timedelta(days=1),
            }
        )
        self.program.write({"state": "active"})
        self.authenticate("opapi_trainee", "Test1234!")
        data = self.api_get("/dashboard/trainee").json()["data"]

        self.assertEqual(data["program"]["state"], "active")
        self.assertEqual(
            data["program"]["courses"],
            [
                {
                    "id": self.course.id,
                    "name": "OpAPI Course",
                    "sequence": 10,
                    "training_days_count": 1,
                    "closed_days_count": 0,
                    "training_hours": 4.0,
                },
                {
                    "id": second_course.id,
                    "name": "OpAPI Course 2",
                    "sequence": 20,
                    "training_days_count": 1,
                    "closed_days_count": 1,
                    "training_hours": 2.0,
                },
            ],
        )
        # Same formula as stats.training_hours: per-course hours add up.
        self.assertEqual(data["stats"]["training_hours"], 6.0)
        # No invented course status.
        for course in data["program"]["courses"]:
            self.assertNotIn("state", course)

    def test_dashboard_courses_are_role_scoped(self):
        # A day of the same program the supervisor is NOT assigned to
        # must not be counted in their course breakdown.
        now = fields.Datetime.now()
        self.env["training.day"].create(
            {
                "course_id": self.course.id,
                "date": fields.Date.today() + timedelta(days=2),
                "start_datetime": now + timedelta(days=2),
                "end_datetime": now + timedelta(days=2, hours=1),
                "state": "planned",
                "supervisor_id": self.other_supervisor_user.id,
                "trainer_ids": [(6, 0, [self.trainer_user.id])],
                "survey_open_at": now + timedelta(days=2),
                "survey_close_at": now + timedelta(days=2, hours=1),
            }
        )
        self.authenticate("opapi_supervisor", "Test1234!")
        data = self.api_get("/dashboard/supervisor").json()["data"]
        self.assertEqual(len(data["program"]["courses"]), 1)
        self.assertEqual(data["program"]["courses"][0]["training_days_count"], 1)

    def test_single_day_trainee(self):
        self.authenticate("opapi_trainee", "Test1234!")
        resp = self.api_get("/dashboard/trainee/days/%d" % self.day.id)
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertIsNone(body["error"])
        entry = body["data"]
        self.assertEqual(entry["training_day_id"], self.day.id)
        self.assertEqual(entry["trainers"], self._expected_trainers())
        self.assertIn("survey", entry)
        self.assertNotIn("attendance", entry)
        self.assertNotIn("trainer_report", entry)
        # Identical to the corresponding list entry.
        listed = self.api_get("/dashboard/trainee").json()["data"]["days"][0]
        self.assertEqual(entry, listed)

    def test_single_day_supervisor(self):
        self.authenticate("opapi_supervisor", "Test1234!")
        resp = self.api_get("/dashboard/supervisor/days/%d" % self.day.id)
        self.assertEqual(resp.status_code, 200)
        entry = resp.json()["data"]
        self.assertEqual(entry["training_day_id"], self.day.id)
        self.assertIn("attendance", entry)
        self.assertIn("survey", entry)
        self.assertEqual(entry["trainers"], self._expected_trainers())

    def test_single_day_trainer(self):
        self.authenticate("opapi_trainer", "Test1234!")
        resp = self.api_get("/dashboard/trainer/days/%d" % self.day.id)
        self.assertEqual(resp.status_code, 200)
        entry = resp.json()["data"]
        self.assertEqual(entry["training_day_id"], self.day.id)
        self.assertIn("trainer_report", entry)
        self.assertNotIn("survey", entry)
        self.assertNotIn("attendance", entry)

    def test_single_day_not_visible_is_403(self):
        for login, role in (
            ("opapi_trainee", "trainee"),
            ("opapi_supervisor", "supervisor"),
            ("opapi_trainer", "trainer"),
        ):
            self.authenticate(login, "Test1234!")
            resp = self.api_get(
                "/dashboard/%s/days/%d" % (role, self.unrelated_day.id)
            )
            self.assertEqual(resp.status_code, 403, role)
            self.assertEqual(resp.json()["error"]["code"], "FORBIDDEN", role)
            self.assertIsNone(resp.json()["data"], role)

    def test_single_day_missing_is_404(self):
        missing_id = self.env["training.day"].search([], order="id desc", limit=1).id + 1000
        self.authenticate("opapi_trainee", "Test1234!")
        resp = self.api_get("/dashboard/trainee/days/%d" % missing_id)
        self.assertEqual(resp.status_code, 404)
        self.assertEqual(resp.json()["error"]["code"], "NOT_FOUND")

    def test_single_day_archived_is_404(self):
        self.day.active = False
        self.authenticate("opapi_supervisor", "Test1234!")
        resp = self.api_get("/dashboard/supervisor/days/%d" % self.day.id)
        self.assertEqual(resp.status_code, 404)

    def test_single_day_unauthenticated_is_401(self):
        for role in ("trainee", "supervisor", "trainer"):
            resp = self.api_get("/dashboard/%s/days/%d" % (role, self.day.id))
            self.assertEqual(resp.status_code, 401, role)
            self.assertEqual(resp.json()["error"]["code"], "UNAUTHENTICATED", role)

    def test_me_includes_tz(self):
        self.trainee_user.tz = "Asia/Riyadh"
        self.authenticate("opapi_trainee", "Test1234!")
        data = self.api_get("/auth/me").json()["data"]
        self.assertEqual(data["tz"], "Asia/Riyadh")

    def test_me_tz_null_when_unset(self):
        self.trainee_user.tz = False
        self.authenticate("opapi_trainee", "Test1234!")
        data = self.api_get("/auth/me").json()["data"]
        self.assertIn("tz", data)
        self.assertIsNone(data["tz"])
