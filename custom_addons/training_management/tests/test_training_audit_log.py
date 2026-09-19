from datetime import timedelta

from odoo import fields
from odoo.exceptions import AccessError, UserError
from odoo.tests.common import TransactionCase, tagged


@tagged("post_install", "-at_install", "training_management_audit")
class TestTrainingAuditLog(TransactionCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.Log = cls.env["training.audit.log"]
        cls.admin_user = cls.env.ref("base.user_admin")

        def make_user(login, group_xmlid):
            return (
                cls.env["res.users"]
                .with_context(no_reset_password=True)
                .create(
                    {
                        "name": login,
                        "login": login,
                        "email": "%s@example.com" % login,
                        "group_ids": [
                            (4, cls.env.ref("base.group_user").id),
                            (4, cls.env.ref(group_xmlid).id),
                        ],
                    }
                )
            )

        cls.trainee_user = make_user(
            "audit_trainee", "training_management.group_training_trainee"
        )

        cls.program = cls.env["training.program"].create(
            {
                "name": "Audit Program",
                "start_date": "2000-01-01",
                "end_date": "2099-12-31",
            }
        )
        cls.course = cls.env["training.course"].create(
            {
                "program_id": cls.program.id,
                "name": "Audit Course",
                "start_date": "2000-01-01",
                "end_date": "2099-12-31",
            }
        )
        now = fields.Datetime.now()
        cls.day = cls.env["training.day"].create(
            {
                "course_id": cls.course.id,
                "date": fields.Date.today(),
                "start_datetime": now - timedelta(hours=2),
                "end_datetime": now + timedelta(hours=2),
                "state": "closed",
                "supervisor_id": cls.admin_user.id,
                "trainer_ids": [(6, 0, [cls.admin_user.id])],
                "survey_open_at": now - timedelta(hours=1),
                "survey_close_at": now + timedelta(hours=1),
            }
        )

    def test_day_reopen_is_logged(self):
        before = self.Log.search_count(
            [("event_type", "=", "day_reopen"), ("res_id", "=", self.day.id)]
        )
        self.day.action_reopen()
        after = self.Log.search_count(
            [("event_type", "=", "day_reopen"), ("res_id", "=", self.day.id)]
        )
        self.assertEqual(after, before + 1)
        entry = self.Log.search(
            [("event_type", "=", "day_reopen"), ("res_id", "=", self.day.id)],
            limit=1,
            order="id desc",
        )
        self.assertEqual(entry.model_name, "training.day")

    def test_report_approval_is_logged(self):
        report = self.env["training.report"].create(
            {
                "report_type": "course",
                "program_id": self.program.id,
                "course_id": self.course.id,
            }
        )
        admin_group_user = (
            self.env["res.users"]
            .with_context(no_reset_password=True)
            .create(
                {
                    "name": "audit_report_admin",
                    "login": "audit_report_admin",
                    "email": "audit_report_admin@example.com",
                    "group_ids": [
                        (4, self.env.ref("base.group_user").id),
                        (
                            4,
                            self.env.ref(
                                "training_management.group_training_admin"
                            ).id,
                        ),
                    ],
                }
            )
        )
        report.action_generate()
        report.with_user(admin_group_user).action_approve()
        entry = self.Log.search(
            [("event_type", "=", "report_approval"), ("res_id", "=", report.id)]
        )
        self.assertEqual(len(entry), 1)
        self.assertEqual(entry.model_name, "training.report")

    def test_permission_change_is_logged_for_project_groups(self):
        admin_group = self.env.ref("training_management.group_training_admin")
        before = self.Log.search_count(
            [
                ("event_type", "=", "permission_change"),
                ("res_id", "=", self.trainee_user.id),
            ]
        )
        self.trainee_user.write({"group_ids": [(4, admin_group.id)]})
        after = self.Log.search_count(
            [
                ("event_type", "=", "permission_change"),
                ("res_id", "=", self.trainee_user.id),
            ]
        )
        self.assertEqual(after, before + 1)

    def test_unrelated_group_change_is_not_logged(self):
        other_group = self.env.ref("base.group_no_one")
        before = self.Log.search_count(
            [
                ("event_type", "=", "permission_change"),
                ("res_id", "=", self.trainee_user.id),
            ]
        )
        self.trainee_user.write({"group_ids": [(4, other_group.id)]})
        after = self.Log.search_count(
            [
                ("event_type", "=", "permission_change"),
                ("res_id", "=", self.trainee_user.id),
            ]
        )
        self.assertEqual(after, before)

    def test_audit_log_not_writable_or_deletable_by_any_group(self):
        """PROJECT_SPEC section 17: "Audit records are not editable from
        normal user interfaces." The model's own write()/unlink()
        override raises unconditionally, before super().write() ever
        runs -- so this fires even for an admin-group user, without
        ever reaching ir.model.access.csv's own perm_write=0 (which
        also denies it independently, but is never actually reached
        here since the override raises first)."""
        admin_group_user = (
            self.env["res.users"]
            .with_context(no_reset_password=True)
            .create(
                {
                    "name": "audit_immutable_admin",
                    "login": "audit_immutable_admin",
                    "email": "audit_immutable_admin@example.com",
                    "group_ids": [
                        (4, self.env.ref("base.group_user").id),
                        (
                            4,
                            self.env.ref(
                                "training_management.group_training_admin"
                            ).id,
                        ),
                    ],
                }
            )
        )
        self.day.action_reopen()
        entry = self.Log.search(
            [("event_type", "=", "day_reopen"), ("res_id", "=", self.day.id)],
            limit=1,
        )
        with self.assertRaises(UserError):
            entry.with_user(admin_group_user).write({"description": "tampered"})
        with self.assertRaises(UserError):
            entry.with_user(admin_group_user).unlink()

    def test_audit_log_guard_blocks_direct_sudo_write_bypassing_service(self):
        """The model-level guard itself (not ACL): even under sudo(),
        which is the only way write() ever reaches the model's own
        code, a direct write bypassing _log() is rejected -- only the
        service method's own internal sudo().create() is exempt,
        because it never calls write() on an existing record at all."""
        self.day.action_reopen()
        entry = self.Log.search(
            [("event_type", "=", "day_reopen"), ("res_id", "=", self.day.id)],
            limit=1,
        )
        with self.assertRaises(UserError):
            entry.sudo().write({"description": "tampered"})

    def test_trainee_cannot_read_audit_log(self):
        self.day.action_reopen()
        with self.assertRaises(AccessError):
            self.Log.with_user(self.trainee_user).search([])
