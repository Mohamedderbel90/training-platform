"""Backend requirement-alignment tests (docs/REQUIREMENTS_ALIGNMENT.md
AC-ALN rows that had no automated evidence): multi-program isolation,
KPI formula edge cases, Assistant Admin boundaries, report/Excel parity,
approval and audit enforcement, and server-side respondent hardening."""
import base64
import io
import zipfile
from datetime import timedelta

from odoo import fields
from odoo.exceptions import AccessError, UserError, ValidationError
from odoo.tests.common import TransactionCase, tagged

RATING_LABELS = [(1, "Poor"), (2, "Acceptable"), (3, "Good"), (4, "Very Good"), (5, "Excellent")]


class AlignmentCase(TransactionCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.analytics = cls.env["training.analytics"]

        def make_user(login, *group_xmlids):
            return (
                cls.env["res.users"]
                .with_context(no_reset_password=True)
                .create(
                    {
                        "name": login,
                        "login": login,
                        "email": "%s@example.com" % login,
                        "group_ids": [(4, cls.env.ref("base.group_user").id)]
                        + [(4, cls.env.ref(x).id) for x in group_xmlids],
                    }
                )
            )

        cls.make_user = staticmethod(make_user)
        cls.gs_user = make_user("aln_gs", "training_management.group_training_admin")
        cls.assistant_user = make_user(
            "aln_assistant", "training_management.group_training_assistant_admin"
        )
        cls.supervisor_user = make_user(
            "aln_supervisor", "training_management.group_training_supervisor"
        )
        cls.trainer_user = make_user(
            "aln_trainer", "training_management.group_training_trainer"
        )

        cls.survey = cls.env["survey.survey"].create(
            {"title": "ALN Trainee Survey", "survey_role": "trainee"}
        )
        cls.question = cls.env["survey.question"].create(
            {
                "survey_id": cls.survey.id,
                "title": "Trainer rating",
                "question_type": "simple_choice",
                "kpi_category": "trainer_performance",
            }
        )
        cls.options = {
            value: cls.env["survey.question.answer"].create(
                {"question_id": cls.question.id, "value": label, "rating_value": value}
            )
            for value, label in RATING_LABELS
        }

    @classmethod
    def build_program(cls, name, rating, statuses, submit_count, day_state="open"):
        """A program with one course/day, one enrollment per attendance
        status, and ``submit_count`` final trainee responses all rating
        ``rating``. Returns (program, course, day)."""
        program = cls.env["training.program"].create(
            {"name": name, "start_date": "2000-01-01", "end_date": "2099-12-31"}
        )
        course = cls.env["training.course"].create(
            {
                "program_id": program.id,
                "name": "%s Course" % name,
                "start_date": "2000-01-01",
                "end_date": "2099-12-31",
            }
        )
        now = fields.Datetime.now()
        day = cls.env["training.day"].create(
            {
                "course_id": course.id,
                "date": fields.Date.today(),
                "start_datetime": now - timedelta(hours=2),
                "end_datetime": now + timedelta(hours=2),
                "state": day_state,
                "supervisor_id": cls.supervisor_user.id,
                "survey_open_at": now - timedelta(hours=1),
                "survey_close_at": now + timedelta(hours=1),
                "trainee_survey_id": cls.survey.id,
            }
        )
        partners = []
        for index, status in enumerate(statuses):
            partner = cls.env["res.partner"].create(
                {"name": "%s trainee %s" % (name, index)}
            )
            partners.append(partner)
            enrollment = cls.env["training.enrollment"].create(
                {"program_id": program.id, "partner_id": partner.id}
            )
            cls.env["training.attendance"].create(
                {
                    "training_day_id": day.id,
                    "enrollment_id": enrollment.id,
                    "status": status,
                    "late_minutes": 5 if status == "late" else 0,
                }
            )
        for partner in partners[:submit_count]:
            response = cls.env["survey.user_input"].create(
                {
                    "survey_id": cls.survey.id,
                    "training_day_id": day.id,
                    "respondent_role": "trainee",
                    "partner_id": partner.id,
                    "state": "in_progress",
                }
            )
            cls.env["survey.user_input.line"].create(
                {
                    "user_input_id": response.id,
                    "question_id": cls.question.id,
                    "answer_type": "suggestion",
                    "suggested_answer_id": cls.options[rating].id,
                }
            )
            response.write({"state": "done"})
        return program, course, day


@tagged(
    "post_install", "-at_install",
    "training_management_report", "training_management_analytics",
)
class TestMultiProgramIsolation(AlignmentCase):
    """AC-ALN-20 / BR-012 / FR-016: two programs never mix."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.prog_a, cls.course_a, cls.day_a = cls.build_program(
            "ALN Program A", 5, ["present", "late", "absent", "present"], 3
        )
        cls.prog_b, cls.course_b, cls.day_b = cls.build_program(
            "ALN Program B", 1, ["absent", "absent"], 1
        )

    def test_kpi_and_attendance_do_not_mix(self):
        kpi_a = self.analytics.get_kpi(program=self.prog_a)
        kpi_b = self.analytics.get_kpi(program=self.prog_b)
        self.assertEqual(kpi_a["trainer_performance"], 5.0)
        self.assertEqual(kpi_b["trainer_performance"], 1.0)
        att_a = self.analytics.get_attendance_metrics(program=self.prog_a)
        att_b = self.analytics.get_attendance_metrics(program=self.prog_b)
        self.assertEqual(att_a["total_count"], 4)
        self.assertEqual(att_b["total_count"], 2)
        self.assertEqual(att_b["attendance_rate"], 0.0)
        # late counts as present; late rate = late / (present + late)
        self.assertEqual(att_a["attendance_rate"], 75.0)
        self.assertAlmostEqual(att_a["late_rate"], 100.0 / 3)
        self.assertEqual(att_a["absence_rate"], 25.0)

    def test_response_rate_does_not_mix(self):
        self.assertEqual(self.analytics.get_trainee_response_rate(program=self.prog_a), 100.0)
        # Program B: nobody present/late -> denominator 0 -> None, not 0.
        self.assertIsNone(self.analytics.get_trainee_response_rate(program=self.prog_b))

    def test_reports_do_not_mix(self):
        Report = self.env["training.report"]
        report_a = Report.create({"report_type": "program", "program_id": self.prog_a.id})
        report_b = Report.create({"report_type": "program", "program_id": self.prog_b.id})
        course_b = Report.create(
            {
                "report_type": "course",
                "program_id": self.prog_b.id,
                "course_id": self.course_b.id,
            }
        )
        (report_a | report_b | course_b).action_generate()
        self.assertEqual(report_a.kpi_trainer_score, 5.0)
        self.assertEqual(report_a.total_attendance_count, 4)
        self.assertEqual(report_b.kpi_trainer_score, 1.0)
        self.assertEqual(report_b.total_attendance_count, 2)
        self.assertEqual(course_b.kpi_trainer_score, report_b.kpi_trainer_score)

    def test_backoffice_kpi_view_rows_carry_program(self):
        rows = self.env["training.survey.response.kpi"].search(
            [("program_id", "in", (self.prog_a | self.prog_b).ids)]
        )
        self.assertEqual(rows.mapped("program_id"), self.prog_a | self.prog_b)
        by_program = {
            program: rows.filtered(lambda r, p=program: r.program_id == p)
            for program in (self.prog_a, self.prog_b)
        }
        self.assertEqual(set(by_program[self.prog_a].mapped("score")), {5.0})
        self.assertEqual(set(by_program[self.prog_b].mapped("score")), {1.0})


@tagged("post_install", "-at_install", "training_management_report", "training_management_security")
class TestAssistantAdminBoundaries(AlignmentCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.program, cls.course, cls.day = cls.build_program(
            "ALN Assistant Program", 4, ["present", "late"], 2
        )

    def test_assistant_admin_can_generate_report_with_real_numbers(self):
        report = self.env["training.report"].create(
            {"report_type": "program", "program_id": self.program.id}
        )
        report.with_user(self.assistant_user).action_generate()
        self.assertEqual(report.state, "generated")
        self.assertTrue(report.kpi_trainer_score_has_data)
        self.assertEqual(report.kpi_trainer_score, 4.0)

    def test_assistant_admin_cannot_read_individual_responses(self):
        for model in ("survey.user_input", "survey.user_input.line"):
            with self.assertRaises(AccessError):
                self.env[model].with_user(self.assistant_user).search([])

    def test_analytics_service_never_widens_access_for_other_roles(self):
        """training.analytics is callable by any user; only the two
        back-office admin roles aggregate through sudo. A supervisor
        gets numbers scoped by their own record rules (no responses)."""
        kpi = self.analytics.with_user(self.supervisor_user).get_kpi(program=self.program)
        self.assertIsNone(kpi["trainer_performance"])

    def test_assistant_admin_cannot_approve_directly(self):
        report = self.env["training.report"].create(
            {"report_type": "program", "program_id": self.program.id}
        )
        report.action_generate()
        with self.assertRaises(AccessError):
            report.with_user(self.assistant_user).action_approve()
        with self.assertRaises(AccessError):
            report.with_user(self.assistant_user).write({"state": "approved"})
        self.assertEqual(report.state, "generated")

    def test_direct_state_write_by_gs_is_stamped_and_audited(self):
        report = self.env["training.report"].create(
            {"report_type": "program", "program_id": self.program.id}
        )
        report.action_generate()
        report.with_user(self.gs_user).write({"state": "approved"})
        self.assertEqual(report.approved_by, self.gs_user)
        self.assertTrue(report.approved_date)
        self.assertEqual(
            self.env["training.audit.log"].search_count(
                [("event_type", "=", "report_approval"), ("res_id", "=", report.id)]
            ),
            1,
        )

    def test_draft_report_cannot_be_approved_by_direct_write(self):
        report = self.env["training.report"].create(
            {"report_type": "program", "program_id": self.program.id}
        )
        with self.assertRaises(UserError):
            report.with_user(self.gs_user).write({"state": "approved"})


@tagged("post_install", "-at_install", "training_management_report")
class TestReportOutputParity(AlignmentCase):
    """BRD FR-061: course-end report has trainer/content/environment
    averages plus attendance, absence and lateness; PDF and Excel expose
    the same figures and honour the same show/hide toggles."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.program, cls.course, cls.day = cls.build_program(
            "ALN Parity Program", 4, ["present", "late", "absent"], 2
        )

    def _excel_strings(self, report):
        report.action_export_excel()
        content = base64.b64decode(report.excel_attachment_id.datas)
        with zipfile.ZipFile(io.BytesIO(content)) as archive:
            return archive.read("xl/sharedStrings.xml").decode()

    def test_summary_rows_include_attendance_absence_and_lateness(self):
        report = self.env["training.report"].create(
            {
                "report_type": "course",
                "program_id": self.program.id,
                "course_id": self.course.id,
            }
        )
        report.action_generate()
        labels = [row[0] for row in report._kpi_summary_rows()]
        for expected in (
            "Trainer Score",
            "Content Score",
            "Training Environment Score",
            "Attendance Rate (%)",
            "Absence Rate (%)",
            "Late Rate (%)",
        ):
            self.assertIn(expected, labels)
        values = {row[0]: row[1] for row in report._kpi_summary_rows()}
        self.assertAlmostEqual(values["Attendance Rate (%)"], 200.0 / 3)
        self.assertAlmostEqual(values["Absence Rate (%)"], 100.0 / 3)
        self.assertEqual(values["Late Rate (%)"], 50.0)
        self.assertIsNone(values["Content Score"])

    def test_excel_hides_attendance_when_toggle_off(self):
        report = self.env["training.report"].create(
            {
                "report_type": "course",
                "program_id": self.program.id,
                "course_id": self.course.id,
                "show_attendance": False,
            }
        )
        report.action_generate()
        strings = self._excel_strings(report)
        self.assertNotIn("Present", strings)
        self.assertNotIn("Late Rate", strings)
        self.assertIn("Trainer Score", strings)

    def test_excel_includes_attendance_counts_and_version_when_shown(self):
        report = self.env["training.report"].create(
            {
                "report_type": "course",
                "program_id": self.program.id,
                "course_id": self.course.id,
            }
        )
        report.action_generate()
        strings = self._excel_strings(report)
        for expected in ("Present", "Late", "Absent", "Late Rate", "Version"):
            self.assertIn(expected, strings)

    def test_pdf_lists_every_shown_kpi_row(self):
        report = self.env["training.report"].create(
            {
                "report_type": "course",
                "program_id": self.program.id,
                "course_id": self.course.id,
            }
        )
        report.action_generate()
        html, _kind = self.env["ir.actions.report"]._render_qweb_html(
            "training_management.action_report_training_report", report.ids
        )
        if isinstance(html, bytes):
            html = html.decode()
        for expected in ("Late Rate", "Absence Rate", "Attendance Rate", "Trainer Score"):
            self.assertIn(expected, html)


