from odoo import _, api, fields, models
from odoo.exceptions import AccessError, UserError

_EDITABLE_TYPES = ("suggestion", "char_box", "text_box", "scale", "numerical_box")


class TrainingResponseCorrection(models.TransientModel):
    """P2 / DEC-11: the Odoo screen through which the General Supervisor
    corrects a FINAL response. A reason is mandatory; every changed answer
    is written through the audited correction path, so the audit entry
    carries the reason and the before/after values."""

    _name = "training.response.correction"
    _description = "Final Response Correction"

    def _compute_display_name(self):
        for record in self:
            record.display_name = _("Correct Final Response")

    response_id = fields.Many2one("survey.user_input", string="Response", required=True)
    reason = fields.Text(required=True)
    line_ids = fields.One2many(
        "training.response.correction.line", "wizard_id", string="Answers"
    )

    @api.model
    def default_get(self, fields_list):
        values = super().default_get(fields_list)
        response_id = self.env.context.get("default_response_id")
        if response_id and "line_ids" in fields_list:
            response = self.env["survey.user_input"].browse(response_id)
            commands = []
            for line in response.user_input_line_ids.filtered(
                lambda line_: not line_.skipped and line_.answer_type in _EDITABLE_TYPES
            ):
                commands.append(
                    (
                        0,
                        0,
                        {
                            "line_id": line.id,
                            "option_id": line.suggested_answer_id.id,
                            "text": line.value_char_box or line.value_text_box,
                            "number": line.value_scale or line.value_numerical_box,
                        },
                    )
                )
            values["line_ids"] = commands
        return values

    def action_apply(self):
        self.ensure_one()
        if not self.env.user.has_group("training_management.group_training_admin"):
            raise AccessError(
                _("Only the General Supervisor can correct a final response.")
            )
        reason = (self.reason or "").strip()
        if not reason:
            raise UserError(_("A reason is required to correct a final response."))
        if self.response_id.state != "done":
            raise UserError(_("Only a final (submitted) response can be corrected."))
        changed = 0
        for item in self.line_ids:
            vals = item._changed_values()
            if vals:
                item.line_id.sudo().with_context(correction_reason=reason).write(vals)
                changed += 1
        if not changed:
            raise UserError(_("No answer was changed."))
        return {"type": "ir.actions.act_window_close"}


class TrainingResponseCorrectionLine(models.TransientModel):
    _name = "training.response.correction.line"
    _description = "Final Response Correction Line"

    wizard_id = fields.Many2one(
        "training.response.correction", required=True, ondelete="cascade"
    )
    line_id = fields.Many2one("survey.user_input.line", required=True)
    question_id = fields.Many2one(related="line_id.question_id", string="Question")
    answer_type = fields.Selection(related="line_id.answer_type")
    option_id = fields.Many2one(
        "survey.question.answer",
        string="Choice",
        domain="[('question_id', '=', question_id)]",
    )
    text = fields.Text(string="Text")
    number = fields.Float(string="Number")

    def _changed_values(self):
        """Values to write on the real answer line, only if different."""
        self.ensure_one()
        line = self.line_id
        if line.answer_type == "suggestion":
            if self.option_id and self.option_id != line.suggested_answer_id:
                return {"suggested_answer_id": self.option_id.id}
        elif line.answer_type == "char_box":
            if (self.text or "") != (line.value_char_box or ""):
                return {"value_char_box": self.text or False}
        elif line.answer_type == "text_box":
            if (self.text or "") != (line.value_text_box or ""):
                return {"value_text_box": self.text or False}
        elif line.answer_type == "scale":
            if int(self.number) != (line.value_scale or 0):
                return {"value_scale": int(self.number)}
        elif line.answer_type == "numerical_box":
            if self.number != (line.value_numerical_box or 0.0):
                return {"value_numerical_box": self.number}
        return {}
