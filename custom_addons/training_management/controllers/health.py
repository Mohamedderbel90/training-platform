from odoo import http
from odoo.http import request

from .common import api_response, handle_api_errors


class HealthController(http.Controller):
    """M10 deployment requirement: "Frontend/backend health checks."
    Public, unauthenticated, and deliberately minimal -- a load
    balancer/uptime monitor only needs to know the process is up and
    can reach its database, never anything about the request's own
    identity or business data (PROJECT_SPEC section 11's envelope is
    still used for consistency with every other endpoint)."""

    @http.route("/api/v1/health", type="json2", auth="public", methods=["GET"])
    @handle_api_errors
    def health(self, request_id, **kwargs):
        request.env.cr.execute("SELECT 1")
        request.env.cr.fetchone()
        return api_response(data={"status": "ok"}, request_id=request_id)
