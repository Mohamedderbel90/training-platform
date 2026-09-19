from datetime import timedelta

from odoo import fields
from odoo.exceptions import AccessError, UserError, ValidationError
from odoo.tests.common import TransactionCase, tagged


@tagged("post_install", "-at_install", "training_management_report")
class TestTrainingReport(TransactionCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.analytics = cls.env["training.analytics"]
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

        # A real (non-superuser) admin-group user: TransactionCase's
        # default self.env runs as the superuser, which self.env.su
        # -guarded checks (write()'s immutability lock, action_approve()'s
        # has_group() check) bypass or fail entirely -- every assertion
        # below that needs these business rules to actually fire uses
        # this user via with_user(), matching the pattern already used
        # throughout test_survey_user_input.py for the same reason.
        cls.admin_group_user = make_user(
            "report_admin", "training_management.group_training_admin"
        )
        cls.assistant_admin_user = make_user(
            "report_assistant_admin",
            "training_management.group_training_assistant_admin",
        )
        cls.trainee_user = make_user(
            "report_trainee", "training_management.group_training_trainee"
        )

        cls.program = cls.env["training.program"].create(
            {
                "name": "Report Program",
                "start_date": "2000-01-01",
                "end_date": "2099-12-31",
            }
        )
        # Wide date ranges (rather than a fixed year) so this fixture
        # does not depend on which real-world date the test suite
        # happens to run on -- the training day below uses today's
        # actual date (fields.Date.today()), which must fall inside
        # the course's own start/end for the date-driven
        # training.report scope resolution (_resolve_dates()) to
        # include it, matching what an unfiltered analytics call sees.
        cls.course = cls.env["training.course"].create(
            {
                "program_id": cls.program.id,
                "name": "Report Course",
                "start_date": "2000-01-01",
                "end_date": "2099-12-31",
            }
        )
        cls.other_course = cls.env["training.course"].create(
            {
                "program_id": cls.program.id,
                "name": "Other Course",
                "start_date": "2000-01-01",
                "end_date": "2099-12-31",
            }
        )

        cls.survey = cls.env["survey.survey"].create(
            {"title": "Report Trainee Survey", "survey_role": "trainee"}
        )
        cls.q_trainer = cls.env["survey.question"].create(
            {
                "survey_id": cls.survey.id,
                "title": "Trainer performance",
                "question_type": "simple_choice",
                "kpi_category": "trainer_performance",
            }
        )
        cls.option_good = cls.env["survey.question.answer"].create(
            {
                "question_id": cls.q_trainer.id,
                "value": "Very Good",
                "rating_value": 4,
            }
        )

        now = fields.Datetime.now()
        cls.day = cls.env["training.day"].create(
            {
                "course_id": cls.course.id,
                "date": fields.Date.today(),
                "start_datetime": now - timedelta(hours=2),
                "end_datetime": now + timedelta(hours=2),
                "supervisor_id": cls.admin_user.id,
                "trainer_ids": [(6, 0, [cls.admin_user.id])],
                "survey_open_at": now - timedelta(hours=1),
                "survey_close_at": now + timedelta(hours=1),
            }
        )
        cls.partner = cls.env["res.partner"].create({"name": "Report Trainee"})
        cls.enrollment = cls.env["training.enrollment"].create(
            {"program_id": cls.program.id, "partner_id": cls.partner.id}
        )
        cls.env["training.attendance"].create(
            {
                "training_day_id": cls.day.id,
                "enrollment_id": cls.enrollment.id,
                "status": "present",
            }
        )
        user_input = cls.env["survey.user_input"].create(
            {
                "survey_id": cls.survey.id,
                "training_day_id": cls.day.id,
                "respondent_role": "trainee",
                "partner_id": cls.partner.id,
                "state": "in_progress",
            }
        )
        cls.env["survey.user_input.line"].create(
            {
                "user_input_id": user_input.id,
                "question_id": cls.q_trainer.id,
                "answer_type": "suggestion",
                "suggested_answer_id": cls.option_good.id,
                "skipped": False,
            }
        )
        user_input.write({"state": "done"})

    def _create_course_report(self, **overrides):
        values = {
            "report_type": "course",
            "program_id": self.program.id,
            "course_id": self.course.id,
        }
        values.update(overrides)
        return self.env["training.report"].create(values)

    # ---- creation / constraints ----

    def test_course_report_requires_course(self):
        with self.assertRaises(ValidationError):
            self.env["training.report"].create(
                {"report_type": "course", "program_id": self.program.id}
            )

    def test_course_must_belong_to_program(self):
        unrelated_program = self.env["training.program"].create(
            {
                "name": "Unrelated Program",
                "start_date": "2026-01-01",
                "end_date": "2026-12-31",
            }
        )
        with self.assertRaises(ValidationError):
            self.env["training.report"].create(
                {
                    "report_type": "course",
                    "program_id": unrelated_program.id,
                    "course_id": self.course.id,
                }
            )

    def test_date_range_constraint(self):
        with self.assertRaises(ValidationError):
            self._create_course_report(date_from="2026-06-30", date_to="2026-01-01")

    def test_program_report_does_not_require_course(self):
        report = self.env["training.report"].create(
            {"report_type": "program", "program_id": self.program.id}
        )
        self.assertTrue(report.exists())

    # ---- generation / KPI parity ----

    def test_generate_sets_state_and_pdf(self):
        report = self._create_course_report()
        report.action_generate()
        self.assertEqual(report.state, "generated")
        self.assertTrue(report.generated_date)
        self.assertTrue(report.pdf_attachment_id)
        self.assertEqual(report.pdf_attachment_id.mimetype, "application/pdf")

    def test_generate_kpi_matches_analytics_service(self):
        """DEVELOPMENT_PLAN M8 test: 'KPI/report number parity' -- the
        report's stored snapshot must equal what training.analytics
        itself computes for the identical scope, never a re-derived
        number."""
        report = self._create_course_report()
        report.action_generate()

        expected_kpi = self.analytics.get_kpi(course=self.course)
        expected_attendance = self.analytics.get_attendance_metrics(course=self.course)
        expected_response_rate = self.analytics.get_trainee_response_rate(
            course=self.course
        )

        self.assertTrue(report.kpi_trainer_score_has_data)
        self.assertEqual(report.kpi_trainer_score, expected_kpi["trainer_performance"])
        self.assertFalse(report.kpi_content_score_has_data)

        self.assertEqual(report.present_count, expected_attendance["present_count"])
        self.assertEqual(report.attendance_rate, expected_attendance["attendance_rate"])
        self.assertEqual(
            report.attendance_rate_has_data,
            expected_attendance["attendance_rate"] is not None,
        )
        self.assertEqual(report.response_rate, expected_response_rate)
        self.assertTrue(report.response_rate_has_data)

    def test_generate_program_report_uses_program_scope(self):
        """A program report's snapshot must match training.analytics
        called with the program scope, not the (narrower) course scope
        -- the pooling/equal-weight formula itself is already covered
        by test_training_analytics.py."""
        program_report = self.env["training.report"].create(
            {"report_type": "program", "program_id": self.program.id}
        )
        program_report.action_generate()
        expected = self.analytics.get_kpi(program=self.program)
        self.assertEqual(
            program_report.kpi_trainer_score, expected["trainer_performance"]
        )

    def test_no_valid_data_is_none_not_zero(self):
        """A course with no responses at all must report 'no data', not
        a misleading 0.0 (ADR-004's null-vs-zero rule extended to the
        report snapshot)."""
        empty_report = self.env["training.report"].create(
            {
                "report_type": "course",
                "program_id": self.program.id,
                "course_id": self.other_course.id,
            }
        )
        empty_report.action_generate()
        self.assertFalse(empty_report.kpi_trainer_score_has_data)
        self.assertEqual(empty_report.kpi_trainer_score, 0.0)
        self.assertFalse(empty_report.attendance_rate_has_data)
        self.assertFalse(empty_report.response_rate_has_data)

    # ---- approval ----

    def test_approve_requires_admin_group(self):
        report = self._create_course_report()
        report.action_generate()
        with self.assertRaises(AccessError):
            report.with_user(self.assistant_admin_user).action_approve()

    def test_approve_sets_metadata_and_locks(self):
        report = self._create_course_report()
        report.action_generate()
        report.with_user(self.admin_group_user).action_approve()
        self.assertEqual(report.state, "approved")
        self.assertEqual(report.approved_by, self.admin_group_user)
        self.assertTrue(report.approved_date)
        self.assertTrue(report.pdf_attachment_id)

    def test_approve_requires_generated_state(self):
        report = self._create_course_report()
        with self.assertRaises(UserError):
            report.with_user(self.admin_group_user).action_approve()

    def test_approved_report_is_immutable(self):
        """The lock must hold even for the admin-group user who has
        full ACL write access to training.report -- immutability is a
        model-level business rule, not an ACL restriction."""
        report = self._create_course_report()
        report.action_generate()
        report.with_user(self.admin_group_user).action_approve()
        with self.assertRaises(UserError):
            report.with_user(self.admin_group_user).write(
                {"date_from": "2026-01-01"}
            )

    def test_generated_report_filters_locked_without_new_version(self):
        report = self._create_course_report()
        report.action_generate()
        with self.assertRaises(UserError):
            report.with_user(self.admin_group_user).write(
                {"date_from": "2026-01-01"}
            )

    def test_regenerate_allowed_while_generated_not_approved(self):
        """Refreshing KPI numbers (no filter change) on an already
        -generated-but-not-yet-approved report is allowed -- only
        changing the report's *scope* requires a new version."""
        report = self._create_course_report()
        report.action_generate()
        report.action_generate()
        self.assertEqual(report.state, "generated")

    # ---- versioning ----

    def test_new_version_creates_independent_draft(self):
        report = self._create_course_report()
        report.action_generate()
        report.with_user(self.admin_group_user).action_approve()

        action = report.action_new_version()
        new_report = self.env["training.report"].browse(action["res_id"])

        self.assertEqual(new_report.state, "draft")
        self.assertEqual(new_report.version_no, report.version_no + 1)
        self.assertEqual(new_report.previous_report_id, report)
        self.assertFalse(new_report.kpi_trainer_score_has_data)

        # The original approved version is untouched.
        self.assertEqual(report.state, "approved")
        self.assertEqual(report.version_no, 1)

    def test_unlink_blocked_unless_draft(self):
        report = self._create_course_report()
        report.action_generate()
        with self.assertRaises(UserError):
            report.unlink()
        report.write({"active": False})  # archiving remains available
        self.assertFalse(report.active)

    def test_draft_report_can_be_deleted(self):
        report = self._create_course_report()
        report.unlink()
        self.assertFalse(report.exists())

    # ---- Excel export ----

    def test_export_excel_requires_generated_report(self):
        report = self._create_course_report()
        with self.assertRaises(UserError):
            report.action_export_excel()

    def test_export_excel_creates_attachment(self):
        report = self._create_course_report()
        report.action_generate()
        action = report.action_export_excel()
        self.assertTrue(report.excel_attachment_id)
        self.assertIn("spreadsheetml", report.excel_attachment_id.mimetype)
        self.assertEqual(action["type"], "ir.actions.act_url")

    def test_export_excel_allowed_after_approval(self):
        report = self._create_course_report()
        report.action_generate()
        report.with_user(self.admin_group_user).action_approve()
        report.action_export_excel()
        self.assertTrue(report.excel_attachment_id)

    # ---- Arabic RTL rendering ----

    def test_pdf_renders_rtl_in_arabic(self):
        self.env["res.lang"]._activate_lang("ar_001")
        report = self._create_course_report()
        report.action_generate()

        html, _report_type = self.env["ir.actions.report"].with_context(
            lang="ar_001"
        )._render_qweb_html(
            "training_management.action_report_training_report", report.ids
        )
        if isinstance(html, bytes):
            html = html.decode()
        self.assertIn('dir="rtl"', html)

    def test_pdf_renders_ltr_in_english(self):
        report = self._create_course_report()
        report.action_generate()

        html, _report_type = self.env["ir.actions.report"].with_context(
            lang="en_US"
        )._render_qweb_html(
            "training_management.action_report_training_report", report.ids
        )
        if isinstance(html, bytes):
            html = html.decode()
        self.assertIn('dir="ltr"', html)

    # ---- unauthorized attachment access ----

    def test_trainee_cannot_access_report_model(self):
        report = self._create_course_report()
        report.action_generate()
        with self.assertRaises(AccessError):
            self.env["training.report"].with_user(self.trainee_user).search(
                [("id", "=", report.id)]
            )

    def test_trainee_cannot_access_report_attachment(self):
        report = self._create_course_report()
        report.action_generate()
        with self.assertRaises(AccessError):
            self.env["ir.attachment"].with_user(self.trainee_user).browse(
                report.pdf_attachment_id.id
            ).read(["name"])
