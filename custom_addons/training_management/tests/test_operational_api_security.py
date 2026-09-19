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