@tagged("post_install", "-at_install", "training_management_audit")
class TestAuditCoverage(AlignmentCase):
    """PROJECT_SPEC section 17 events."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.program, cls.course, cls.day = cls.build_program(
            "ALN Audit Program", 3, ["present"], 0, day_state="planned"
        )
        cls.Log = cls.env["training.audit.log"]

    def _count(self, event, res_id):
        return self.Log.search_count([("event_type", "=", event), ("res_id", "=", res_id)])

    def test_reopen_via_direct_write_is_logged_once(self):
        self.day.write({"state": "open"})
        self.day.write({"state": "closed"})
        before = self._count("day_reopen", self.day.id)
        self.day.write({"state": "open"})
        self.assertEqual(self._count("day_reopen", self.day.id), before + 1)

    def test_reopen_action_logs_exactly_once(self):
        self.day.write({"state": "open"})
        self.day.action_close()
        before = self._count("day_reopen", self.day.id)
        self.day.action_reopen()
        self.assertEqual(self._count("day_reopen", self.day.id), before + 1)

    def test_close_is_logged_once(self):
        self.day.write({"state": "open"})
        before = self._count("day_close", self.day.id)
        self.day.action_close()
        self.assertEqual(self._count("day_close", self.day.id), before + 1)

    def test_normal_open_is_not_logged_as_reopen(self):
        before = self._count("day_reopen", self.day.id)
        self.day.action_open()
        self.assertEqual(self._count("day_reopen", self.day.id), before)

    def test_role_granted_on_user_creation_is_logged(self):
        user = self.make_user("aln_new_trainer", "training_management.group_training_trainer")
        self.assertEqual(self._count("permission_change", user.id), 1)

    def test_user_created_without_project_role_is_not_logged(self):
        user = (
            self.env["res.users"]
            .with_context(no_reset_password=True)
            .create({"name": "plain", "login": "aln_plain", "email": "plain@example.com"})
        )
        self.assertEqual(self._count("permission_change", user.id), 0)

    def test_role_granted_from_group_form_is_logged(self):
        user = self.make_user("aln_group_form")
        group = self.env.ref("training_management.group_training_supervisor")
        group.write({"user_ids": [(4, user.id)]})
        self.assertEqual(self._count("permission_change", user.id), 1)
        group.write({"user_ids": [(3, user.id)]})
        self.assertEqual(self._count("permission_change", user.id), 2)

    def test_unrelated_group_form_change_is_not_logged(self):
        user = self.make_user("aln_group_form_other")
        self.env.ref("base.group_no_one").write({"user_ids": [(4, user.id)]})
        self.assertEqual(self._count("permission_change", user.id), 0)


@tagged("post_install", "-at_install", "training_management_survey", "training_management_security")
class TestRespondentServerSideEnforcement(AlignmentCase):
    """A respondent must not bypass the survey window / identity rules
    by using the ORM directly instead of the Operational API."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.trainee = cls.make_user("aln_trainee", "training_management.group_training_trainee")
        cls.program, cls.course, cls.day = cls.build_program("ALN Resp Program", 3, [], 0)
        cls.env["training.enrollment"].create(
            {"program_id": cls.program.id, "partner_id": cls.trainee.partner_id.id}
        )
        cls.other_program, cls.other_course, cls.other_day = cls.build_program(
            "ALN Resp Other", 3, [], 0
        )
        now = fields.Datetime.now()
        cls.closed_window_day = cls.env["training.day"].create(
            {
                "course_id": cls.course.id,
                "date": fields.Date.today(),
                "start_datetime": now - timedelta(hours=8),
                "end_datetime": now - timedelta(hours=4),
                "state": "open",
                "supervisor_id": cls.supervisor_user.id,
                "survey_open_at": now - timedelta(hours=6),
                "survey_close_at": now - timedelta(hours=1),
                "trainee_survey_id": cls.survey.id,
            }
        )

    def _vals(self, day):
        return {
            "survey_id": self.survey.id,
            "training_day_id": day.id,
            "respondent_role": "trainee",
            "partner_id": self.trainee.partner_id.id,
        }

    def test_cannot_create_response_after_window_closed(self):
        with self.assertRaises(UserError):
            self.env["survey.user_input"].with_user(self.trainee).create(
                self._vals(self.closed_window_day)
            )

    def test_cannot_create_response_for_other_program_day(self):
        with self.assertRaises(UserError):  # AccessError is a UserError
            self.env["survey.user_input"].with_user(self.trainee).create(
                self._vals(self.other_day)
            )

    def test_cannot_create_response_already_final(self):
        with self.assertRaises(UserError):
            self.env["survey.user_input"].with_user(self.trainee).create(
                dict(self._vals(self.day), state="done")
            )

    def test_cannot_create_response_for_someone_else(self):
        vals = self._vals(self.day)
        vals["partner_id"] = self.supervisor_user.partner_id.id
        with self.assertRaises(AccessError):
            self.env["survey.user_input"].with_user(self.trainee).create(vals)

    def test_cannot_retarget_own_draft_to_another_day(self):
        response = self.day.get_or_create_survey_response("trainee", user=self.trainee)
        with self.assertRaises(AccessError):
            response.with_user(self.trainee).write({"training_day_id": self.other_day.id})

    def test_cannot_finalize_after_window_closed(self):
        response = self.day.get_or_create_survey_response("trainee", user=self.trainee)
        self.day.write({"survey_close_at": fields.Datetime.now() - timedelta(minutes=1)})
        with self.assertRaises(UserError):
            response.with_user(self.trainee).write({"state": "done"})
        self.assertNotEqual(response.state, "done")

    def test_general_supervisor_may_still_manage_responses(self):
        response = self.env["survey.user_input"].with_user(self.gs_user).create(
            self._vals(self.closed_window_day)
        )
        self.assertTrue(response)

    def test_foreign_answer_option_rejected(self):
        other_question = self.env["survey.question"].create(
            {
                "survey_id": self.survey.id,
                "title": "Another rating",
                "question_type": "simple_choice",
                "kpi_category": "content",
            }
        )
        foreign = self.env["survey.question.answer"].create(
            {"question_id": other_question.id, "value": "Excellent", "rating_value": 5}
        )
        with self.assertRaises(ValidationError):
            self.day.submit_survey_response(
                "trainee",
                [{"question_id": self.question.id, "answer_option_id": foreign.id}],
                user=self.trainee,
            )

    def test_scale_value_out_of_range_rejected(self):
        scale_survey = self.env["survey.survey"].create(
            {"title": "ALN Scale", "survey_role": "trainee"}
        )
        scale_q = self.env["survey.question"].create(
            {
                "survey_id": scale_survey.id,
                "title": "Scale",
                "question_type": "scale",
                "scale_min": 1,
                "scale_max": 5,
                "kpi_category": "content",
            }
        )
        self.day.trainee_survey_id = scale_survey
        for bad in (0, 6, 500, -1, 2.5, "3", True):
            with self.assertRaises(ValidationError, msg=repr(bad)):
                self.day.submit_survey_response(
                    "trainee", [{"question_id": scale_q.id, "value": bad}], user=self.trainee
                )
        response = self.day.submit_survey_response(
            "trainee", [{"question_id": scale_q.id, "value": 4}], user=self.trainee
        )
        self.assertEqual(response.state, "done")
        self.assertEqual(self.analytics.get_response_scores(response)["content"], 4)


