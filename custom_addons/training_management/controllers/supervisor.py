from odoo import _, http
from odoo.exceptions import AccessError
from odoo.http import request

from .common import api_response, handle_api_errors


class SupervisorController(http.Controller):
    """Attendance + supervisor evaluation. Reuses M1's training.day
    record rules (assigned days only) and M2's survey lifecycle -- no
    availability/ownership/locking logic is duplicated here."""

    def _require_supervisor(self):
        if "supervisor" not in request.env.user._get_operational_roles():
            raise AccessError(_("You do not have the supervisor role."))

    @http.route(
        "/api/v1/training-days/<int:day_id>/attendance",
        type="json2", auth="user", methods=["GET"],
    )
    @handle_api_errors
    def get_attendance(self, day_id, request_id, **kwargs):
        self._require_supervisor()
        day = request.env["training.day"].browse(day_id)
        items = day.get_attendance_dto()
        return api_response(data={"items": items}, request_id=request_id)

    @http.route(
        "/api/v1/training-days/<int:day_id>/attendance",
        type="json2", auth="user", methods=["PUT"],
    )
    @handle_api_errors
    def put_attendance(self, day_id, request_id, items=None, **kwargs):
        self._require_supervisor()
        day = request.env["training.day"].browse(day_id)
        records = day.upsert_attendance(items or [])
        dto_items = [record._get_dto() for record in records]
        return api_response(data={"items": dto_items}, request_id=request_id)

    @http.route(
        "/api/v1/training-days/<int:day_id>/supervisor-survey",
        type="json2", auth="user", methods=["GET"],
    )
    @handle_api_errors
    def get_supervisor_survey(self, day_id, request_id, **kwargs):
        self._require_supervisor()
        day = request.env["training.day"].browse(day_id)
        definition = day.get_survey_definition_dto("supervisor")
        return api_response(data=definition, request_id=request_id)

    @http.route(
        "/api/v1/training-days/<int:day_id>/supervisor-survey/status",
        type="json2", auth="user", methods=["GET"],
    )
    @handle_api_errors
    def get_supervisor_survey_status(self, day_id, request_id, **kwargs):
        """Mirrors the trainee flow's GET .../my-survey/status (M6, closing
        the gap documented in ADR-006 section 12: this page previously had
        to re-fetch the whole dashboard and look up its own day entry just
        to know its own survey status)."""
        self._require_supervisor()
        day = request.env["training.day"].browse(day_id)
        status = day.get_survey_status("supervisor")
        return api_response(data=status, request_id=request_id)

    @http.route(
        "/api/v1/training-days/<int:day_id>/supervisor-survey/submit",
        type="json2", auth="user", methods=["POST"],
    )
    @handle_api_errors
    def submit_supervisor_survey(self, day_id, request_id, answers=None, **kwargs):
        self._require_supervisor()
        day = request.env["training.day"].browse(day_id)
        response = day.submit_survey_response("supervisor", answers or [])
        return api_response(data=response._get_status_dto(), request_id=request_id)
