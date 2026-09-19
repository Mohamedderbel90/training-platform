from odoo import _, api, fields, models
from odoo.exceptions import UserError

# Fields whose meaning for KPI/analytics purposes must not change once
# the owning survey has submitted responses.
STRUCTURAL_QUESTION_FIELDS = {"kpi_category", "question_type"}


class SurveyQuestion(models.Model):
    _inherit = "survey.question"

    kpi_category = fields.Selection(
        selection=[
            ("trainer_performance", "Trainer Performance"),
            ("content", "Content"),
            ("environment", "Environment"),
        ],
        help="Optional analytics category. Left empty for questions that "
        "do not participate in KPI calculations (e.g. free-text comments).",
    )

    @api.model_create_multi
    def create(self, vals_list):
        # A new question is added via survey.question.create() (setting
        # survey_id on the child), NOT via survey.survey.write() with
        # question_and_page_ids -- that write-based lock on
        # survey.survey does not see this path, so it must be blocked
        # here too.
        survey_ids = {vals["survey_id"] for vals in vals_list if vals.get("survey_id")}
        if survey_ids:
            used_surveys = (
                self.env["survey.survey"]
                .browse(list(survey_ids))
                .filtered("has_submitted_responses")
            )
            if used_surveys:
                raise UserError(
                    _(
                        "Cannot add a question to %s: it already has "
                        "submitted responses. Clone it as a new version "
                        "instead."
                    )
                    % ", ".join(used_surveys.mapped("title"))
                )
        return super().create(vals_list)

    def write(self, vals):
        if STRUCTURAL_QUESTION_FIELDS & set(vals.keys()):
            for question in self:
                if question.survey_id.has_submitted_responses:
                    raise UserError(
                        _(
                            "\"%s\" belongs to a survey that already has "
                            "submitted responses; its KPI category/question "
                            "type cannot be changed. Clone the survey as a "
                            "new version instead."
                        )
                        % question.title
                    )
        return super().write(vals)

    def unlink(self):
        for question in self:
            if question.survey_id.has_submitted_responses:
                raise UserError(
                    _(
                        "\"%s\" belongs to a survey that already has "
                        "submitted responses and cannot be deleted."
                    )
                    % question.title
                )
        return super().unlink()

    def _get_definition_dto(self):
        """Frontend-facing question DTO (M4 point 10/15): only what the
        UI needs to render and submit -- no internal scoring/session
        fields."""
        self.ensure_one()
        options = None
        if self.question_type in ("simple_choice", "multiple_choice"):
            options = [
                {"id": answer.id, "label": answer.value}
                for answer in self.suggested_answer_ids.sorted("sequence")
            ]
        return {
            "question_id": self.id,
            "title": self.title,
            "question_type": self.question_type,
            "required": bool(self.constr_mandatory),
            "kpi_category": self.kpi_category or None,
            "options": options,
        }
