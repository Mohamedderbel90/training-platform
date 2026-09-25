from odoo.tests.common import tagged

from .common import OperationalApiCase


@tagged("post_install", "-at_install", "training_management_api")
class TestOperationalApiSecurity(OperationalApiCase):
    """M4 point 16/17: administrative CRUD is never exposed through the
    Operational API, and no generic ORM/model/domain access exists."""

    def test_no_admin_program_crud_endpoints(self):
        self.authenticate("opapi_trainee", "Test1234!")
        for path, method in (
            ("/programs", "GET"),
            ("/programs", "POST"),
            ("/courses", "GET"),
            ("/training-days", "POST"),
            ("/users", "GET"),
            ("/enrollments", "POST"),
            ("/surveys", "GET"),
            ("/notifications/settings", "GET"),
            ("/reports/approve", "POST"),
            ("/audit", "GET"),
        ):
            if method == "GET":
                resp = self.api_get(path)
            else:
                resp = self.api_post(path, {})
            self.assertEqual(
                resp.status_code, 404, "unexpected route exists: %s %s" % (method, path)
            )

    def test_no_generic_orm_endpoint(self):
        # The old (explicitly superseded) admin-style pattern from
        # earlier drafts, and Odoo's own generic RPC pattern, must not
        # be reachable under /api/v1.
        self.authenticate("opapi_trainee", "Test1234!")
        resp = self.api_post(
            "/model/training.program/search_read",
            {"model": "training.program", "domain": []},
        )
        self.assertEqual(resp.status_code, 404)

    def test_client_supplied_role_is_ignored(self):
        # The client cannot claim a role it does not have; roles are
        # derived from group membership only (M4 point 8).
        self.authenticate("opapi_trainee", "Test1234!")
        resp = self.api_get("/dashboard/supervisor")
        self.assertEqual(resp.status_code, 403)

    def test_admin_workflow_actions_not_exposed(self):
        # action_open/close/reopen/postpone/cancel remain Odoo
        # Back-office-only (explicit M4 correction from the M3 report).
        self.authenticate("opapi_supervisor", "Test1234!")
        for action in ("open", "close", "reopen", "postpone", "cancel"):
            resp = self.api_post(
                "/training-days/%d/action_%s" % (self.day.id, action), {}
            )
            self.assertEqual(resp.status_code, 404)

    def test_unauthenticated_requests_return_401_across_endpoints(self):
        for path in (
            "/auth/me",
            "/dashboard/trainee",
            "/dashboard/supervisor",
            "/dashboard/trainer",
            "/dashboard/trainee/days/%d" % self.day.id,
            "/dashboard/supervisor/days/%d" % self.day.id,
            "/dashboard/trainer/days/%d" % self.day.id,
        ):
            resp = self.api_get(path)
            self.assertEqual(resp.status_code, 401, path)

    def test_trainee_cannot_write_via_attendance_endpoint(self):
        # Even if a trainee somehow guesses the URL shape, the
        # supervisor-only role check denies it before any model access.
        self.authenticate("opapi_trainee", "Test1234!")
        resp = self.api_put(
            "/training-days/%d/attendance" % self.day.id,
            {"items": [{"trainee_id": self.enrollment.id, "status": "present"}]},
        )
        self.assertEqual(resp.status_code, 403)

    # ------------------------------------------------------------------
    # Single-day dashboard endpoint (S1-B / ADR-011): role comes from
    # the URL + group membership, visibility from the M1 record rules,
    # and role ownership from training.day._check_role_ownership().
    # ------------------------------------------------------------------

    def test_single_day_cross_role_denied(self):
        for login, role in (
            ("opapi_trainee", "supervisor"),
            ("opapi_trainee", "trainer"),
            ("opapi_supervisor", "trainee"),
            ("opapi_supervisor", "trainer"),
            ("opapi_trainer", "trainee"),
            ("opapi_trainer", "supervisor"),
        ):
            self.authenticate(login, "Test1234!")
            resp = self.api_get("/dashboard/%s/days/%d" % (role, self.day.id))
            self.assertEqual(resp.status_code, 403, "%s as %s" % (login, role))
            self.assertIsNone(resp.json()["data"])

    def test_single_day_cross_user_denied(self):
        # Same role, but not assigned to / enrolled in self.day.
        for login, role in (
            ("opapi_supervisor_other", "supervisor"),
            ("opapi_trainer_other", "trainer"),
        ):
            self.authenticate(login, "Test1234!")
            resp = self.api_get("/dashboard/%s/days/%d" % (role, self.day.id))
            self.assertEqual(resp.status_code, 403, login)
        # A trainee of another program cannot read this program's day.
        self.other_enrollment.unlink()
        self.authenticate("opapi_trainee_other", "Test1234!")
        resp = self.api_get("/dashboard/trainee/days/%d" % self.day.id)
        self.assertEqual(resp.status_code, 403)

    def test_single_day_multi_role_user_limited_to_owned_role(self):
        # A user who is both supervisor and trainer, supervising
        # self.day but not teaching it, can see the day (union of the
        # record rules) but must not get the trainer view of it.
        self.supervisor_user.write(
            {
                "group_ids": [
                    (4, self.env.ref("training_management.group_training_trainer").id)
                ]
            }
        )
        self.authenticate("opapi_supervisor", "Test1234!")
        self.assertEqual(
            self.api_get("/dashboard/supervisor/days/%d" % self.day.id).status_code,
            200,
        )
        resp = self.api_get("/dashboard/trainer/days/%d" % self.day.id)
        self.assertEqual(resp.status_code, 403)

    def test_single_day_staff_payloads_have_no_trainee_survey_data(self):
        self.authenticate("opapi_trainee", "Test1234!")
        submit = self.api_post(
            "/training-days/%d/my-survey/submit" % self.day.id,
            {
                "answers": [
                    {
                        "question_id": self.trainee_question.id,
                        "answer_option_id": self.trainee_options[5].id,
                    }
                ]
            },
        )
        self.assertEqual(submit.status_code, 200)
        trainee_response_id = submit.json()["data"]["response_id"]

        for login, role in (
            ("opapi_supervisor", "supervisor"),
            ("opapi_trainer", "trainer"),
        ):
            self.authenticate(login, "Test1234!")
            resp = self.api_get("/dashboard/%s/days/%d" % (role, self.day.id))
            self.assertEqual(resp.status_code, 200, role)
            entry = resp.json()["data"]
            self.assertNotIn("answers", entry, role)
            if role == "supervisor":
                # Only the supervisor's OWN (not started) response.
                self.assertIsNone(entry["survey"]["response"])
            else:
                self.assertNotIn("survey", entry)
                self.assertIsNone(entry["trainer_report"]["response"])
            self.assertNotIn(str(trainee_response_id), str(entry.get("survey")))
            self.assertNotIn("Excellent", str(entry))
