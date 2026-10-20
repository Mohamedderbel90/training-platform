from odoo.exceptions import ValidationError
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

    def test_account_cannot_hold_two_operational_roles(self):
        # DEC-09: one operational role per account, so the union-of-roles
        # case this test used to cover can no longer be created.
        with self.assertRaises(ValidationError):
            self.supervisor_user.write(
                {
                    "group_ids": [
                        (4, self.env.ref("training_management.group_training_trainer").id)
                    ]
                }
            )

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

    # ------------------------------------------------------------------
    # NOT_FOUND message sanitization (info-disclosure fix): every
    # day-scoped endpoint below reaches a plain lazy field read on a
    # bare ``request.env["training.day"].browse(day_id)`` with no
    # ``.exists()`` guard (e.g. training.day._get_role_survey() doing
    # ``self[field_name]``, or get_attendance_dto() doing
    # ``day.course_id...``). For a nonexistent id, that used to raise
    # Odoo's own default MissingError, whose message leaks the internal
    # model name, an ORM tuple repr, and the internal numeric user id
    # straight into the API response, e.g.:
    #   "Record does not exist or has been deleted.
    #    (Record: training.day(999999,), User: 5)"
    # Only the single-day dashboard route already guarded against this,
    # via training.day.get_dashboard_day()'s explicit .exists() check
    # (see test_operational_api_dashboards.test_single_day_missing_is_404).
    # api_common.build_error_response now sanitizes any such MissingError
    # centrally -- the same length/newline heuristic it already used for
    # AccessError -- so every endpoint is fixed at once instead of
    # patching each controller with its own .exists() check.
    # ------------------------------------------------------------------

    def test_day_scoped_endpoints_missing_day_returns_clean_not_found(self):
        missing_id = (
            self.env["training.day"].search([], order="id desc", limit=1).id + 1000
        )
        cases = (
            ("opapi_supervisor", "/training-days/%d/attendance" % missing_id),
            ("opapi_supervisor", "/training-days/%d/supervisor-survey" % missing_id),
            (
                "opapi_supervisor",
                "/training-days/%d/supervisor-survey/status" % missing_id,
            ),
            ("opapi_trainee", "/training-days/%d/my-survey" % missing_id),
            ("opapi_trainee", "/training-days/%d/my-survey/status" % missing_id),
            ("opapi_trainer", "/training-days/%d/trainer-report" % missing_id),
        )
        for login, path in cases:
            self.authenticate(login, "Test1234!")
            resp = self.api_get(path)
            self.assertEqual(resp.status_code, 404, path)
            body = resp.json()
            self.assertEqual(body["error"]["code"], "NOT_FOUND", path)
            message = body["error"]["message"]
            self.assertEqual(message, "Record not found.", path)
            self.assertNotIn("training.day", message, path)
            self.assertNotIn("(", message, path)
            self.assertNotIn(")", message, path)
            self.assertNotIn("User:", message, path)
            self.assertNotIn("\n", message, path)

    def test_day_scoped_endpoint_missing_day_not_found_is_clean_in_arabic(self):
        # Same regression, verified in the other supported locale: the
        # sanitized replacement message must itself be translated (M4's
        # existing Accept-Language handling), not merely generic in
        # English.
        self.env["res.lang"]._activate_lang("ar_001")
        missing_id = (
            self.env["training.day"].search([], order="id desc", limit=1).id + 1000
        )
        self.authenticate("opapi_supervisor", "Test1234!")
        resp = self.api_get(
            "/training-days/%d/attendance" % missing_id,
            headers={"Accept-Language": "ar"},
        )
        self.assertEqual(resp.status_code, 404)
        body = resp.json()
        self.assertEqual(body["error"]["code"], "NOT_FOUND")
        message = body["error"]["message"]
        self.assertEqual(message, "السجل غير موجود.")
        self.assertNotIn("training.day", message)
        self.assertNotIn("(", message)
        self.assertNotIn(")", message)
        self.assertNotIn("User:", message)
