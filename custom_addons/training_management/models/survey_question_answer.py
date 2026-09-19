from odoo import api, fields, models
from odoo.exceptions import ValidationError


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
