from odoo import _, api, fields, models
from odoo.exceptions import AccessError, UserError


class TrainingAnonymiseWizard(models.TransientModel):
    """DEC-44/45: the Odoo screen through which the General Supervisor
    meets a trainee's deletion request. Opened from the Action menu of a
    contact or of an enrollment; the work is done by
    res.partner.action_anonymise_trainee()."""

    _name = "training.anonymise.wizard"
    _description = "Anonymise Trainee"

    def _compute_display_name(self):
        for record in self:
            record.display_name = _("Anonymise Trainee")

    partner_id = fields.Many2one("res.partner", string="Trainee", required=True)
    reason = fields.Text(required=True)

    @api.model
    def default_get(self, fields_list):
        values = super().default_get(fields_list)
        model = self.env.context.get("active_model")
        active_id = self.env.context.get("active_id")
        if active_id and "partner_id" in fields_list:
            if model == "res.partner":
                values["partner_id"] = active_id
            elif model == "training.enrollment":
                values["partner_id"] = self.env["training.enrollment"].browse(
                    active_id
                ).partner_id.id
        return values

    def action_anonymise(self):
        self.ensure_one()
        if not self.env.user.has_group("training_management.group_training_admin"):
            raise AccessError(_("Only the General Supervisor can anonymise a trainee."))
        if not (self.reason or "").strip():
            raise UserError(_("A reason is required to anonymise a trainee."))
        self.partner_id.action_anonymise_trainee(self.reason)
        return {"type": "ir.actions.act_window_close"}
