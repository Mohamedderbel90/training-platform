from odoo import _, api, fields, models
from odoo.exceptions import UserError

# PROJECT_SPEC section 17: standard create_uid/create_date/write_uid/
# write_date and mail.thread tracking are the default mechanism; this
# model exists only for the specific events section 17 names as not
# sufficiently represented by that standard tracking:
# "exceptional reopen/close of a training day; exceptional
# administrative correction of final response/data; report approval;
# permission/role changes."
EVENT_TYPES = [
    ("day_reopen", "Training Day Reopened"),
    ("report_approval", "Report Approved"),
    ("permission_change", "Permission/Role Change"),
]


class TrainingAuditLog(models.Model):
    _name = "training.audit.log"
    _description = "Training Sensitive Event Audit Log"
    _order = "create_date desc"

    event_type = fields.Selection(selection=EVENT_TYPES, required=True)
    user_id = fields.Many2one(
        "res.users",
        string="Performed By",
        required=True,
        default=lambda self: self.env.user.id,
        ondelete="restrict",
    )
    model_name = fields.Char(string="Model")
    res_id = fields.Integer(string="Record ID")
    description = fields.Text()

    # Records are created only by this addon's own service code (_log()
    # below, via create()), never written to or deleted afterward by
    # anyone -- "Audit records are not editable from normal user
    # interfaces" (PROJECT_SPEC section 17). Unlike survey.user_input's
    # deliberate env.su-gated lock (ADR-003, which leaves room for a
    # future audited correction workflow), this guard has no such
    # exemption: an audit trail that internal code could quietly
    # rewrite via sudo() would defeat its own purpose, and no correction
    # workflow for audit entries themselves is a documented requirement.
    def write(self, vals):
        raise UserError(_("Audit log entries cannot be modified."))

    def unlink(self):
        raise UserError(_("Audit log entries cannot be deleted."))

    @api.model
    def _log(self, event_type, description, record=None):
        vals = {
            "event_type": event_type,
            "description": description,
        }
        if record is not None:
            vals["model_name"] = record._name
            vals["res_id"] = record.id
        return self.sudo().create(vals)
