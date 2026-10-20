from odoo import _, http
from odoo.exceptions import AccessError, UserError
from odoo.http import request

from .common import api_response, handle_api_errors


class OperationalDashboardController(http.Controller):
    """Trainee/Supervisor/Trainer dashboards only (M4 point 9). No Admin
    dashboard endpoint exists here -- admin analytics stay in Odoo
    Back-office (PROJECT_SPEC section 2.1); see ADR-005."""

    def _require_role(self, role):
        if role not in request.env.user._get_operational_roles():
            raise AccessError(
                _("You do not have the %s role required for this endpoint.") % role
            )

    @staticmethod
    def _program_id():
        """Optional ``?program_id=`` of the header's program selector (json2
        routes do not pass the query string to the handler)."""
        value = request.httprequest.args.get("program_id")
        if value in (None, ""):
            return None
        try:
            return int(value)
        except ValueError:
            raise UserError(_("Invalid program."))

    @http.route("/api/v1/dashboard/trainee", type="json2", auth="user", methods=["GET"])
    @handle_api_errors
    def trainee_dashboard(self, request_id, **kwargs):
        self._require_role("trainee")
        summary = request.env["training.day"].get_dashboard_summary(
            "trainee", program_id=self._program_id())
        return api_response(data=summary, request_id=request_id)

    @http.route("/api/v1/dashboard/supervisor", type="json2", auth="user", methods=["GET"])
    @handle_api_errors
    def supervisor_dashboard(self, request_id, **kwargs):
        self._require_role("supervisor")
        summary = request.env["training.day"].get_dashboard_summary(
            "supervisor", program_id=self._program_id())
        return api_response(data=summary, request_id=request_id)

    @http.route("/api/v1/dashboard/trainer", type="json2", auth="user", methods=["GET"])
    @handle_api_errors
    def trainer_dashboard(self, request_id, **kwargs):
        self._require_role("trainer")
        summary = request.env["training.day"].get_dashboard_summary(
            "trainer", program_id=self._program_id())
        return api_response(data=summary, request_id=request_id)

    # Single training day in the dashboard-entry shape (ADR-011). Three
    # explicit routes, mirroring the three dashboards above, so the
    # role always comes from the URL + _require_role(), never from a
    # client-supplied parameter. Visibility/ownership/404 live in
    # training.day.get_dashboard_day().

    @http.route(
        "/api/v1/dashboard/trainee/days/<int:day_id>",
        type="json2", auth="user", methods=["GET"],
    )
    @handle_api_errors
    def trainee_dashboard_day(self, day_id, request_id, **kwargs):
        self._require_role("trainee")
        entry = request.env["training.day"].get_dashboard_day("trainee", day_id)
        return api_response(data=entry, request_id=request_id)

    @http.route(
        "/api/v1/dashboard/supervisor/days/<int:day_id>",
        type="json2", auth="user", methods=["GET"],
    )
    @handle_api_errors
    def supervisor_dashboard_day(self, day_id, request_id, **kwargs):
        self._require_role("supervisor")
        entry = request.env["training.day"].get_dashboard_day("supervisor", day_id)
        return api_response(data=entry, request_id=request_id)

    @http.route(
        "/api/v1/dashboard/trainer/days/<int:day_id>",
        type="json2", auth="user", methods=["GET"],
    )
    @handle_api_errors
    def trainer_dashboard_day(self, day_id, request_id, **kwargs):
        self._require_role("trainer")
        entry = request.env["training.day"].get_dashboard_day("trainer", day_id)
        return api_response(data=entry, request_id=request_id)
