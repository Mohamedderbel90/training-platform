from odoo import _, http
from odoo.exceptions import AccessError
from odoo.http import request

from .common import api_response, handle_api_errors


class TrainerController(http.Controller):
    """Trainer daily report. draft = standard Odoo Survey 'in_progress'
    state, final = 'done' (reused from M2/ADR-003). Each assigned
    trainer owns an independent response (M2's uniqueness constraint on
    (training_day_id, respondent_role, partner_id))."""

    def _require_trainer(self):
        if "trainer" not in request.env.user._get_operational_roles():
            raise AccessError(_("You do not have the trainer role."))

    @http.route(
        "/api/v1/training-days/<int:day_id>/trainer-report",
        type="json2", auth="user", methods=["GET"],
    )
    @handle_api_errors
    def get_trainer_report(self, day_id, request_id, **kwargs):
        self._require_trainer()
        day = request.env["training.day"].browse(day_id)
        report = day.get_trainer_report_dto("trainer")
        return api_response(data=report, request_id=request_id)

    @http.route(
        "/api/v1/training-days/<int:day_id>/trainer-report/draft",
        type="json2", auth="user", methods=["PUT"],
    )
    @handle_api_errors
    def save_trainer_report_draft(self, day_id, request_id, answers=None, **kwargs):
        self._require_trainer()
        day = request.env["training.day"].browse(day_id)
        response = day.save_draft_survey_response("trainer", answers or [])
        return api_response(data=response._get_status_dto(), request_id=request_id)

    @http.route(
        "/api/v1/training-days/<int:day_id>/trainer-report/submit",
        type="json2", auth="user", methods=["POST"],
    )
    @handle_api_errors
    def submit_trainer_report(self, day_id, request_id, answers=None, **kwargs):
        self._require_trainer()
        day = request.env["training.day"].browse(day_id)
        response = day.submit_survey_response("trainer", answers or [])
        return api_response(data=response._get_status_dto(), request_id=request_id)