@tagged("post_install", "-at_install", "training_management_survey", "training_management_security")
class TestSecurityReviewRegressions(AlignmentCase):
    """Security review: direct-ORM bypasses of respondent/approval rules."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.trainee = cls.make_user("sr_trainee", "training_management.group_training_trainee")
        cls.program, cls.course, cls.day = cls.build_program("SR Prog", 3, [], 0)
        cls.env["training.enrollment"].create(
            {"program_id": cls.program.id, "partner_id": cls.trainee.partner_id.id}
        )
        cls.other_program, cls.other_course, cls.other_day = cls.build_program("SR Other", 3, [], 0)
        cls.scale_q = cls.env["survey.question"].create(
            {
                "survey_id": cls.survey.id,
                "title": "Scale",
                "question_type": "scale",
                "kpi_category": "content",
                "scale_min": 1,
                "scale_max": 5,
            }
        )

    def _own(self, **extra):
        vals = {
            "survey_id": self.survey.id,
            "respondent_role": "trainee",
            "partner_id": self.trainee.partner_id.id,
        }
        vals.update(extra)
        return self.env["survey.user_input"].with_user(self.trainee).create(vals)

    def test_dayless_response_cannot_be_attached_to_a_day(self):
        response = self._own()
        with self.assertRaises(AccessError):
            response.write({"training_day_id": self.other_day.id, "state": "done"})

    def test_create_with_foreign_survey_rejected(self):
        other = self.env["survey.survey"].create({"title": "X", "survey_role": "trainee"})
        with self.assertRaises(AccessError):
            self._own(survey_id=other.id, training_day_id=self.day.id)

    def test_direct_line_with_out_of_range_scale_rejected(self):
        response = self._own(training_day_id=self.day.id)
        with self.assertRaises(ValidationError):
            self.env["survey.user_input.line"].with_user(self.trainee).create(
                {
                    "user_input_id": response.id,
                    "question_id": self.scale_q.id,
                    "answer_type": "scale",
                    "value_scale": 999,
                }
            )

    def test_direct_duplicate_single_choice_line_rejected(self):
        response = self._own(training_day_id=self.day.id)
        Line = self.env["survey.user_input.line"].with_user(self.trainee)
        vals = {
            "user_input_id": response.id,
            "question_id": self.question.id,
            "answer_type": "suggestion",
            "suggested_answer_id": self.options[5].id,
        }
        Line.create(vals)
        with self.assertRaises(ValidationError):
            Line.create(vals)

    def test_assistant_admin_cannot_forge_approved_report(self):
        Report = self.env["training.report"].with_user(self.assistant_user)
        with self.assertRaises(AccessError):
            Report.create(
                {
                    "report_type": "program",
                    "program_id": self.program.id,
                    "state": "approved",
                    "approved_by": self.gs_user.id,
                }
            )

    def test_approver_is_always_the_effective_user(self):
        report = self.env["training.report"].create(
            {"report_type": "program", "program_id": self.program.id, "state": "generated"}
        )
        report.with_user(self.gs_user).write(
            {"state": "approved", "approved_by": self.assistant_user.id}
        )
        self.assertEqual(report.approved_by, self.gs_user)
