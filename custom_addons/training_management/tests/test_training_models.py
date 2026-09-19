from odoo.exceptions import UserError, ValidationError
from odoo.tests.common import TransactionCase, tagged


@tagged("post_install", "-at_install", "training_management_models")
class TestTrainingModels(TransactionCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.supervisor_user = cls.env.ref("base.user_admin")
        cls.trainer_user = cls.env.ref("base.user_admin")
        cls.partner = cls.env["res.partner"].create({"name": "Test Trainee"})

    def _create_program(self, **overrides):
        values = {
            "name": "Test Program",
            "start_date": "2026-01-01",
            "end_date": "2026-04-30",
        }
        values.update(overrides)
        return self.env["training.program"].create(values)

    def _create_course(self, program, **overrides):
        values = {
            "program_id": program.id,
            "name": "Test Course",
            "start_date": "2026-01-01",
            "end_date": "2026-01-31",
        }
        values.update(overrides)
        return self.env["training.course"].create(values)

    def _create_day(self, course, **overrides):
        values = {
            "course_id": course.id,
            "date": "2026-01-05",
            "start_datetime": "2026-01-05 08:00:00",
            "end_datetime": "2026-01-05 12:00:00",
            "supervisor_id": self.supervisor_user.id,
            "trainer_ids": [(6, 0, [self.trainer_user.id])],
            "survey_open_at": "2026-01-05 12:00:00",
            "survey_close_at": "2026-01-06 12:00:00",
        }
        values.update(overrides)
        return self.env["training.day"].create(values)

    def _create_enrollment(self, program, partner=None, **overrides):
        values = {
            "program_id": program.id,
            "partner_id": (partner or self.partner).id,
        }
        values.update(overrides)
        return self.env["training.enrollment"].create(values)

    # ---- creation of all models ----

    def test_create_all_models(self):
        program = self._create_program()
        course = self._create_course(program)
        day = self._create_day(course)
        enrollment = self._create_enrollment(program)
        attendance = self.env["training.attendance"].create(
            {
                "training_day_id": day.id,
                "enrollment_id": enrollment.id,
                "status": "present",
            }
        )
        self.assertTrue(program.exists())
        self.assertTrue(course.exists())
        self.assertTrue(day.exists())
        self.assertTrue(enrollment.exists())
        self.assertTrue(attendance.exists())
        self.assertEqual(course.program_id, program)
        self.assertEqual(day.course_id, course)
        self.assertEqual(attendance.training_day_id, day)
        self.assertEqual(attendance.enrollment_id, enrollment)

    # ---- date constraints ----

    def test_program_end_before_start_rejected(self):
        with self.assertRaises(ValidationError):
            self._create_program(start_date="2026-05-01", end_date="2026-04-01")

    def test_program_end_equal_start_allowed(self):
        program = self._create_program(start_date="2026-05-01", end_date="2026-05-01")
        self.assertTrue(program.exists())

    def test_course_end_before_start_rejected(self):
        program = self._create_program()
        with self.assertRaises(ValidationError):
            self._create_course(
                program, start_date="2026-02-01", end_date="2026-01-01"
            )

    def test_day_end_before_or_equal_start_rejected(self):
        program = self._create_program()
        course = self._create_course(program)
        with self.assertRaises(ValidationError):
            self._create_day(
                course,
                start_datetime="2026-01-05 10:00:00",
                end_datetime="2026-01-05 10:00:00",
            )

    def test_survey_close_before_or_equal_open_rejected(self):
        program = self._create_program()
        course = self._create_course(program)
        with self.assertRaises(ValidationError):
            self._create_day(
                course,
                survey_open_at="2026-01-05 12:00:00",
                survey_close_at="2026-01-05 12:00:00",
            )

    # ---- enrollment uniqueness ----

    def test_enrollment_unique_per_program(self):
        program = self._create_program()
        self._create_enrollment(program)
        with self.assertRaises(Exception):
            self._create_enrollment(program)

    def test_same_partner_can_enroll_in_different_programs(self):
        program_a = self._create_program(name="Program A")
        program_b = self._create_program(name="Program B")
        self._create_enrollment(program_a)
        enrollment_b = self._create_enrollment(program_b)
        self.assertTrue(enrollment_b.exists())

    # ---- archive behavior ----

    def test_program_archive_instead_of_delete(self):
        program = self._create_program(state="active")
        program.active = False
        self.assertFalse(program.active)
        self.assertTrue(program.exists())
        # Archived (non-draft) programs cannot be hard-deleted.
        with self.assertRaises(UserError):
            program.unlink()

    def test_draft_program_can_be_deleted(self):
        program = self._create_program(state="draft")
        program.unlink()
        self.assertFalse(program.exists())

    def test_course_with_days_cannot_be_deleted(self):
        program = self._create_program()
        course = self._create_course(program)
        self._create_day(course)
        with self.assertRaises(UserError):
            course.unlink()

    def test_day_not_planned_cannot_be_deleted(self):
        program = self._create_program()
        course = self._create_course(program)
        day = self._create_day(course, state="open")
        with self.assertRaises(UserError):
            day.unlink()

    def test_planned_day_can_be_deleted(self):
        program = self._create_program()
        course = self._create_course(program)
        day = self._create_day(course, state="planned")
        day.unlink()
        self.assertFalse(day.exists())

    def test_enrollment_with_attendance_cannot_be_deleted(self):
        program = self._create_program()
        course = self._create_course(program)
        day = self._create_day(course)
        enrollment = self._create_enrollment(program)
        self.env["training.attendance"].create(
            {
                "training_day_id": day.id,
                "enrollment_id": enrollment.id,
                "status": "present",
            }
        )
        with self.assertRaises(UserError):
            enrollment.unlink()

    # ---- display_name (training.day / training.enrollment have no
    # `name` field and no _rec_name; without a _compute_display_name
    # override, Odoo 19's own default falls back to the literal
    # f"{model},{id}" string -- verified against odoo/orm/models.py --
    # which is exactly the bug reported against the Attendance Records
    # view. Testing display_name directly on these two models covers
    # every Many2one/breadcrumb/search result referencing them anywhere,
    # not just Attendance, since display_name is computed once per
    # record regardless of which view/widget reads it. ----

    def test_training_day_display_name_has_course_and_date(self):
        program = self._create_program()
        course = self._create_course(program, name="Leadership Foundations")
        day = self._create_day(course, date="2026-01-05")
        self.assertIn("Leadership Foundations", day.display_name)
        self.assertIn("01/05/2026", day.display_name)
        self.assertNotIn("training.day,", day.display_name)

    def test_training_day_display_name_without_date_falls_back_to_course(self):
        program = self._create_program()
        course = self._create_course(program, name="Leadership Foundations")
        day = self._create_day(course)
        day.date = False
        self.assertEqual(day.display_name, "Leadership Foundations")

    def test_training_day_display_name_follows_language_context(self):
        self.env["res.lang"]._activate_lang("ar_001")
        program = self._create_program()
        course = self._create_course(program, name="Leadership Foundations")
        course.with_context(lang="ar_001").write({"name": "أساسيات القيادة"})
        day = self._create_day(course, date="2026-01-05")
        self.assertIn("Leadership Foundations", day.with_context(lang="en_US").display_name)
        self.assertIn("أساسيات القيادة", day.with_context(lang="ar_001").display_name)

    def test_enrollment_display_name_has_trainee_and_program(self):
        program = self._create_program(name="Leadership Program")
        partner = self.env["res.partner"].create({"name": "Fatima Al-Otaibi"})
        enrollment = self._create_enrollment(program, partner=partner)
        self.assertEqual(enrollment.display_name, "Fatima Al-Otaibi (Leadership Program)")
        self.assertNotIn("training.enrollment,", enrollment.display_name)

    def test_enrollment_display_name_follows_language_context(self):
        self.env["res.lang"]._activate_lang("ar_001")
        program = self._create_program(name="Leadership Program")
        program.with_context(lang="ar_001").write({"name": "برنامج القيادة"})
        partner = self.env["res.partner"].create({"name": "Fatima Al-Otaibi"})
        enrollment = self._create_enrollment(program, partner=partner)
        self.assertEqual(
            enrollment.with_context(lang="en_US").display_name,
            "Fatima Al-Otaibi (Leadership Program)",
        )
        self.assertEqual(
            enrollment.with_context(lang="ar_001").display_name,
            "Fatima Al-Otaibi (برنامج القيادة)",
        )

    def test_attendance_many2one_labels_are_readable(self):
        """Reproduces the exact reported bug: opening Attendance
        Records and looking at the Training Day / Enrollment columns
        must never show the raw "training.day,<id>" / raw id form."""
        program = self._create_program()
        course = self._create_course(program, name="Leadership Foundations")
        day = self._create_day(course, date="2026-01-05")
        enrollment = self._create_enrollment(program)
        attendance = self.env["training.attendance"].create(
            {
                "training_day_id": day.id,
                "enrollment_id": enrollment.id,
                "status": "present",
            }
        )
        self.assertNotIn("training.day,", attendance.training_day_id.display_name)
        self.assertNotIn("training.enrollment,", attendance.enrollment_id.display_name)
        self.assertIn("Leadership Foundations", attendance.training_day_id.display_name)
        self.assertIn(self.partner.name, attendance.enrollment_id.display_name)
