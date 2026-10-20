from odoo import _, api, fields, models
from odoo.exceptions import UserError, ValidationError


class SurveyQuestionAnswer(models.Model):
    _inherit = "survey.question.answer"

    # Standard Odoo Survey stores the displayed choice label in the
    # translatable "value" field (e.g. "ضعيف" / "Poor"). Analytics must
    # not depend on that translated text -- it must not change meaning
    # when the UI language changes, and text-matching translated labels
    # is fragile. rating_value is the addon-defined, language-independent
    # technical mapping for the project's approved descriptive scale:
    #   1 = Poor / ضعيف
    #   2 = Acceptable / مقبول
    #   3 = Good / جيد
    #   4 = Very Good / جيد جداً
    #   5 = Excellent / ممتاز
    # Left empty for suggested answers that are not part of this rating
    # scale (e.g. a plain multiple-choice option unrelated to KPIs).
    rating_value = fields.Integer(
        help="Language-independent numeric score (1-5) for the approved "
        "descriptive rating scale. Only set on suggested answers that "
        "represent one of the five rating scale points; left empty "
        "otherwise. Used by training.analytics instead of the "
        "translated label text."
    )

    @api.constrains("rating_value")
    def _check_rating_value(self):
        for answer in self:
            if answer.rating_value and not (1 <= answer.rating_value <= 5):
                raise ValidationError(
                    "rating_value must be between 1 and 5 (approved "
                    "descriptive rating scale), or left empty."
                )

    # C2 / BR-009 / D-17: answer options of a survey that already has
    # submitted responses are frozen -- changing the rating value, moving
    # an option to another question, adding or deleting one would silently
    # rewrite historical KPIs and reports. Clone the survey as a new
    # version instead (survey.action_clone_as_new_version()).
    _STRUCTURAL_FIELDS = {"rating_value", "question_id"}

    def _check_survey_unused(self, questions):
        used = questions.mapped("survey_id").filtered("has_submitted_responses")
        if used:
            raise UserError(
                _(
                    "\"%s\" already has submitted responses; its answer "
                    "options cannot be changed. Clone the survey as a new "
                    "version instead."
                )
                % ", ".join(used.mapped("title"))
            )

    @api.model_create_multi
    def create(self, vals_list):
        question_ids = {v["question_id"] for v in vals_list if v.get("question_id")}
        if question_ids:
            self._check_survey_unused(self.env["survey.question"].browse(list(question_ids)))
        return super().create(vals_list)

    def write(self, vals):
        if self._STRUCTURAL_FIELDS & set(vals):
            self._check_survey_unused(self.mapped("question_id"))
            if vals.get("question_id"):
                self._check_survey_unused(
                    self.env["survey.question"].browse(vals["question_id"])
                )
        return super().write(vals)

    def unlink(self):
        self._check_survey_unused(self.mapped("question_id"))
        return super().unlink()
