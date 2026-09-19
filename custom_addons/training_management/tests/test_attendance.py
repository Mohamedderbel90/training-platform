from odoo.exceptions import ValidationError
from odoo.tests.common import TransactionCase, tagged


@tagged("post_install", "-at_install", "training_management_attendance")
class TestTrainingAttendance(TransactionCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        admin = cls.env.ref("base.user_admin")
        partner = cls.env["res.partner"].create({"name": "Attendance Trainee"})
        cls.program = cls.env["training.program"].create(
            {
                "name": "Attendance Program",
                "start_date": "2026-01-01",
                "end_date": "2026-04-30",
            }
        )
        cls.course = cls.env["training.course"].create(
            {
                "program_id": cls.program.id,
                "name": "Attendance Course",
                "start_date": "2026-01-01",
                "end_date": "2026-01-31",
            }
        )
        cls.day = cls.env["training.day"].create(
            {
                "course_id": cls.course.id,
                "date": "2026-01-05",
                "start_datetime": "2026-01-05 08:00:00",
                "end_datetime": "2026-01-05 12:00:00",
                "supervisor_id": admin.id,
                "trainer_ids": [(6, 0, [admin.id])],
                "survey_open_at": "2026-01-05 12:00:00",
                "survey_close_at": "2026-01-06 12:00:00",
            }
        )
        cls.enrollment = cls.env["training.enrollment"].create(
            {"program_id": cls.program.id, "partner_id": partner.id}
        )

    def test_valid_statuses(self):
        for status in ("present", "absent", "late"):
            attendance = self.env["training.attendance"].create(
                {
                    "training_day_id": self.day.id,
                    "enrollment_id": self._other_enrollment(status),
                    "status": status,
                    "late_minutes": 10 if status == "late" else 0,
                }
            )
            self.assertEqual(attendance.status, status)

    def _other_enrollment(self, tag):
        partner = self.env["res.partner"].create({"name": "Trainee %s" % tag})
        other_program_enrollment = self.env["training.enrollment"].create(
            {"program_id": self.program.id, "partner_id": partner.id}
        )
        return other_program_enrollment.id

    def test_invalid_status_rejected(self):
        with self.assertRaises(Exception):
            self.env["training.attendance"].create(
                {
                    "training_day_id": self.day.id,
                    "enrollment_id": self.enrollment.id,
                    "status": "excused",
                }
            )

    def test_attendance_unique_per_day_and_enrollment(self):
        self.env["training.attendance"].create(
            {
                "training_day_id": self.day.id,
                "enrollment_id": self.enrollment.id,
                "status": "present",
            }
        )
        with self.assertRaises(Exception):
            self.env["training.attendance"].create(
                {
                    "training_day_id": self.day.id,
                    "enrollment_id": self.enrollment.id,
                    "status": "absent",
                }
            )

    def test_late_minutes_requires_late_status(self):
        with self.assertRaises(ValidationError):
            self.env["training.attendance"].create(
                {
                    "training_day_id": self.day.id,
                    "enrollment_id": self.enrollment.id,
                    "status": "present",
                    "late_minutes": 15,
                }
            )

    def test_late_minutes_allowed_when_late(self):
        attendance = self.env["training.attendance"].create(
            {
                "training_day_id": self.day.id,
                "enrollment_id": self.enrollment.id,
                "status": "late",
                "late_minutes": 15,
            }
        )
        self.assertEqual(attendance.late_minutes, 15)

    def test_negative_late_minutes_rejected(self):
        with self.assertRaises(ValidationError):
            self.env["training.attendance"].create(
                {
                    "training_day_id": self.day.id,
                    "enrollment_id": self.enrollment.id,
                    "status": "late",
                    "late_minutes": -5,
                }
            )
