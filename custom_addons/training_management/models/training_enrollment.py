from odoo import _, api, fields, models
from odoo.exceptions import UserError


class TrainingEnrollment(models.Model):
    _name = "training.enrollment"
    _description = "Training Program Enrollment"
    _order = "program_id, partner_id"

    program_id = fields.Many2one(
        "training.program",
        string="Program",
        required=True,
        ondelete="restrict",
    )
    # Standard res.partner for participant identity (PROJECT_SPEC section 4);
    # no parallel participant/user model is created.
    partner_id = fields.Many2one(
        "res.partner",
        string="Participant",
        required=True,
    )
    # Optional link to the participant's login account, when one exists.
    user_id = fields.Many2one("res.users", string="User Account")
    state = fields.Selection(
        selection=[
            ("active", "Active"),
            ("inactive", "Inactive"),
            ("completed", "Completed"),
        ],
        required=True,
        default="active",
    )
    enrollment_date = fields.Date(default=fields.Date.context_today)
    active = fields.Boolean(default=True)

    attendance_ids = fields.One2many(
        "training.attendance", "enrollment_id", string="Attendance Records"
    )

    # Odoo 19 replaced the _sql_constraints list with models.Constraint
    # (verified against the actual runtime; the old list form raises a
    # deprecation warning and is no longer supported).
    _program_partner_uniq = models.Constraint(
        "unique(program_id, partner_id)",
        "A participant can only be enrolled once per program.",
    )

    # No `name` field and no `_rec_name` exists on this model, so
    # Odoo 19's default _compute_display_name() falls back to the raw
    # f"{self._name},{self.id}" string (e.g. "training.enrollment,2")
    # -- see training_day.py's own _compute_display_name for the full
    # explanation of why (verified against odoo/orm/models.py) and why
    # a model-level override, not _rec_name, is the correct fix here
    # too: the desired label ("<trainee> (<program>)") is composed
    # from two fields, and overriding this one method fixes every
    # Many2one/breadcrumb/search result referencing training.enrollment
    # anywhere, not just the Attendance Records view.
    #
    # program_id.name is translate=True (M1), so the lang context
    # itself is a real dependency, not just the field values.
    @api.depends("partner_id.name", "program_id.name")
    @api.depends_context("lang")
    def _compute_display_name(self):
        for enrollment in self:
            if not enrollment.partner_id:
                enrollment.display_name = _("New Enrollment")
            elif enrollment.program_id:
                enrollment.display_name = "%s (%s)" % (
                    enrollment.partner_id.name,
                    enrollment.program_id.name,
                )
            else:
                enrollment.display_name = enrollment.partner_id.name

    def unlink(self):
        Attendance = self.env["training.attendance"].with_context(active_test=False)
        for enrollment in self:
            if Attendance.search_count([("enrollment_id", "=", enrollment.id)]):
                raise UserError(
                    _(
                        "This enrollment has attendance records linked to it "
                        "and cannot be deleted. Archive it instead."
                    )
                )
        return super().unlink()
