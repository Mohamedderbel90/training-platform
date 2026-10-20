from odoo.exceptions import UserError, ValidationError
from odoo.tests.common import TransactionCase, tagged
from .fixtures import day_supervisor, day_trainer


@tagged("post_install", "-at_install", "training_management_attendance")
class TestTrainingAttendance(TransactionCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
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
                "supervisor_id": day_supervisor(cls.env).id,
                "trainer_ids": [(6, 0, [day_trainer(cls.env).id])],
                "survey_open_at": "2026-01-05 12:00:00",
                "survey_close_at": "2026-01-06 12:00:00",
                # Open: the model-level creates below run through the
                # superuser test env, which the OPD-12 day-state gate
                # (training_attendance.py) bypasses regardless of state
                # (see TestAttendanceDayStateGate below for the gate
                # itself, exercised via a non-superuser user) -- kept
                # "open" here anyway so this fixture matches a normal
                # in-progress training day rather than an edge case.
                "state": "open",
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


@tagged("post_install", "-at_install", "training_management_attendance")
class TestAttendanceDayStateGate(TransactionCase):
    """OPD-12: attendance is freely creatable/editable while its
    training.day is "open", and must stop being writable once the day
    reaches a non-open state (closed/postponed/cancelled) -- the exact
    same `state != "open"` gate training.day.check_survey_access()
    already applies to survey submission. Uses a real (non-superuser)
    supervisor via with_user(), because the TransactionCase default
    self.env runs as the superuser, which this gate (like
    survey_user_input.py's own day-state check) deliberately bypasses."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.supervisor_user = (
            cls.env["res.users"]
            .with_context(no_reset_password=True)
            .create(
                {
                    "name": "Attendance Gate Supervisor",
                    "login": "attendance_gate_supervisor",
                    "email": "attendance_gate_supervisor@example.com",
                    "group_ids": [
                        (4, cls.env.ref("base.group_user").id),
                        (
                            4,
                            cls.env.ref(
                                "training_management.group_training_supervisor"
                            ).id,
                        ),
                    ],
                }
            )
        )
        cls.partner = cls.env["res.partner"].create({"name": "Gate Trainee"})
        cls.program = cls.env["training.program"].create(
            {
                "name": "Gate Program",
                "start_date": "2026-01-01",
                "end_date": "2026-04-30",
            }
        )
        cls.course = cls.env["training.course"].create(
            {
                "program_id": cls.program.id,
                "name": "Gate Course",
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
                "supervisor_id": cls.supervisor_user.id,
                "trainer_ids": [(6, 0, [day_trainer(cls.env).id])],
                "survey_open_at": "2026-01-05 12:00:00",
                "survey_close_at": "2026-01-06 12:00:00",
                "state": "open",
            }
        )
        cls.enrollment = cls.env["training.enrollment"].create(
            {"program_id": cls.program.id, "partner_id": cls.partner.id}
        )

    def _create_as_supervisor(self, **overrides):
        values = {
            "training_day_id": self.day.id,
            "enrollment_id": self.enrollment.id,
            "status": "present",
        }
        values.update(overrides)
        return (
            self.env["training.attendance"]
            .with_user(self.supervisor_user)
            .create(values)
        )

    def test_create_allowed_while_day_open(self):
        attendance = self._create_as_supervisor()
        self.assertEqual(attendance.status, "present")

    def test_write_allowed_while_day_open(self):
        attendance = self._create_as_supervisor()
        attendance.with_user(self.supervisor_user).write({"status": "absent"})
        self.assertEqual(attendance.status, "absent")

    def test_create_rejected_once_day_closed(self):
        self.day.action_close()
        with self.assertRaises(UserError):
            self._create_as_supervisor()

    def test_write_rejected_once_day_closed(self):
        attendance = self._create_as_supervisor()
        self.day.action_close()
        with self.assertRaises(UserError):
            attendance.with_user(self.supervisor_user).write({"status": "absent"})

    def test_write_rejected_once_day_postponed(self):
        attendance = self._create_as_supervisor()
        self.day.status_reason = "Postponed for the test"
        self.day.action_postpone()
        with self.assertRaises(UserError):
            attendance.with_user(self.supervisor_user).write(
                {"status": "late", "late_minutes": 5}
            )

    def test_write_rejected_once_day_cancelled(self):
        attendance = self._create_as_supervisor()
        self.day.status_reason = "Cancelled for the test"
        self.day.action_cancel()
        with self.assertRaises(UserError):
            attendance.with_user(self.supervisor_user).write({"status": "absent"})

    def test_read_allowed_after_day_closed(self):
        """Closing the day must not prevent viewing previously recorded
        attendance -- only create()/write() are gated, never read()."""
        attendance = self._create_as_supervisor()
        self.day.action_close()
        record = attendance.with_user(self.supervisor_user).read(["status"])[0]
        self.assertEqual(record["status"], "present")
