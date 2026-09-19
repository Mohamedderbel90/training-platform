from odoo import _, api, fields, models
from odoo.exceptions import UserError, ValidationError


class TrainingCourse(models.Model):
    _name = "training.course"
    _description = "Training Course"
    _order = "program_id, sequence, start_date"

    program_id = fields.Many2one(
        "training.program",
        string="Program",
        required=True,
        ondelete="restrict",
    )
    name = fields.Char(required=True, translate=True)
    sequence = fields.Integer(default=10)
    start_date = fields.Date(required=True)
    end_date = fields.Date(required=True)
    active = fields.Boolean(default=True)

    day_ids = fields.One2many("training.day", "course_id", string="Training Days")

    @api.constrains("start_date", "end_date")
    def _check_dates(self):
        for course in self:
            if course.end_date < course.start_date:
                raise ValidationError(
                    _(
                        "The end date cannot precede the start date for "
                        "course %s."
                    )
                    % course.name
                )

    def unlink(self):
        Day = self.env["training.day"].with_context(active_test=False)
        for course in self:
            if Day.search_count([("course_id", "=", course.id)]):
                raise UserError(
                    _(
                        "Course %s has training days linked to it "
                        "(including archived ones) and cannot be deleted. "
                        "Archive it instead."
                    )
                    % course.name
                )
        return super().unlink()
