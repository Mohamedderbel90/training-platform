from odoo import _, api, fields, models
from odoo.exceptions import UserError, ValidationError


class TrainingCourse(models.Model):
    _name = "training.course"
    _inherit = ["training.smart.buttons"]
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
    dates_outside_program = fields.Boolean(compute="_compute_dates_outside_program")

    day_ids = fields.One2many("training.day", "course_id", string="Training Days")

    day_count = fields.Integer(compute="_compute_smart_counts")
    attendance_count = fields.Integer(compute="_compute_smart_counts")
    response_count = fields.Integer(compute="_compute_smart_counts")
    report_count = fields.Integer(compute="_compute_smart_counts")

    def _compute_smart_counts(self):
        for course in self:
            cid = course.id
            course.day_count = course._smart_count(
                "training.day", [("course_id", "=", cid)])
            course.attendance_count = course._smart_count(
                "training.attendance", [("course_id", "=", cid)])
            course.response_count = course._smart_count(
                "survey.user_input", course._responses_domain("course_id"))
            course.report_count = course._smart_count(
                "training.report", [("course_id", "=", cid)])

    def action_open_days(self):
        return self._smart_action(
            _("Training Days"), "training.day", [("course_id", "=", self.id)],
            view_mode="list,form,calendar",
            context={"default_course_id": self.id})

    def action_open_attendance(self):
        return self._smart_action(
            _("Attendance Records"), "training.attendance",
            [("course_id", "=", self.id)], view_mode="list,form,pivot,graph")

    def action_open_responses(self):
        return self._smart_action(
            _("Evaluations"), "survey.user_input",
            self._responses_domain("course_id"), context={"create": False})

    def action_open_reports(self):
        return self._smart_action(
            _("Reports"), "training.report", [("course_id", "=", self.id)])

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

    @api.depends("program_id.start_date", "program_id.end_date", "start_date", "end_date")
    def _compute_dates_outside_program(self):
        """P9 / SRS-PROG-002: a warning (not a block) when the course falls
        outside its program's dates. Shown as a banner on the form -- a modal
        onchange warning re-opened itself when Save blurred the date field."""
        for course in self:
            program = course.program_id
            course.dates_outside_program = bool(
                program and course.start_date and course.end_date
                and (course.start_date < program.start_date
                     or course.end_date > program.end_date)
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
