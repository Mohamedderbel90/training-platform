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
    ("day_close", "Training Day Closed"),
    ("day_reopen", "Training Day Reopened"),
    ("report_approval", "Report Approved"),
    ("permission_change", "Permission/Role Change"),
    # SRS section 6.11 / PROJECT_SPEC section 17: "exceptional
    # administrative correction of final response/data". The corrective
    # workflow is settled by DEC-11 (docs/DECISIONS.md): no dedicated
    # state, a mandatory reason, before/after in the description. This
    # event records that the one privileged path able to touch a
    # finalized survey.user_input (self.env.su, see ADR-003) was used.
    ("response_correction", "Final Survey Response Corrected"),
    ("personal_data_anonymised", "Personal Data Anonymised"),
]

# DEC-11: every administrative correction of a final response must carry
# a reason, supplied through this context key (see
# survey.user_input.action_correct_final_response()).
CORRECTION_REASON_KEY = "correction_reason"


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
    record_label = fields.Char(string="Record Type", compute="_compute_record_label")
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
    def _correction_reason(self):
        return (self.env.context.get(CORRECTION_REASON_KEY) or "").strip()

    @api.model
    def _require_correction_reason(self):
        """DEC-11: a correction of a final response without a reason is
        refused before anything is changed."""
        reason = self._correction_reason()
        if not reason:
            raise UserError(
                _("A reason is required to correct a final response.")
            )
        return reason

    @api.model
    def _log(self, event_type, description, record=None):
        if event_type == "response_correction":
            reason = self._correction_reason()
            if reason:
                description = "%s %s" % (
                    description,
                    _("Reason: %s") % reason,
                )
        vals = {
            "event_type": event_type,
            "description": description,
        }
        if record is not None:
            vals["model_name"] = record._name
            vals["res_id"] = record.id
        return self.sudo().create(vals)

    @api.depends("model_name")
    def _compute_record_label(self):
        """Business label of the audited record, never the technical model."""
        labels = {
            "training.day": _("Training Day"),
            "training.report": _("Report"),
            "survey.user_input": _("Survey Response"),
            "res.users": _("User Account"),
            "res.partner": _("Participant"),
        }
        for entry in self:
            entry.record_label = labels.get(entry.model_name, "") if entry.model_name else ""
