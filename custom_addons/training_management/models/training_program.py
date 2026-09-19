from odoo import _, api, fields, models
from odoo.exceptions import UserError, ValidationError


class TrainingProgram(models.Model):
    _name = "training.program"
    _description = "Training Program"
    _order = "start_date desc, name"

    name = fields.Char(required=True, translate=True)
    start_date = fields.Date(required=True)
    end_date = fields.Date(required=True)
    state = fields.Selection(
        selection=[
            ("draft", "Draft"),
            ("active", "Active"),
            ("completed", "Completed"),
            ("cancelled", "Cancelled"),
        ],
        required=True,
        default="draft",
    )
    active = fields.Boolean(default=True)

    course_ids = fields.One2many("training.course", "program_id", string="Courses")
    enrollment_ids = fields.One2many(
        "training.enrollment", "program_id", string="Enrollments"
    )

    @api.constrains("start_date", "end_date")
    def _check_dates(self):
        for program in self:
            if program.end_date < program.start_date:
                raise ValidationError(
                    _(
                        "The end date cannot precede the start date for "
                        "program %s."
                    )
                    % program.name
                )

    def unlink(self):
        for program in self:
            if program.state != "draft":
                raise UserError(
                    _(
                        "Only draft programs can be deleted. Archive "
                        "program %s instead of deleting it."
                    )
                    % program.name
                )
        return super().unlink()
