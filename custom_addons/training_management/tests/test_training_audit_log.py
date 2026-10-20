from datetime import timedelta

from odoo import fields
from odoo.exceptions import AccessError, UserError
from odoo.tests.common import TransactionCase, tagged
from .fixtures import day_supervisor, day_trainer


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
        cls.admin_group_user = (
            cls.env["res.users"]
            .with_context(no_reset_password=True)
            .create(
                {
                    "name": "audit_correction_admin",
                    "login": "audit_correction_admin",
                    "email": "audit_correction_admin@example.com",
                    "group_ids": [
                        (4, cls.env.ref("base.group_user").id),
                        (
                            4,
                            cls.env.ref(
                                "training_management.group_training_admin"
                            ).id,
                        ),
                    ],
                }
            )
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
                "supervisor_id": day_supervisor(cls.env).id,
                "trainer_ids": [(6, 0, [day_trainer(cls.env).id])],
                "survey_open_at": now - timedelta(hours=1),
                "survey_close_at": now + timedelta(hours=1),
            }
        )

        # A separate, still-open day with a real trainee survey attached,
        # used only by the response-correction tests below: a final
        # (state='done') survey.user_input can only come from the normal
        # submit flow (get_or_create_survey_response() + the trainee's
        # own finalizing write()), never from a direct create().
        cls.env["training.enrollment"].create(
            {"program_id": cls.program.id, "partner_id": cls.trainee_user.partner_id.id}
        )
        cls.trainee_survey = cls.env["survey.survey"].create(
            {"title": "Audit Trainee Survey", "survey_role": "trainee"}
        )
        cls.open_day = cls.env["training.day"].create(
            {
                "course_id": cls.course.id,
                "date": fields.Date.today(),
                "start_datetime": now - timedelta(hours=2),
                "end_datetime": now + timedelta(hours=2),
                "state": "open",
                "supervisor_id": day_supervisor(cls.env).id,
                "trainer_ids": [(6, 0, [day_trainer(cls.env).id])],
                "survey_open_at": now - timedelta(hours=1),
                "survey_close_at": now + timedelta(hours=1),
                "trainee_survey_id": cls.trainee_survey.id,
            }
        )

    def _make_final_response(self):
        """A finalized (state='done') trainee response on cls.open_day,
        created and submitted the normal way."""
        response = self.open_day.get_or_create_survey_response(
            "trainee", user=self.trainee_user
        )
        response.with_user(self.trainee_user).write({"state": "done"})
        self.assertEqual(response.state, "done")
        # Rebind to a plain, well-known user (not the trainee) so callers
        # simulating an administrative sudo() correction control exactly
        # which uid performs it, instead of inheriting the trainee's.
        return response.with_user(self.admin_user)

    def test_privileged_correction_of_done_response_is_logged(self):
        """SRS section 6.11 / PROJECT_SPEC section 17: an administrative
        correction of an already-final response must be audited. Today
        the only path able to reach it at all is a sudo()-scoped write
        (ADR-003); this asserts that path now leaves a trace."""
        response = self._make_final_response()
        before = self.Log.search_count(
            [
                ("event_type", "=", "response_correction"),
                ("res_id", "=", response.id),
                ("model_name", "=", "survey.user_input"),
            ]
        )
        new_end = fields.Datetime.now() + timedelta(minutes=5)
        response.sudo().with_context(correction_reason="Typo fix").write(
            {"end_datetime": new_end}
        )
        after = self.Log.search_count(
            [
                ("event_type", "=", "response_correction"),
                ("res_id", "=", response.id),
                ("model_name", "=", "survey.user_input"),
            ]
        )
        self.assertEqual(after, before + 1)
        entry = self.Log.search(
            [
                ("event_type", "=", "response_correction"),
                ("res_id", "=", response.id),
                ("model_name", "=", "survey.user_input"),
            ],
            limit=1,
            order="id desc",
        )
        self.assertEqual(entry.user_id, self.admin_user)
        self.assertIn("end_datetime", entry.description)
        self.assertIn("Reason: Typo fix", entry.description)
        # The respondent role is shown as its label, not the raw key.
        self.assertIn("(Trainee)", entry.description)
        self.assertNotIn("(trainee)", entry.description)

    def test_non_privileged_write_to_done_response_still_raises(self):
        """No regression: the pre-existing block on non-su writes to a
        final response is untouched by this change."""
        response = self._make_final_response()
        with self.assertRaises(UserError):
            response.with_user(self.trainee_user).write(
                {"end_datetime": fields.Datetime.now()}
            )
        # Even the training-admin group alone (without sudo()) is still
        # blocked -- only self.env.su may reach the correction path.
        with self.assertRaises(UserError):
            response.with_user(self.admin_group_user).write(
                {"end_datetime": fields.Datetime.now()}
            )
        before = self.Log.search_count(
            [
                ("event_type", "=", "response_correction"),
                ("res_id", "=", response.id),
            ]
        )
        self.assertEqual(before, 0)

    def test_response_correction_log_entry_is_immutable(self):
        """training.audit.log's own write()/unlink() guard must still
        reject any attempt to alter a response_correction entry, exactly
        as for every other event type."""
        response = self._make_final_response()
        response.sudo().with_context(correction_reason="Test").write(
            {"end_datetime": fields.Datetime.now()}
        )
        entry = self.Log.search(
            [
                ("event_type", "=", "response_correction"),
                ("res_id", "=", response.id),
            ],
            limit=1,
            order="id desc",
        )
        with self.assertRaises(UserError):
            entry.with_user(self.admin_group_user).write({"description": "tampered"})
        with self.assertRaises(UserError):
            entry.sudo().write({"description": "tampered"})
        with self.assertRaises(UserError):
            entry.with_user(self.admin_group_user).unlink()
        with self.assertRaises(UserError):
            entry.sudo().unlink()

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
