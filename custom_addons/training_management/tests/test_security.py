from odoo.exceptions import AccessError
from odoo.tests.common import TransactionCase, tagged


@tagged("post_install", "-at_install", "training_management_security")
class TestTrainingSecurity(TransactionCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()

        def make_user(login, group_xmlid):
            return (
                cls.env["res.users"]
                .with_context(no_reset_password=True)
                .create(
                    {
                        "name": login,
                        "login": login,
                        "email": "%s@example.com" % login,
                        # base.group_user is required for these test
                        # users to operate as internal users at all;
                        # whether Trainee/Supervisor/Trainer end up
                        # portal or internal users in production is an
                        # open decision left to milestone M4.
                        "group_ids": [
                            (4, cls.env.ref("base.group_user").id),
                            (4, cls.env.ref(group_xmlid).id),
                        ],
                    }
                )
            )

        cls.trainee_user = make_user(
            "test_trainee", "training_management.group_training_trainee"
        )
        cls.supervisor_user = make_user(
            "test_supervisor", "training_management.group_training_supervisor"
        )
        cls.other_supervisor_user = make_user(
            "test_supervisor_other",
            "training_management.group_training_supervisor",
        )
        cls.trainer_user = make_user(
            "test_trainer", "training_management.group_training_trainer"
        )
        cls.other_trainer_user = make_user(
            "test_trainer_other", "training_management.group_training_trainer"
        )

        cls.trainee_partner = cls.env["res.partner"].create(
            {"name": "Security Test Trainee"}
        )
        cls.trainee_user.partner_id = cls.trainee_partner

        cls.program = cls.env["training.program"].create(
            {
                "name": "Security Program",
                "start_date": "2026-01-01",
                "end_date": "2026-04-30",
            }
        )
        cls.other_program = cls.env["training.program"].create(
            {
                "name": "Other Program",
                "start_date": "2026-01-01",
                "end_date": "2026-04-30",
            }
        )
        cls.course = cls.env["training.course"].create(
            {
                "program_id": cls.program.id,
                "name": "Security Course",
                "start_date": "2026-01-01",
                "end_date": "2026-01-31",
            }
        )
        cls.other_course = cls.env["training.course"].create(
            {
                "program_id": cls.other_program.id,
                "name": "Other Course",
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
                "trainer_ids": [(6, 0, [cls.trainer_user.id])],
                "survey_open_at": "2026-01-05 12:00:00",
                "survey_close_at": "2026-01-06 12:00:00",
            }
        )
        cls.other_day = cls.env["training.day"].create(
            {
                "course_id": cls.other_course.id,
                "date": "2026-01-06",
                "start_datetime": "2026-01-06 08:00:00",
                "end_datetime": "2026-01-06 12:00:00",
                "supervisor_id": cls.other_supervisor_user.id,
                "trainer_ids": [(6, 0, [cls.other_trainer_user.id])],
                "survey_open_at": "2026-01-06 12:00:00",
                "survey_close_at": "2026-01-07 12:00:00",
            }
        )
        cls.enrollment = cls.env["training.enrollment"].create(
            {"program_id": cls.program.id, "partner_id": cls.trainee_partner.id}
        )
        cls.attendance = cls.env["training.attendance"].create(
            {
                "training_day_id": cls.day.id,
                "enrollment_id": cls.enrollment.id,
                "status": "present",
            }
        )

    # ---- ACL matrix ----

    def test_trainee_cannot_write_or_create_admin_models(self):
        program_as_trainee = self.program.with_user(self.trainee_user)
        with self.assertRaises(AccessError):
            program_as_trainee.write({"name": "Hacked"})
        with self.assertRaises(AccessError):
            self.env["training.program"].with_user(self.trainee_user).create(
                {
                    "name": "New Program",
                    "start_date": "2026-01-01",
                    "end_date": "2026-02-01",
                }
            )
        with self.assertRaises(AccessError):
            program_as_trainee.unlink()

    def test_trainee_has_no_access_to_attendance(self):
        with self.assertRaises(AccessError):
            self.attendance.with_user(self.trainee_user).read(["status"])

    def test_trainer_has_no_access_to_enrollment(self):
        with self.assertRaises(AccessError):
            self.enrollment.with_user(self.trainer_user).read(["partner_id"])

    def test_trainer_has_no_access_to_attendance(self):
        with self.assertRaises(AccessError):
            self.attendance.with_user(self.trainer_user).read(["status"])

    def test_supervisor_cannot_write_training_day(self):
        # Supervisors record attendance/evaluation; they cannot edit
        # training day configuration (PROJECT_SPEC section 7.4).
        with self.assertRaises(AccessError):
            self.day.with_user(self.supervisor_user).write({"date": "2026-01-07"})

    def test_supervisor_can_manage_attendance_for_own_day(self):
        attendance_as_supervisor = self.attendance.with_user(self.supervisor_user)
        attendance_as_supervisor.write({"status": "late", "late_minutes": 5})
        self.assertEqual(self.attendance.status, "late")

    # ---- record rule isolation ----

    def test_supervisor_sees_only_assigned_days(self):
        days = self.env["training.day"].with_user(self.supervisor_user).search([])
        self.assertIn(self.day.id, days.ids)
        self.assertNotIn(self.other_day.id, days.ids)
        with self.assertRaises(AccessError):
            self.other_day.with_user(self.supervisor_user).read(["date"])

    def test_trainer_sees_only_assigned_days(self):
        days = self.env["training.day"].with_user(self.trainer_user).search([])
        self.assertIn(self.day.id, days.ids)
        self.assertNotIn(self.other_day.id, days.ids)
        with self.assertRaises(AccessError):
            self.other_day.with_user(self.trainer_user).read(["date"])

    def test_trainee_sees_only_enrolled_program_days(self):
        days = self.env["training.day"].with_user(self.trainee_user).search([])
        self.assertIn(self.day.id, days.ids)
        self.assertNotIn(self.other_day.id, days.ids)
        with self.assertRaises(AccessError):
            self.other_day.with_user(self.trainee_user).read(["date"])

    def test_supervisor_cannot_access_attendance_of_other_day(self):
        other_enrollment = self.env["training.enrollment"].create(
            {
                "program_id": self.other_program.id,
                "partner_id": self.env["res.partner"]
                .create({"name": "Other Trainee"})
                .id,
            }
        )
        other_attendance = self.env["training.attendance"].create(
            {
                "training_day_id": self.other_day.id,
                "enrollment_id": other_enrollment.id,
                "status": "present",
            }
        )
        with self.assertRaises(AccessError):
            other_attendance.with_user(self.supervisor_user).read(["status"])

    def test_supervisor_sees_only_enrollments_of_supervised_programs(self):
        enrollments = (
            self.env["training.enrollment"].with_user(self.supervisor_user).search([])
        )
        self.assertIn(self.enrollment.id, enrollments.ids)
