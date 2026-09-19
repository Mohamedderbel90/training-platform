from odoo import _, api, fields, models
from odoo.exceptions import UserError

# Fields that define the meaning of a survey version once it has real
# submitted responses. Changing them on a used version would silently
# alter the meaning of historical data, so they are locked (PROJECT_SPEC
# section 12: "Historical survey versions/responses must never be
# rewritten by future survey edits"). Cosmetic fields (title,
# description) are intentionally NOT locked.
STRUCTURAL_SURVEY_FIELDS = {
    "question_and_page_ids",
    "survey_role",
    "training_program_id",
    "training_course_id",
}


class SurveySurvey(models.Model):
    _inherit = "survey.survey"

    # Project-defined fields (PROJECT_SPEC section 6). survey_role is
    # intentionally optional at the field level: this extension applies
    # to every survey.survey record in the database, including any
    # unrelated to this project, and must not break their creation.
    survey_role = fields.Selection(
        selection=[
            ("trainee", "Trainee"),
            ("supervisor", "Supervisor"),
            ("trainer", "Trainer"),
        ],
    )
    training_program_id = fields.Many2one("training.program", string="Training Program")
    training_course_id = fields.Many2one("training.course", string="Training Course")
    version_no = fields.Integer(default=1, required=True)
    previous_version_id = fields.Many2one("survey.survey", string="Previous Version")
    effective_from = fields.Datetime()

    has_submitted_responses = fields.Boolean(
        compute="_compute_has_submitted_responses",
        help="True once at least one response for this survey version has "
        "been finally submitted (state=done). Used to lock historical "
        "structure instead of an invented survey state.",
    )

    @api.depends("user_input_ids.state")
    def _compute_has_submitted_responses(self):
        for survey in self:
            survey.has_submitted_responses = any(
                ui.state == "done" for ui in survey.user_input_ids
            )

    def write(self, vals):
        if STRUCTURAL_SURVEY_FIELDS & set(vals.keys()):
            for survey in self:
                if survey.has_submitted_responses:
                    raise UserError(
                        _(
                            "\"%s\" already has submitted responses; its "
                            "structure/ownership cannot be changed. Clone it "
                            "as a new version instead."
                        )
                        % survey.title
                    )
        return super().write(vals)

    def unlink(self):
        for survey in self:
            if survey.has_submitted_responses:
                raise UserError(
                    _(
                        "\"%s\" already has submitted responses and cannot "
                        "be deleted. Archive it instead."
                    )
                    % survey.title
                )
        return super().unlink()

    def action_clone_as_new_version(self):
        """Create a new survey.survey version linked to this one.

        Per PROJECT_SPEC section 12: historical survey.user_input/lines
        remain linked to the original survey/questions; only future
        training days should point to the new version.
        """
        self.ensure_one()
        new_version_no = self.version_no + 1
        new_survey = self.copy(
            {
                "title": _("%s (v%s)") % (self.title, new_version_no),
                "version_no": new_version_no,
                "previous_version_id": self.id,
                "effective_from": fields.Datetime.now(),
            }
        )
        return {
            "type": "ir.actions.act_window",
            "res_model": "survey.survey",
            "view_mode": "form",
            "res_id": new_survey.id,
        }

    def _get_definition_dto(self):
        """Frontend-facing survey definition (M4 point 10/15): sections,
        questions, answer options, required flags, and the safe IDs
        needed for submission. No Odoo-internal fields beyond IDs are
        exposed (no access_token, no scoring internals, etc.)."""
        self.ensure_one()
        sections = []
        current = {"id": 0, "title": None, "questions": []}

        def flush():
            if current["questions"]:
                sections.append(dict(current))

        for question in self.question_and_page_ids.sorted("sequence"):
            if question.is_page:
                flush()
                current["id"] = question.id
                current["title"] = question.title
                current["questions"] = []
            else:
                current["questions"].append(question._get_definition_dto())
        flush()

        return {
            "survey_id": self.id,
            "title": self.title,
            "version_no": self.version_no,
            "sections": sections,
        }
