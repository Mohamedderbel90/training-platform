"""Tests for the Critical/High fixes of the Business-vs-Odoo audit:
C1 audit log GS only, C2 answer-option lock, C4 public survey routes,
D2 inactive enrollees, P1 General Supervisor dashboard, P2 correction
before/after + wizard, P3 complete anonymisation, D5 KPI view exclusions."""
from datetime import timedelta

from odoo import fields
from odoo.exceptions import AccessError, UserError
from odoo.tests.common import HttpCase, tagged

from .test_requirements_alignment import AlignmentCase


@tagged(
    "post_install", "-at_install",
    "training_management_security", "training_management_audit",
    "training_management_analytics",
)
class TestCriticalHighFixes(AlignmentCase):
    # ---- C1 -------------------------------------------------------------

    def test_audit_log_is_general_supervisor_only(self):
        Log = self.env["training.audit.log"]
        Log._log("day_close", "x")
        with self.assertRaises(AccessError):
            Log.with_user(self.supervisor_user).search([])
        self.assertTrue(Log.with_user(self.gs_user).search([]))

    # ---- C2 -------------------------------------------------------------

    def test_answer_options_are_locked_once_survey_has_responses(self):
        _p, _c, _d = self.build_program("C2", 4, ["present"], 1)
        option = self.options[4]
        self.assertTrue(self.survey.has_submitted_responses)
        with self.assertRaises(UserError):
            option.write({"rating_value": 1})
        with self.assertRaises(UserError):
            option.unlink()
        with self.assertRaises(UserError):
            self.env["survey.question.answer"].create(
                {"question_id": self.question.id, "value": "Extra", "rating_value": 5}
            )
        option.write({"value": "Very good (reworded)"})  # cosmetic stays allowed

    def test_unused_survey_options_stay_editable_and_clone_works(self):
        survey = self.env["survey.survey"].create(
            {"title": "C2 unused", "survey_role": "trainee"}
        )
        question = self.env["survey.question"].create(
            {"survey_id": survey.id, "title": "Q", "question_type": "simple_choice",
             "kpi_category": "content"}
        )
        option = self.env["survey.question.answer"].create(
            {"question_id": question.id, "value": "A", "rating_value": 3}
        )
        option.write({"rating_value": 4})
        self.assertEqual(option.rating_value, 4)
        self.assertTrue(self.survey.action_clone_as_new_version())

    # ---- D2 -------------------------------------------------------------

    def test_inactive_enrollee_cannot_access_a_days_survey(self):
        program, _course, day = self.build_program("D2", 4, ["present"], 1)
        user = self.make_user("d2_trainee", "training_management.group_training_trainee")
        enrollment = self.env["training.enrollment"].create(
            {"program_id": program.id, "partner_id": user.partner_id.id}
        )
        day.check_survey_access("trainee", user=user)  # active: allowed
        enrollment.state = "inactive"
        with self.assertRaises(AccessError):
            day.check_survey_access("trainee", user=user)
        with self.assertRaises(AccessError):
            day.get_survey_definition_dto("trainee", user=user)
        enrollment.state = "completed"
        with self.assertRaises(AccessError):
            day.check_survey_access("trainee", user=user)

    # ---- P3 -------------------------------------------------------------

    def test_anonymisation_erases_mail_followers_and_audit_names(self):
        program, _course, day = self.build_program("P3", 4, ["present"], 1)
        user = self.make_user("p3_trainee", "training_management.group_training_trainee")
        partner = user.partner_id
        partner.write(
            {"name": "Zainab Example", "email": "zainab@example.com",
             "street": "1 Example Street", "city": "Riyadh"}
        )
        self.env["training.enrollment"].create(
            {"program_id": program.id, "partner_id": partner.id}
        )
        mail = self.env["mail.mail"].create(
            {"subject": "Reminder", "body_html": "<p>Dear Zainab Example</p>",
             "email_to": "zainab@example.com", "recipient_ids": [(4, partner.id)]}
        )
        message = mail.mail_message_id
        self.env["mail.followers"].create(
            {"res_model": "training.day", "res_id": day.id, "partner_id": partner.id}
        )
        response = self.env["survey.user_input"].search(
            [("training_day_id", "=", day.id)], limit=1
        )
        self.env.cr.execute(
            "UPDATE survey_user_input SET email = %s, partner_id = %s WHERE id = %s",
            ("zainab@example.com", partner.id, response.id),
        )
        self.env["training.audit.log"]._log(
            "permission_change", "Zainab Example's roles were changed."
        )
        partner.with_user(self.gs_user).action_anonymise_trainee("PDPL request")
        self.assertFalse(mail.exists())
        self.assertFalse(message.exists())
        self.assertFalse(
            self.env["mail.followers"].search_count([("partner_id", "=", partner.id)])
        )
        self.env.cr.execute(
            "SELECT email FROM survey_user_input WHERE id = %s", (response.id,)
        )
        self.assertIsNone(self.env.cr.fetchone()[0])
        partner.invalidate_recordset()
        self.assertFalse(partner.street)
        self.assertFalse(partner.city)
        descriptions = self.env["training.audit.log"].search([]).mapped("description")
        self.assertFalse([d for d in descriptions if "Zainab Example" in d])

    # ---- P2 -------------------------------------------------------------

    def _final_response(self, name="P2"):
        _p, _c, day = self.build_program(name, 4, ["present"], 1)
        return self.env["survey.user_input"].search(
            [("training_day_id", "=", day.id)], limit=1
        )

    def test_line_correction_logs_before_and_after_values(self):
        response = self._final_response()
        line = response.user_input_line_ids[:1]
        line.sudo().with_context(correction_reason="Wrong click").write(
            {"suggested_answer_id": self.options[2].id}
        )
        entry = self.env["training.audit.log"].search(
            [("event_type", "=", "response_correction"), ("res_id", "=", response.id)],
            limit=1, order="id desc",
        )
        self.assertIn("Reason: Wrong click", entry.description)
        self.assertIn("Trainer rating: Very Good -> Trainer rating: Acceptable", entry.description)

    def test_correction_wizard_applies_changes_with_reason(self):
        response = self._final_response("P2w")
        wizard = self.env["training.response.correction"].with_user(
            self.gs_user
        ).with_context(default_response_id=response.id).create({"reason": "Typo"})
        self.assertEqual(len(wizard.line_ids), 1)
        wizard.line_ids.option_id = self.options[5]
        wizard.action_apply()
        self.assertEqual(response.user_input_line_ids.suggested_answer_id, self.options[5])
        self.assertEqual(response.state, "done")
        entry = self.env["training.audit.log"].search(
            [("event_type", "=", "response_correction"), ("res_id", "=", response.id)],
            limit=1, order="id desc",
        )
        self.assertIn("Typo", entry.description)
        self.assertIn("Trainer rating: Very Good -> Trainer rating: Excellent", entry.description)

    def test_correction_wizard_needs_reason_change_and_gs(self):
        response = self._final_response("P2x")
        Wizard = self.env["training.response.correction"].with_context(
            default_response_id=response.id
        )
        with self.assertRaises(AccessError):
            Wizard.with_user(self.supervisor_user).create({"reason": "x"})
        wizard = Wizard.with_user(self.gs_user).create({"reason": "x"})
        with self.assertRaises(UserError):
            wizard.action_apply()  # nothing changed
        wizard.reason = "  "
        wizard.line_ids.option_id = self.options[1]
        with self.assertRaises(UserError):
            wizard.action_apply()
        action = response.with_user(self.gs_user).action_open_correction_wizard()
        self.assertEqual(action["res_model"], "training.response.correction")
        with self.assertRaises(AccessError):
            response.with_user(self.supervisor_user).action_open_correction_wizard()

    # ---- P1 / D5 ----------------------------------------------------------

    def test_dashboard_shows_indicators_filters_and_drill_down(self):
        program, course, day = self.build_program(
            "P1", 4, ["present", "late", "absent"], 2
        )
        Dash = self.env["training.dashboard"].with_user(self.gs_user)
        dash = Dash.create({"program_id": program.id})
        self.assertEqual(dash.days_count, 1)
        self.assertTrue(dash.trainer_score_has_data)
        self.assertEqual(dash.trainer_score, 4.0)
        self.assertAlmostEqual(dash.attendance_rate, 200.0 / 3, places=1)
        self.assertAlmostEqual(dash.absence_rate, 100.0 / 3, places=1)
        self.assertEqual(dash.response_rate, 100.0)
        self.assertFalse(dash.content_score_has_data)  # no data, never 0
        self.assertIn(course.name, dash.comparison_html)
        # filters
        self.assertEqual(dash.with_context().day_state, False)
        dash.day_state = "closed"
        self.assertEqual(dash.days_count, 0)
        dash.day_state = "open"
        self.assertEqual(dash.days_count, 1)
        dash.date_from = fields.Date.today() + timedelta(days=1)
        self.assertEqual(dash.days_count, 0)
        dash.date_from = False
        dash.trainer_id = self.trainer_user
        self.assertEqual(dash.days_count, 0)  # trainer not assigned to the day
        action = dash.action_view_days()
        self.assertEqual(action["res_model"], "training.day")
        self.assertEqual(action["domain"], [("id", "in", [])])

    def test_dashboard_drill_down_and_course_days_comparison(self):
        program, course, day = self.build_program("P1b", 4, ["present"], 1)
        dash = self.env["training.dashboard"].with_user(self.gs_user).create(
            {"program_id": program.id, "course_id": course.id}
        )
        self.assertIn(fields.Date.to_string(day.date), dash.comparison_html)
        self.assertEqual(dash.action_view_days()["domain"], [("id", "in", [day.id])])

    def test_dashboard_is_general_supervisor_only(self):
        for user in (self.supervisor_user, self.trainer_user):
            with self.assertRaises(AccessError):
                self.env["training.dashboard"].with_user(user).create({})

    def test_dashboard_excludes_not_held_days_like_the_report(self):
        program, _c, _d = self.build_program("P1c", 4, ["present"], 1, day_state="cancelled")
        dash = self.env["training.dashboard"].with_user(self.gs_user).create(
            {"program_id": program.id}
        )
        self.assertEqual(dash.days_count, 0)
        self.assertFalse(dash.trainer_score_has_data)

    def test_back_office_kpi_view_excludes_not_held_days(self):
        program, _c, _d = self.build_program("D5", 4, ["present"], 1, day_state="cancelled")
        self.assertFalse(
            self.env["training.survey.response.kpi"].search(
                [("program_id", "=", program.id)]
            )
        )
        kept, _c2, _d2 = self.build_program("D5b", 4, ["present"], 1)
        rows = self.env["training.survey.response.kpi"].search(
            [("program_id", "=", kept.id)]
        )
        self.assertTrue(rows)
        self.assertEqual(rows[:1].day_state, "open")


@tagged("post_install", "-at_install", "training_management_security")
class TestPublicSurveyRoutes(HttpCase):
    """C4 / BR-001, BR-011: the project surveys cannot be answered through
    Odoo's public survey routes."""

    def test_project_survey_public_start_is_refused(self):
        survey = self.env["survey.survey"].create(
            {"title": "C4 trainee", "survey_role": "trainee", "access_mode": "public"}
        )
        self.env["survey.question"].create(
            {"survey_id": survey.id, "title": "Comment", "question_type": "char_box"}
        )
        before = self.env["survey.user_input"].search_count([("survey_id", "=", survey.id)])
        self.url_open("/survey/start/%s" % survey.access_token)
        after = self.env["survey.user_input"].search_count([("survey_id", "=", survey.id)])
        self.assertEqual(after, before)

    def test_standard_surveys_are_unaffected(self):
        survey = self.env["survey.survey"].create(
            {"title": "Plain", "access_mode": "public"}
        )
        self.env["survey.question"].create(
            {"survey_id": survey.id, "title": "Comment", "question_type": "char_box"}
        )
        self.url_open("/survey/start/%s" % survey.access_token)
        self.assertEqual(
            self.env["survey.user_input"].search_count([("survey_id", "=", survey.id)]), 1
        )
