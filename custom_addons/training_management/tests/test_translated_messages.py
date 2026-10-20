from odoo.exceptions import UserError, ValidationError
from odoo.tests.common import TransactionCase, tagged

from .fixtures import day_supervisor, day_trainer


@tagged("post_install", "-at_install", "training_management_i18n")
class TestTranslatedMessages(TransactionCase):
    """User-facing validation messages are translated, and interpolate
    translated labels -- never raw state keys or internal role keys."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.env["res.lang"]._activate_lang("ar_001")
        cls.env["ir.module.module"]._load_module_terms(
            ["training_management"], ["ar_001"], overwrite=True
        )
        program = cls.env["training.program"].create(
            {"name": "I18n Program", "start_date": "2026-01-01", "end_date": "2026-04-30"}
        )
        course = cls.env["training.course"].create(
            {"program_id": program.id, "name": "I18n Course",
             "start_date": "2026-01-01", "end_date": "2026-01-31"}
        )
        cls.supervisor_user = day_supervisor(cls.env)
        cls.day = cls.env["training.day"].create(
            {
                "course_id": course.id,
                "date": "2026-01-05",
                "start_datetime": "2026-01-05 08:00:00",
                "end_datetime": "2026-01-05 12:00:00",
                "supervisor_id": cls.supervisor_user.id,
                "trainer_ids": [(6, 0, [day_trainer(cls.env).id])],
                "survey_open_at": "2026-01-05 12:00:00",
                "survey_close_at": "2026-01-06 12:00:00",
            }
        )
        partner = cls.env["res.partner"].create({"name": "I18n Trainee"})
        cls.enrollment = cls.env["training.enrollment"].create(
            {"program_id": program.id, "partner_id": partner.id}
        )

    def _message(self, exc_type, func):
        with self.assertRaises(exc_type) as ctx:
            func()
        return str(ctx.exception)

    def test_day_time_validation_messages_are_arabic(self):
        day = self.day.with_context(lang="ar_001")
        msg = self._message(
            ValidationError, lambda: day.write({"end_datetime": "2026-01-05 07:00:00"})
        )
        self.assertIn("وقت النهاية", msg)
        self.assertNotIn("must be after", msg)
        msg = self._message(
            ValidationError, lambda: day.write({"survey_close_at": "2026-01-05 11:00:00"})
        )
        self.assertIn("وقت إغلاق الاستبانة", msg)
        self.assertNotIn("must be after", msg)

    def test_day_delete_refusal_is_arabic(self):
        self.day.state = "open"
        day = self.day.with_context(lang="ar_001")
        msg = self._message(UserError, day.unlink)
        self.assertIn("لا يُحذف إلا اليوم التدريبي المخطط", msg)
        self.assertNotIn("Only planned", msg)

    def test_attendance_message_uses_the_state_label_not_the_key(self):
        self.day.action_open()
        self.day.action_close()
        values = {"training_day_id": self.day.id, "enrollment_id": self.enrollment.id,
                  "status": "present"}
        attendance = self.env["training.attendance"].with_user(self.supervisor_user)
        english = self._message(UserError, lambda: attendance.create(values))
        self.assertIn("(current state: Closed)", english)
        arabic = self._message(
            UserError, lambda: attendance.with_context(lang="ar_001").create(values)
        )
        self.assertIn("مغلق", arabic)
        self.assertNotIn("closed", arabic)

    def test_single_role_message_names_the_roles_in_arabic(self):
        user = self.env["res.users"].with_context(no_reset_password=True).create(
            {"name": "Two Roles", "login": "two_roles_i18n", "email": "t@example.com",
             "group_ids": [(4, self.env.ref("training_management.group_training_trainee").id)]}
        )
        both = [(4, self.env.ref("training_management.group_training_trainer").id)]
        msg = self._message(
            ValidationError, lambda: user.with_context(lang="ar_001").write({"group_ids": both})
        )
        self.assertIn("متدربة", msg)
        self.assertIn("مدربة", msg)
        self.assertNotIn("trainee", msg)
