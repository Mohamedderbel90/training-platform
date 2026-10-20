from odoo import _, api, fields, models
from odoo.exceptions import UserError, ValidationError


class TrainingAttendance(models.Model):
    _name = "training.attendance"
    _description = "Training Day Attendance"
    _order = "training_day_id, enrollment_id"

    training_day_id = fields.Many2one(
        "training.day",
        string="Training Day",
        required=True,
        ondelete="restrict",
    )
    enrollment_id = fields.Many2one(
        "training.enrollment",
        string="Enrollment",
        required=True,
        ondelete="restrict",
    )
    status = fields.Selection(
        selection=[
            ("present", "Present"),
            ("absent", "Absent"),
            ("late", "Late"),
        ],
        required=True,
    )
    late_minutes = fields.Integer(string="Late Minutes")

    # Stored related fields purely for Back-office search/group-by/Pivot
    # convenience (M3 point 10). Safe to store: these are plain foreign
    # keys, not derived numeric metrics, so they carry none of the
    # "0 vs. no data" ambiguity that blocks storing computed rates here.
    course_id = fields.Many2one(
        "training.course",
        string="Course",
        related="training_day_id.course_id",
        store=True,
    )
    program_id = fields.Many2one(
        "training.program",
        string="Program",
        related="course_id.program_id",
        store=True,
    )

    # Odoo 19 replaced the _sql_constraints list with models.Constraint
    # (verified against the actual runtime; the old list form raises a
    # deprecation warning and is no longer supported).
    _day_enrollment_uniq = models.Constraint(
        "unique(training_day_id, enrollment_id)",
        "Only one attendance record is allowed per participant per "
        "training day.",
    )

    # Day-state gate (OPD-12): attendance may be freely recorded/edited
    # while its training.day is "open", and must stop being writable
    # once the day reaches a final/non-open state (closed, postponed,
    # cancelled) -- mirroring, state-for-state, the gate training.day
    # already applies to survey submission (check_survey_access() checks
    # the exact same `state != "open"` condition). Reading/viewing
    # already-recorded attendance is never affected: only create()/
    # write() are gated here, not search()/read().
    #
    # Bypassed for env.su (internal/system code, migrations, and the
    # many test fixtures that build data directly as the superuser),
    # exactly like survey_user_input.py's own day-state check is skipped
    # for its privileged callers -- an ordinary supervisor request
    # (which runs with_user(), never su) is never exempted.
    def _check_day_open_for_attendance(self, day):
        if day.state != "open":
            raise UserError(
                _(
                    "Training day on %(date)s is not open for attendance "
                    "changes (current state: %(state)s)."
                )
                % {
                    "date": day.date,
                    # the state's translated label, never the raw key
                    "state": dict(
                        day._fields["state"]._description_selection(self.env)
                    ).get(day.state, day.state),
                }
            )

    @api.constrains("training_day_id", "enrollment_id")
    def _check_enrollment_belongs_to_day_program(self):
        for attendance in self:
            if (
                attendance.enrollment_id.program_id
                != attendance.training_day_id.course_id.program_id
            ):
                raise ValidationError(
                    _("The enrollment does not belong to this training day's "
                      "program.")
                )

    @api.model_create_multi
    def create(self, vals_list):
        if not self.env.su:
            Day = self.env["training.day"]
            Enrollment = self.env["training.enrollment"]
            for vals in vals_list:
                day_id = vals.get("training_day_id")
                if day_id:
                    self._check_day_open_for_attendance(Day.browse(day_id))
                # DEC-07: inactive or completed enrollees get no attendance
                # on new records.
                enrollment = Enrollment.browse(vals.get("enrollment_id"))
                if enrollment and enrollment.state != "active":
                    raise ValidationError(
                        _("Attendance can only be recorded for an active "
                          "enrollment.")
                    )
        return super().create(vals_list)

    def write(self, vals):
        if not self.env.su:
            new_day_id = vals.get("training_day_id")
            for attendance in self:
                day = (
                    self.env["training.day"].browse(new_day_id)
                    if new_day_id
                    else attendance.training_day_id
                )
                self._check_day_open_for_attendance(day)
        return super().write(vals)

    def unlink(self):
        # D6 / DEC-04: attendance of a closed, postponed or cancelled day
        # is history and is never deleted; while the day is open a
        # mistaken entry may still be removed.
        if not self.env.su:
            for attendance in self:
                if attendance.training_day_id.state != "open":
                    raise UserError(
                        _(
                            "Attendance of a training day that is not open "
                            "is history and cannot be deleted."
                        )
                    )
        return super().unlink()

    @api.constrains("status", "late_minutes")
    def _check_late_minutes(self):
        for attendance in self:
            if attendance.status != "late" and attendance.late_minutes:
                raise ValidationError(
                    _(
                        "Late minutes can only be set when the attendance "
                        "status is Late."
                    )
                )
            if attendance.status == "late" and attendance.late_minutes < 0:
                raise ValidationError(_("Late minutes cannot be negative."))

    def _get_dto(self):
        """Frontend-facing DTO (M4 point 15): "trainee_id" is the
        API-friendly name for enrollment_id, not partner_id."""
        self.ensure_one()
        return {
            "trainee_id": self.enrollment_id.id,
            "name": self.enrollment_id.partner_id.name,
            "status": self.status,
            "late_minutes": self.late_minutes if self.status == "late" else None,
        }
