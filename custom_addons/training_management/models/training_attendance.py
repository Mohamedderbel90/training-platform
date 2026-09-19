from odoo import _, api, fields, models
from odoo.exceptions import ValidationError


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
        default="present",
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
