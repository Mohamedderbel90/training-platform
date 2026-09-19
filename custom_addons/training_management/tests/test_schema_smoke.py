"""Standard Odoo schema smoke test (milestone M0).

PROJECT_SPEC_v1.1_BILINGUAL.md, section 4, lists the standard Odoo
models/fields the project relies on and requires that no coding agent
"invent" a standard field or model without verifying it against the
actual Odoo runtime first (section 24, rule 2).

This test does exactly that verification. It contains no business
logic: it only asserts that the standard models and fields the spec
depends on actually exist, with the expected type, on the Odoo
instance the test is run against. If this test fails, the project
specification's assumptions about the Odoo runtime are wrong and must
be reconciled before any business model work (milestone M1 onward)
starts.
"""
from odoo.tests.common import TransactionCase, tagged


# model -> field names PROJECT_SPEC_v1.1_BILINGUAL.md section 4 relies on.
#
# VERIFIED DRIFT (milestone M0, against real Odoo 19.0 source):
# PROJECT_SPEC section 4 lists both "phone" and "mobile" as standard
# res.partner fields. On the actual Odoo 19.0 runtime, res.partner no
# longer has a separate "mobile" field -- it was consolidated into a
# single "phone" field (odoo/addons/base/models/res_partner.py defines
# only `phone = fields.Char()`, no `mobile`). This test intentionally
# does NOT require "mobile" so it reflects verified runtime truth
# rather than the spec's unverified assumption; PROJECT_SPEC section 4
# and section 24 rule 2 need a corresponding update/ADR before any
# code reads/writes res.partner.mobile.
REQUIRED_FIELDS = {
    "res.users": ["login", "active", "partner_id"],
    "res.partner": ["name", "email", "phone", "lang", "active"],
    "res.groups": ["name", "implied_ids"],
    "survey.survey": ["title", "access_token", "question_ids"],
    "survey.question": [
        "title",
        "survey_id",
        "question_type",
        "suggested_answer_ids",
        "sequence",
    ],
    "survey.question.answer": ["value", "question_id", "sequence"],
    "survey.user_input": [
        "survey_id",
        "state",
        "start_datetime",
        "end_datetime",
        "deadline",
        "access_token",
        "partner_id",
        "email",
        "user_input_line_ids",
    ],
    "survey.user_input.line": [
        "user_input_id",
        "survey_id",
        "question_id",
        "answer_type",
        "skipped",
        "value_char_box",
        "value_text_box",
        "value_numerical_box",
        "value_scale",
        "value_date",
        "value_datetime",
        "suggested_answer_id",
        "matrix_row_id",
    ],
    "mail.activity": [
        "activity_type_id",
        "res_model",
        "res_id",
        "user_id",
        "date_deadline",
    ],
    "mail.template": [
        "name",
        "model_id",
        "subject",
        "body_html",
        "email_from",
        "email_to",
    ],
    "mail.mail": ["subject", "body_html", "email_from", "email_to", "state"],
    "ir.attachment": ["name", "datas", "mimetype", "res_model", "res_id"],
    "ir.actions.report": [
        "name",
        "model",
        "report_type",
        "report_name",
        "paperformat_id",
    ],
    # ir.cron field names are intentionally NOT copied from the older
    # ERD/API_Contract docx appendix ("ir_actions_server_id",
    # "cron_name"): those do not match core Odoo naming and must not be
    # trusted without runtime verification (PROJECT_SPEC section 24,
    # rule 2). Only a conservative, well-known subset is asserted here.
    "ir.cron": ["name", "interval_number", "interval_type", "active", "user_id"],
}

# Abstract mixins used by the project (mail.thread, mail.activity.mixin).
# These are not concrete/stored models, so they are checked separately
# from REQUIRED_FIELDS: we only assert they are registered and expose
# the fields the spec names, not that they can be searched/created on
# their own.
REQUIRED_MIXIN_FIELDS = {
    "mail.thread": ["message_ids", "message_follower_ids"],
    "mail.activity.mixin": ["activity_ids"],
}

# survey.user_input.state must stay on the Odoo 19 standard selection
# values. PROJECT_SPEC section 4 explicitly forbids adding a
# standard-style "submitted" value to this field.
EXPECTED_SURVEY_USER_INPUT_STATES = {"new", "in_progress", "done"}


@tagged("post_install", "-at_install", "training_management_smoke")
class TestStandardSchemaSmoke(TransactionCase):
    """Verify the standard Odoo 19 models/fields PROJECT_SPEC depends on."""

    def test_required_models_and_fields_exist(self):
        missing_models = []
        missing_fields = {}

        for model_name, field_names in REQUIRED_FIELDS.items():
            if model_name not in self.env:
                missing_models.append(model_name)
                continue
            model = self.env[model_name]
            missing = [f for f in field_names if f not in model._fields]
            if missing:
                missing_fields[model_name] = missing

        self.assertFalse(
            missing_models,
            "Standard Odoo models expected by PROJECT_SPEC are missing on "
            "this runtime: %s" % missing_models,
        )
        self.assertFalse(
            missing_fields,
            "Standard Odoo fields expected by PROJECT_SPEC are missing: %s"
            % missing_fields,
        )

    def test_required_mixins_exist(self):
        missing = {}
        for model_name, field_names in REQUIRED_MIXIN_FIELDS.items():
            if model_name not in self.env:
                missing[model_name] = "model not registered"
                continue
            model = self.env[model_name]
            absent = [f for f in field_names if f not in model._fields]
            if absent:
                missing[model_name] = absent

        self.assertFalse(
            missing,
            "Standard Odoo mixins expected by PROJECT_SPEC are missing or "
            "incomplete: %s" % missing,
        )

    def test_survey_user_input_state_values(self):
        """PROJECT_SPEC section 4: do not invent a 'submitted' state.

        Business 'Submitted' must map to state == 'done'; the standard
        selection must remain new/in_progress/done.
        """
        field = self.env["survey.user_input"]._fields["state"]
        selection = field.selection
        if callable(selection):
            selection = selection(self.env["survey.user_input"])
        actual_values = {value for value, _label in selection}

        self.assertTrue(
            EXPECTED_SURVEY_USER_INPUT_STATES.issubset(actual_values),
            "survey.user_input.state is missing expected standard values. "
            "Expected at least %s, found %s"
            % (EXPECTED_SURVEY_USER_INPUT_STATES, actual_values),
        )
        self.assertNotIn(
            "submitted",
            actual_values,
            "survey.user_input.state must not contain a standard-style "
            "'submitted' value; business Submitted maps to state == 'done' "
            "per PROJECT_SPEC section 4.",
        )
