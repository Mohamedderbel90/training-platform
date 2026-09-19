from odoo.exceptions import UserError
from odoo.tests.common import TransactionCase, tagged


@tagged("post_install", "-at_install", "training_management_survey")
class TestSurveySurvey(TransactionCase):
    def _create_survey(self, role, **overrides):
        values = {"title": "Test %s Survey" % role, "survey_role": role}
        values.update(overrides)
        return self.env["survey.survey"].create(values)

    def _create_question(self, survey, **overrides):
        values = {
            "survey_id": survey.id,
            "title": "Test Question",
            "question_type": "simple_choice",
        }
        values.update(overrides)
        return self.env["survey.question"].create(values)

    def _mark_submitted(self, survey):
        """Create a minimal final (state=done) response for a survey,
        without needing a training.day fixture -- has_submitted_responses
        only depends on any linked user_input reaching state='done'."""
        return self.env["survey.user_input"].create(
            {"survey_id": survey.id, "state": "done"}
        )

    # ---- survey_role values ----

    def test_survey_role_valid_values(self):
        for role in ("trainee", "supervisor", "trainer"):
            survey = self._create_survey(role)
            self.assertEqual(survey.survey_role, role)

    def test_survey_role_optional(self):
        survey = self.env["survey.survey"].create({"title": "Unrelated Survey"})
        self.assertFalse(survey.survey_role)

    def test_survey_role_invalid_value_rejected(self):
        with self.assertRaises(Exception):
            self._create_survey("invalid_role")

    # ---- version creation/linking ----

    def test_clone_as_new_version(self):
        original = self._create_survey("trainee", version_no=1)
        self._create_question(original)
        action = original.action_clone_as_new_version()
        new_survey = self.env["survey.survey"].browse(action["res_id"])
        self.assertEqual(new_survey.version_no, 2)
        self.assertEqual(new_survey.previous_version_id, original)
        self.assertEqual(new_survey.survey_role, "trainee")
        # Standard copy() deep-copies question_and_page_ids (copy=True).
        self.assertEqual(len(new_survey.question_ids), 1)
        self.assertNotEqual(new_survey.id, original.id)

    def test_clone_chain_increments_deterministically(self):
        v1 = self._create_survey("trainer", version_no=1)
        action_v2 = v1.action_clone_as_new_version()
        v2 = self.env["survey.survey"].browse(action_v2["res_id"])
        action_v3 = v2.action_clone_as_new_version()
        v3 = self.env["survey.survey"].browse(action_v3["res_id"])
        self.assertEqual(v2.version_no, 2)
        self.assertEqual(v3.version_no, 3)
        self.assertEqual(v3.previous_version_id, v2)

    # ---- protection of historical used version ----

    def test_used_survey_structure_cannot_be_mutated(self):
        survey = self._create_survey("trainee")
        self._create_question(survey)
        self._mark_submitted(survey)
        self.assertTrue(survey.has_submitted_responses)
        with self.assertRaises(UserError):
            self._create_question(survey)  # adding a question writes question_and_page_ids
        with self.assertRaises(UserError):
            survey.write({"survey_role": "supervisor"})

    def test_used_survey_cosmetic_edit_still_allowed(self):
        survey = self._create_survey("trainee")
        self._mark_submitted(survey)
        survey.write({"title": "Renamed Title"})
        self.assertEqual(survey.title, "Renamed Title")

    def test_used_survey_cannot_be_deleted(self):
        survey = self._create_survey("supervisor")
        self._mark_submitted(survey)
        with self.assertRaises(UserError):
            survey.unlink()

    def test_unused_survey_can_be_edited_and_deleted(self):
        survey = self._create_survey("trainer")
        self._create_question(survey)
        survey.write({"survey_role": "trainee"})
        self.assertEqual(survey.survey_role, "trainee")
        survey.unlink()

    def test_used_survey_question_kpi_category_locked(self):
        survey = self._create_survey("trainee")
        question = self._create_question(survey, kpi_category="content")
        self._mark_submitted(survey)
        with self.assertRaises(UserError):
            question.write({"kpi_category": "environment"})
        with self.assertRaises(UserError):
            question.unlink()

    # ---- kpi_category values ----

    def test_kpi_category_valid_values(self):
        survey = self._create_survey("trainee")
        for category in ("trainer_performance", "content", "environment"):
            question = self._create_question(
                survey, title="Q %s" % category, kpi_category=category
            )
            self.assertEqual(question.kpi_category, category)

    def test_kpi_category_optional(self):
        survey = self._create_survey("trainee")
        question = self._create_question(survey, title="Free comment")
        self.assertFalse(question.kpi_category)

    def test_kpi_category_invalid_value_rejected(self):
        survey = self._create_survey("trainee")
        with self.assertRaises(Exception):
            self._create_question(survey, kpi_category="invalid_category")
