from odoo import _, http
from odoo.exceptions import AccessError
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

    @http.route("/api/v1/dashboard/trainee", type="json2", auth="user", methods=["GET"])
    @handle_api_errors
    def trainee_dashboard(self, request_id, **kwargs):
        self._require_role("trainee")
        days = request.env["training.day"].get_dashboard("trainee")
        return api_response(data={"days": days}, request_id=request_id)

    @http.route("/api/v1/dashboard/supervisor", type="json2", auth="user", methods=["GET"])
    @handle_api_errors
    def supervisor_dashboard(self, request_id, **kwargs):
        self._require_role("supervisor")
        days = request.env["training.day"].get_dashboard("supervisor")
        return api_response(data={"days": days}, request_id=request_id)

    @http.route("/api/v1/dashboard/trainer", type="json2", auth="user", methods=["GET"])
    @handle_api_errors
    def trainer_dashboard(self, request_id, **kwargs):
        self._require_role("trainer")
        days = request.env["training.day"].get_dashboard("trainer")
        return api_response(data={"days": days}, request_id=request_id)
