from odoo import fields, models
from odoo.tools import SQL


class TrainingSurveyResponseKpi(models.Model):
    """Read-only reporting projection over final survey responses, one
    row per (response, kpi_category) that actually has at least one
    valid mapped answer.

    This exists so the Odoo Back-office can use standard List/Graph/
    Pivot views (PROJECT_SPEC section 8/M3 point 10) to visualize
    response-level KPI scores WITHOUT the "0 vs. no data" ambiguity a
    plain computed Float field would introduce: Odoo's fields.Float
    stores a falsy Python value as SQL 0.0, not NULL (verified against
    odoo/orm/fields_numeric.py: `falsy_value = 0.0`), so a naive
    computed measure would make Pivot/Graph averages silently count
    "no valid answers" as a zero score. Here, a (response, category)
    combination with no valid answer simply produces no row at all, so
    the standard AVG() aggregator (score field's aggregator='avg') is
    correct by construction -- no row is ever treated as a zero.

    This mirrors the same math as
    training.analytics.get_response_category_score()/get_kpi() for
    reporting purposes; that Python service remains the single source
    of truth for anything beyond this Back-office visualization (any
    future change to the KPI formula must be applied to both).

    Implementation note (Odoo 19 verified convention): this uses the
    modern `_table_query` property (as core `account.invoice.report`/
    `sale.report` do), not the older `init()` +
    `tools.drop_view_if_exists()` + raw `CREATE VIEW` pattern from
    earlier Odoo versions -- see ADR-002 for why.
    """

    _name = "training.survey.response.kpi"
    _description = "Training Survey Response KPI (reporting view)"
    _auto = False
    _order = "training_day_id desc"

    # Without this, Odoo has no way to know that a pending (unflushed)
    # ORM write to any of these fields must be flushed to the database
    # before this raw SQL query runs -- verified: _table_sql() only
    # triggers a flush when _depends is declared (odoo/orm/models.py).
    # Omitting it caused a real test failure (a just-created response's
    # answer line was invisible to this view) during M3 implementation.
    _depends = {
        "survey.user_input": ["survey_id", "training_day_id", "respondent_role", "state"],
        "survey.user_input.line": [
            "user_input_id", "question_id", "answer_type", "suggested_answer_id",
            "value_scale", "skipped",
        ],
        "survey.question": ["kpi_category"],
        "survey.question.answer": ["rating_value"],
        "training.day": ["course_id"],
        "training.course": ["program_id"],
    }

    user_input_id = fields.Many2one("survey.user_input", string="Response", readonly=True)
    training_day_id = fields.Many2one("training.day", string="Training Day", readonly=True)
    course_id = fields.Many2one("training.course", string="Course", readonly=True)
    program_id = fields.Many2one("training.program", string="Program", readonly=True)
    respondent_role = fields.Selection(
        selection=[
            ("trainee", "Trainee"),
            ("supervisor", "Supervisor"),
            ("trainer", "Trainer"),
        ],
        readonly=True,
    )
    kpi_category = fields.Selection(
        selection=[
            ("trainer_performance", "Trainer Performance"),
            ("content", "Content"),
            ("environment", "Environment"),
        ],
        readonly=True,
    )
    score = fields.Float("Score", readonly=True, aggregator="avg", digits=(3, 2))

    @property
    def _table_query(self) -> SQL:
        return SQL(
            """
            SELECT
                row_number() OVER () AS id,
                ui.id AS user_input_id,
                ui.training_day_id AS training_day_id,
                td.course_id AS course_id,
                tc.program_id AS program_id,
                ui.respondent_role AS respondent_role,
                q.kpi_category AS kpi_category,
                AVG(
                    CASE
                        WHEN uil.answer_type = 'suggestion' THEN qa.rating_value
                        WHEN uil.answer_type = 'scale' THEN uil.value_scale
                        ELSE NULL
                    END
                ) AS score
            FROM survey_user_input ui
            JOIN survey_user_input_line uil ON uil.user_input_id = ui.id
            JOIN survey_question q ON q.id = uil.question_id
            LEFT JOIN survey_question_answer qa ON qa.id = uil.suggested_answer_id
            JOIN training_day td ON td.id = ui.training_day_id
            JOIN training_course tc ON tc.id = td.course_id
            WHERE ui.state = 'done'
              AND uil.skipped IS NOT TRUE
              AND q.kpi_category IS NOT NULL
              AND (
                    (uil.answer_type = 'suggestion' AND qa.rating_value IS NOT NULL)
                 OR (uil.answer_type = 'scale' AND uil.value_scale IS NOT NULL)
              )
            GROUP BY
                ui.id, ui.training_day_id, td.course_id, tc.program_id,
                ui.respondent_role, q.kpi_category
            """
        )
