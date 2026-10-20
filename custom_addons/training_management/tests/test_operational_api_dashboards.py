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

    def test_dashboard_entry_topic_null_when_unset(self):
        # self.day (common.py) is created with no topic value.
        self.authenticate("opapi_trainee", "Test1234!")
        resp = self.api_get("/dashboard/trainee")
        days = resp.json()["data"]["days"]
        self.assertIn("topic", days[0])
        self.assertIsNone(days[0]["topic"])

    def test_dashboard_entry_topic_reflects_model_value(self):
        self.day.write({"topic": "Conflict Resolution"})
        self.authenticate("opapi_supervisor", "Test1234!")
        resp = self.api_get("/dashboard/supervisor")
        days = resp.json()["data"]["days"]
        self.assertEqual(days[0]["topic"], "Conflict Resolution")

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
        # training.day.get_dashboard_day() already raises its own clean,
        # short, single-line MissingError ("Training day not found.").
        # api_common.build_error_response's length/newline sanitization
        # heuristic (extended to NOT_FOUND alongside FORBIDDEN) must
        # pass this specific, already-safe message through unchanged --
        # not double-wrap it into the generic "Record not found."
        # fallback used for the ORM's own default MissingError text.
        self.assertEqual(resp.json()["error"]["message"], "Training day not found.")

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


@tagged("post_install", "-at_install", "training_management_api")
class TestAssignedDaysOnly(OperationalApiCase):
    """The Training Days pages list only the days assigned to the logged-in
    user, and the backend enforces it (not just the UI)."""

    def _days(self, login, role):
        self.authenticate(login, "Test1234!")
        resp = self.api_get("/dashboard/%s" % role)
        self.assertEqual(resp.status_code, 200)
        return [d["training_day_id"] for d in resp.json()["data"]["days"]]

    def test_each_user_sees_only_the_days_assigned_to_them(self):
        # The "other" supervisor/trainer are assigned the unrelated day only;
        # the "other" trainee is enrolled in the first program only.
        self.assertEqual(self._days("opapi_supervisor", "supervisor"), [self.day.id])
        self.assertEqual(self._days("opapi_trainer", "trainer"), [self.day.id])
        self.assertEqual(self._days("opapi_supervisor_other", "supervisor"),
                         [self.unrelated_day.id])
        self.assertEqual(self._days("opapi_trainer_other", "trainer"),
                         [self.unrelated_day.id])
        self.assertEqual(self._days("opapi_trainee", "trainee"), [self.day.id])
        self.assertEqual(self._days("opapi_trainee_other", "trainee"), [self.day.id])
        self.assertNotIn(self.unrelated_day.id, self._days("opapi_trainee", "trainee"))

    def test_listing_is_scoped_by_assignment_not_only_by_record_rules(self):
        """A General Supervisor is not restricted by the role record rules,
        yet the supervisor/trainer/trainee listings still return only days
        assigned to that user."""
        gs = self.env["res.users"].with_context(no_reset_password=True).create({
            "name": "Assigned Days GS", "login": "assigned_days_gs",
            "email": "assigned_days_gs@example.com",
            "group_ids": [
                (4, self.env.ref("base.group_user").id),
                (4, self.env.ref("training_management.group_training_admin").id),
            ],
        })
        Day = self.env["training.day"]
        self.assertTrue(Day.with_user(gs).search_count([]))
        for role in ("supervisor", "trainer", "trainee"):
            self.assertEqual(Day.get_dashboard(role, user=gs), [], role)
        self.assertEqual(Day.get_dashboard_summary("supervisor", user=gs)["days"], [])


@tagged("post_install", "-at_install", "training_management_api")
class TestDashboardProgramSelection(OperationalApiCase):
    """The header's program selector: ?program_id= scopes days, stats,
    program and next session to one program the user is assigned in."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        now = fields.Datetime.now()
        cls.second_program = cls.env["training.program"].create(
            {"name": "OpAPI Second Program", "start_date": "2025-01-01",
             "end_date": "2025-12-31"})
        course = cls.env["training.course"].create(
            {"program_id": cls.second_program.id, "name": "OpAPI Second Course",
             "start_date": "2025-01-01", "end_date": "2025-12-31"})
        cls.second_day = cls.env["training.day"].create({
            "course_id": course.id, "date": "2025-03-03",
            "start_datetime": "2025-03-03 08:00:00",
            "end_datetime": "2025-03-03 12:00:00", "state": "closed",
            "supervisor_id": cls.supervisor_user.id,
            "trainer_ids": [(6, 0, [cls.trainer_user.id])],
            "survey_open_at": "2025-03-03 08:00:00",
            "survey_close_at": "2025-03-04 08:00:00",
        })
        cls.env["training.enrollment"].create(
            {"program_id": cls.second_program.id,
             "partner_id": cls.trainee_user.partner_id.id})
        cls.now = now

    def _get(self, login, role, query=""):
        self.authenticate(login, "Test1234!")
        return self.api_get("/dashboard/%s%s" % (role, query))

    def test_default_is_the_current_program_and_lists_all_programs(self):
        data = self._get("opapi_supervisor", "supervisor").json()["data"]
        self.assertEqual(data["program"]["id"], self.program.id)  # nearest upcoming day
        self.assertEqual([d["training_day_id"] for d in data["days"]], [self.day.id])
        self.assertEqual(
            {p["id"] for p in data["programs"]},
            {self.program.id, self.second_program.id})

    def test_selected_program_scopes_days_stats_and_program(self):
        data = self._get(
            "opapi_supervisor", "supervisor",
            "?program_id=%d" % self.second_program.id).json()["data"]
        self.assertEqual(data["program"]["id"], self.second_program.id)
        self.assertEqual([d["training_day_id"] for d in data["days"]], [self.second_day.id])
        self.assertEqual(data["stats"]["training_days_count"], 1)
        self.assertIsNone(data["next_session"])  # its only day is closed
        self.assertEqual(len(data["programs"]), 2)

    def test_works_for_every_role(self):
        for login, role in (("opapi_trainer", "trainer"), ("opapi_trainee", "trainee")):
            data = self._get(
                login, role, "?program_id=%d" % self.second_program.id).json()["data"]
            self.assertEqual(
                [d["training_day_id"] for d in data["days"]], [self.second_day.id], role)

    def test_a_program_without_assigned_days_is_refused(self):
        resp = self._get(
            "opapi_supervisor", "supervisor", "?program_id=%d" % self.other_program.id)
        self.assertEqual(resp.status_code, 403)
        resp = self._get("opapi_trainee", "trainee", "?program_id=abc")
        self.assertIn(resp.status_code, (400, 422))
