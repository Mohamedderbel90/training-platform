from odoo.addons.survey.controllers.main import Survey


class TrainingSurveyAccess(Survey):
    """C4 / BR-001, BR-011, FR-018: the three project surveys are answered
    only through the Operational API, which enforces the training day, the
    survey window and the final-response lock. Odoo's standard public
    survey routes (/survey/start|begin|submit|print/<token>) would bypass
    all of that, so they treat every project survey as non-existent. The
    General Supervisor's own "Test" preview entries are still allowed."""

    def _check_validity(
        self, survey_sudo, answer_sudo, answer_token, ensure_token=True, check_partner=True
    ):
        if survey_sudo and survey_sudo.survey_role and not (
            answer_sudo and answer_sudo.test_entry
        ):
            return "survey_wrong"
        return super()._check_validity(
            survey_sudo, answer_sudo, answer_token,
            ensure_token=ensure_token, check_partner=check_partner,
        )
