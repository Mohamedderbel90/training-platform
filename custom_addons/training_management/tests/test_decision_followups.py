"""Tests for the implementation follow-ups of docs/DECISIONS.md:
DEC-11 (mandatory correction reason), DEC-13 (per-response scores are
General Supervisor only), DEC-21 (two environment indicators), DEC-22 (not-held
days excluded) and DEC-23 (report narrative sections)."""
import base64
import io
import zipfile

from odoo.exceptions import AccessError, UserError
from odoo.tests.common import tagged

from .test_requirements_alignment import AlignmentCase


@tagged(
    "post_install", "-at_install",
    "training_management_report", "training_management_security",
    "training_management_analytics",
)
class TestDecisionFollowups(AlignmentCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.comment_question = cls.env["survey.question"].create(
            {
                "survey_id": cls.survey.id,
                "title": "Comments",
                "question_type": "text_box",
            }
        )

    def _final_response(self, program_day, comment=None):
        partner = self.env["res.partner"].create({"name": "Commenter"})
        self.env["training.enrollment"].create(
            {"program_id": program_day.course_id.program_id.id, "partner_id": partner.id}
        )
        response = self.env["survey.user_input"].create(
            {
                "survey_id": self.survey.id,
                "training_day_id": program_day.id,
                "respondent_role": "trainee",
                "partner_id": partner.id,
                "state": "in_progress",
            }
        )
        self.env["survey.user_input.line"].create(
            {
                "user_input_id": response.id,
                "question_id": self.question.id,
                "answer_type": "suggestion",
                "suggested_answer_id": self.options[4].id,
            }
        )
        if comment:
            self.env["survey.user_input.line"].create(
                {
                    "user_input_id": response.id,
                    "question_id": self.comment_question.id,
                    "answer_type": "text_box",
                    "value_text_box": comment,
                }
            )
        response.write({"state": "done"})
        return response

    # ---- DEC-11 -------------------------------------------------------

    def test_correction_requires_a_reason(self):
        _program, _course, day = self.build_program("DEC11", 4, ["present"], 1)
        response = self.env["survey.user_input"].search(
            [("training_day_id", "=", day.id)], limit=1
        )
        with self.assertRaises(UserError):
            response.sudo().write({"test_entry": True})
        with self.assertRaises(UserError):
            response.sudo().unlink()
        with self.assertRaises(UserError):
            response.user_input_line_ids.sudo().write({"value_char_box": "x"})
        self.assertTrue(response.exists())

    def test_action_correct_final_response_is_general_supervisor_only(self):
        _program, _course, day = self.build_program("DEC11b", 4, ["present"], 1)
        response = self.env["survey.user_input"].search(
            [("training_day_id", "=", day.id)], limit=1
        )
        for user in (self.supervisor_user, self.trainer_user):
            with self.assertRaises(AccessError):
                response.with_user(user).action_correct_final_response(
                    {"test_entry": True}, "reason"
                )
        with self.assertRaises(UserError):
            response.with_user(self.gs_user).action_correct_final_response(
                {"test_entry": True}, "   "
            )
        response.with_user(self.gs_user).action_correct_final_response(
            {"test_entry": True}, "Wrong test flag"
        )
        entry = self.env["training.audit.log"].search(
            [("event_type", "=", "response_correction"), ("res_id", "=", response.id)],
            limit=1,
            order="id desc",
        )
        self.assertEqual(entry.user_id, self.gs_user)
        self.assertIn("Reason: Wrong test flag", entry.description)
        self.assertIn("test_entry", entry.description)
        self.assertEqual(response.state, "done")

    # ---- DEC-13 ---------------------------------------------------------

    def test_only_general_supervisor_reads_per_response_scores(self):
        self.build_program("DEC13", 4, ["present"], 1)
        Kpi = self.env["training.survey.response.kpi"]
        for user in (self.supervisor_user, self.trainer_user):
            with self.assertRaises(AccessError):
                Kpi.with_user(user).search([])
        self.assertTrue(Kpi.with_user(self.gs_user).search([]))

    # ---- DEC-22 -------------------------------------------------------

    def test_not_held_days_are_excluded_from_kpis(self):
        for state in ("cancelled", "postponed"):
            program, _course, _day = self.build_program(
                "DEC22 %s" % state, 4, ["present"], 1, day_state=state
            )
            self.assertIsNone(self.analytics.get_kpi(program=program)["trainer_performance"])
            self.assertIsNone(
                self.analytics.get_attendance_metrics(program=program)["attendance_rate"]
            )

    # ---- DEC-21 -------------------------------------------------------

    def test_environment_indicators_are_separate_by_role(self):
        program, _course, _day = self.build_program("DEC21", 5, ["present"], 1)
        trainee = self.analytics.get_kpi(
            program=program, categories=("trainer_performance",),
            respondent_role="trainee",
        )
        supervisor = self.analytics.get_kpi(
            program=program, categories=("trainer_performance",),
            respondent_role="supervisor",
        )
        self.assertEqual(trainee["trainer_performance"], 5.0)
        self.assertIsNone(supervisor["trainer_performance"])
        report = self.env["training.report"].create(
            {"report_type": "program", "program_id": program.id}
        )
        report.action_generate()
        self.assertFalse(report.kpi_environment_supervisor_score_has_data)
        labels = [row[0] for row in report._kpi_summary_rows()]
        self.assertIn("Training Environment Score (Supervisor)", labels)

    # ---- DEC-23 -------------------------------------------------------

    def test_course_report_narrative_and_comments(self):
        _program, course, day = self.build_program("DEC23", 4, ["present"], 1)
        self._final_response(day, "Please add more practice")
        self._final_response(day, "please  add more practice")
        report = self.env["training.report"].create(
            {
                "report_type": "course",
                "program_id": course.program_id.id,
                "course_id": course.id,
            }
        )
        report.action_generate()
        nar = report.narrative_json
        self.assertEqual(nar["days_count"], 1)
        self.assertEqual(nar["comparison"]["kind"], "day")
        self.assertEqual(len(nar["comparison"]["rows"]), 1)
        self.assertIsNone(nar["trend"]["trainer_performance"])
        self.assertFalse(nar["comments"]["withheld"])
        answers = [a for g in nar["comments"]["groups"] for a in g["answers"]]
        self.assertEqual(len(answers), 2)
        self.assertEqual(nar["comments"]["repeated"][0]["count"], 2)
        # No respondent identity anywhere in the snapshot.
        self.assertNotIn("Commenter", str(nar))

    def test_supervisor_cannot_generate_reports(self):
        """C3 / DEC-15: reports are produced and exported by the General
        Supervisor only."""
        _program, course, _day = self.build_program("DEC23b", 4, ["present"], 2)
        vals = {
            "report_type": "course",
            "program_id": course.program_id.id,
            "course_id": course.id,
        }
        with self.assertRaises(AccessError):
            self.env["training.report"].with_user(self.supervisor_user).create(vals)
        report = self.env["training.report"].create(vals)
        with self.assertRaises(AccessError):
            report.with_user(self.supervisor_user).action_generate()
        report.with_user(self.gs_user).action_generate()
        with self.assertRaises(AccessError):
            report.with_user(self.supervisor_user).action_export_excel()
        report.with_user(self.gs_user).action_export_excel()

    def test_program_report_compares_courses(self):
        program, _course, _day = self.build_program("DEC23c", 4, ["present"], 1)
        second = self.env["training.course"].create(
            {
                "program_id": program.id,
                "name": "Second course",
                "start_date": "2000-01-01",
                "end_date": "2099-12-31",
                "sequence": 20,
            }
        )
        report = self.env["training.report"].create(
            {"report_type": "program", "program_id": program.id}
        )
        report.action_generate()
        comparison = report.narrative_json["comparison"]
        self.assertEqual(comparison["kind"], "course")
        self.assertEqual(
            [row["label"] for row in comparison["rows"]],
            [program.course_ids.sorted("sequence")[0].name, second.name],
        )
        self.assertIsNone(comparison["rows"][1]["trainer_performance"])

    def test_highlights_use_highest_and_lowest_available_indicator(self):
        _program, course, _day = self.build_program("DEC23d", 4, ["present"], 1)
        report = self.env["training.report"].create(
            {
                "report_type": "course",
                "program_id": course.program_id.id,
                "course_id": course.id,
            }
        )
        nar = report._build_narrative(
            None, None,
            {
                "trainer_performance": 4.0,
                "content": 3.0,
                "environment": None,
                "environment_supervisor": None,
            },
        )
        self.assertEqual(nar["highlights"]["highest"]["key"], "trainer_performance")
        self.assertEqual(nar["highlights"]["lowest"]["key"], "content")

    def test_excel_follows_narrative_toggles(self):
        _program, course, day = self.build_program("DEC23e", 4, ["present"], 1)
        self._final_response(day, "Visible comment")
        report = self.env["training.report"].create(
            {
                "report_type": "course",
                "program_id": course.program_id.id,
                "course_id": course.id,
            }
        )
        report.action_generate()

        def shared_strings():
            report.action_export_excel()
            data = base64.b64decode(report.excel_attachment_id.datas)
            with zipfile.ZipFile(io.BytesIO(data)) as archive:
                return archive.read("xl/sharedStrings.xml").decode()

        text = shared_strings()
        self.assertIn("Visible comment", text)
        self.assertIn("Day Comparison", text)
        self.assertIn("Executive Summary", text)

    def test_narrative_toggles_locked_after_generation(self):
        _program, course, _day = self.build_program("DEC23f", 4, ["present"], 1)
        report = self.env["training.report"].create(
            {
                "report_type": "course",
                "program_id": course.program_id.id,
                "course_id": course.id,
            }
        )
        report.action_generate()
        with self.assertRaises(UserError):
            report.with_user(self.gs_user).write({"show_comments": False})
        version = self.env["training.report"].browse(report.action_new_version()["res_id"])
        self.assertFalse(version.narrative_json)
        version.write({"show_comments": False})
        self.assertFalse(version.show_comments)


@tagged("post_install", "-at_install", "training_management_security")
class TestAnonymiseTrainee(AlignmentCase):
    """DEC-44: deletion requests are met by anonymisation, not deletion."""

    def _trainee(self):
        program, _course, day = self.build_program("DEC44", 4, ["present"], 1)
        enrollment = self.env["training.enrollment"].search(
            [("program_id", "=", program.id)], limit=1
        )
        partner = enrollment.partner_id
        user = self.make_user("dec44_trainee", "training_management.group_training_trainee")
        user.partner_id.write({"name": "Real Name", "email": "real@example.com"})
        enrollment.write({"partner_id": user.partner_id.id})
        return user, enrollment, day, partner

    def test_anonymise_keeps_history_and_removes_identity(self):
        user, enrollment, day, _old = self._trainee()
        partner = user.partner_id
        attendance_count = self.env["training.attendance"].search_count(
            [("enrollment_id", "=", enrollment.id)]
        )
        partner.with_user(self.gs_user).action_anonymise_trainee("Deletion request")
        partner.invalidate_recordset()
        self.assertNotIn("Real Name", partner.name)
        self.assertFalse(partner.email)
        self.assertFalse(user.active)
        self.assertEqual(enrollment.state, "inactive")
        self.assertEqual(
            self.env["training.attendance"].search_count(
                [("enrollment_id", "=", enrollment.id)]
            ),
            attendance_count,
        )
        entry = self.env["training.audit.log"].search(
            [("event_type", "=", "personal_data_anonymised"), ("res_id", "=", partner.id)]
        )
        self.assertEqual(len(entry), 1)
        self.assertIn("Deletion request", entry.description)
        self.assertNotIn("Real Name", entry.description)

    def test_anonymise_is_general_supervisor_only_and_needs_reason(self):
        user, _enrollment, _day, _old = self._trainee()
        partner = user.partner_id
        for other in (self.supervisor_user, self.trainer_user):
            with self.assertRaises(AccessError):
                partner.with_user(other).action_anonymise_trainee("x")
        with self.assertRaises(UserError):
            partner.with_user(self.gs_user).action_anonymise_trainee(" ")

    def test_non_trainee_and_admin_cannot_be_anonymised(self):
        with self.assertRaises(UserError):
            self.gs_user.partner_id.with_user(self.gs_user).action_anonymise_trainee("x")
