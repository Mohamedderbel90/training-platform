from odoo import _, http
from odoo.exceptions import AccessError
from odoo.http import request

from .common import api_response, handle_api_errors


class TraineeSurveyController(http.Controller):
    """Reuses M2 model/service logic (training.day.check_survey_access /
    get_or_create_survey_response / submit_survey_response) for all
    availability, ownership, locking, and duplicate-final rules -- this
    controller does not re-implement any of them (M4 point 10)."""

    def _require_trainee(self):
        if "trainee" not in request.env.user._get_operational_roles():
            raise AccessError(_("You do not have the trainee role."))

    @http.route(
        "/api/v1/training-days/<int:day_id>/my-survey",
        type="json2", auth="user", methods=["GET"],
    )
    @handle_api_errors
    def get_my_survey(self, day_id, request_id, **kwargs):
        self._require_trainee()
        day = request.env["training.day"].browse(day_id)
        definition = day.get_survey_definition_dto("trainee")
        return api_response(data=definition, request_id=request_id)

    @http.route(
        "/api/v1/training-days/<int:day_id>/my-survey/status",
        type="json2", auth="user", methods=["GET"],
    )
    @handle_api_errors
    def get_my_survey_status(self, day_id, request_id, **kwargs):
        self._require_trainee()
        day = request.env["training.day"].browse(day_id)
        status = day.get_survey_status("trainee")
        return api_response(data=status, request_id=request_id)

    @http.route(
        "/api/v1/training-days/<int:day_id>/my-survey/submit",
        type="json2", auth="user", methods=["POST"],
    )
    @handle_api_errors
    def submit_my_survey(self, day_id, request_id, answers=None, **kwargs):
        self._require_trainee()
        day = request.env["training.day"].browse(day_id)
        response = day.submit_survey_response("trainee", answers or [])
        return api_response(data=response._get_status_dto(), request_id=request_id)
