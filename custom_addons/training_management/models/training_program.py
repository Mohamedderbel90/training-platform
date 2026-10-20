from odoo import _, api, fields, models
from odoo.exceptions import UserError, ValidationError


class TrainingProgram(models.Model):
    _name = "training.program"
    _inherit = ["training.smart.buttons"]
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

    course_count = fields.Integer(compute="_compute_smart_counts")
    day_count = fields.Integer(compute="_compute_smart_counts")
    enrollment_count = fields.Integer(compute="_compute_smart_counts")
    attendance_count = fields.Integer(compute="_compute_smart_counts")
    response_count = fields.Integer(compute="_compute_smart_counts")

    def _compute_smart_counts(self):
        for program in self:
            pid = program.id
            program.course_count = program._smart_count(
                "training.course", [("program_id", "=", pid)])
            program.day_count = program._smart_count(
                "training.day", [("course_id.program_id", "=", pid)])
            program.enrollment_count = program._smart_count(
                "training.enrollment", [("program_id", "=", pid)])
            program.attendance_count = program._smart_count(
                "training.attendance", [("program_id", "=", pid)])
            program.response_count = program._smart_count(
                "survey.user_input", program._responses_domain("program_id"))

    def action_open_courses(self):
        return self._smart_action(
            _("Courses"), "training.course", [("program_id", "=", self.id)],
            context={"default_program_id": self.id})

    def action_open_days(self):
        return self._smart_action(
            _("Training Days"), "training.day",
            [("course_id.program_id", "=", self.id)],
            view_mode="list,form,calendar")

    def action_open_enrollments(self):
        return self._smart_action(
            _("Participants"), "training.enrollment",
            [("program_id", "=", self.id)],
            context={"default_program_id": self.id})

    def action_open_attendance(self):
        return self._smart_action(
            _("Attendance Records"), "training.attendance",
            [("program_id", "=", self.id)], view_mode="list,form,pivot,graph")

    def action_open_responses(self):
        return self._smart_action(
            _("Evaluations"), "survey.user_input",
            self._responses_domain("program_id"), context={"create": False})

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

    # DEC-61 / SRS 5.1: Draft -> Active -> Completed; a program can be
    # cancelled until it is completed; Completed and Cancelled are final
    # (history is archived with the archive flag, DEC-31).
    _ALLOWED_STATE_TRANSITIONS = {
        "draft": {"active", "cancelled"},
        "active": {"completed", "cancelled"},
        "completed": set(),
        "cancelled": set(),
    }

    # Lifecycle actions for the form buttons. They only write the new state;
    # write() below enforces the allowed transitions (DEC-61), so there is a
    # single place for the rule.
    def action_activate(self):
        self.write({"state": "active"})

    def action_complete(self):
        self.write({"state": "completed"})

    def action_cancel(self):
        self.write({"state": "cancelled"})

    def write(self, vals):
        new_state = vals.get("state")
        if new_state is not None:
            for program in self:
                if new_state != program.state and new_state not in self._ALLOWED_STATE_TRANSITIONS.get(  # noqa: E501
                    program.state, set()
                ):
                    raise UserError(
                        _("Program %(name)s cannot change from %(from_state)s to %(to_state)s.")
                        % {"name": program.name, "from_state": program.state, "to_state": new_state}
                    )
        return super().write(vals)

    def unlink(self):
        # Access first: someone who may not delete must get "access denied",
        # not a business message that reveals what the program holds.
        self.check_access("unlink")
        Course = self.env["training.course"].with_context(active_test=False)
        Enrollment = self.env["training.enrollment"].with_context(active_test=False)
        for program in self:
            # A clear business message instead of the database's foreign-key
            # error (courses and enrollments are protected by ondelete=restrict).
            if Course.search_count([("program_id", "=", program.id)]) or Enrollment.search_count(
                [("program_id", "=", program.id)]
            ):
                raise UserError(
                    _(
                        "Program %s has courses or enrollments linked to it "
                        "(including archived ones) and cannot be deleted. "
                        "Archive it instead."
                    )
                    % program.name
                )
            if program.state != "draft":
                raise UserError(
                    _(
                        "Only draft programs can be deleted. Archive "
                        "program %s instead of deleting it."
                    )
                    % program.name
                )
        return super().unlink()
