from markupsafe import Markup, escape

from odoo import _, api, fields, models

_INDICATORS = (
    ("trainer_performance", "Trainer Score"),
    ("content", "Content Score"),
    ("environment", "Training Environment Score (Trainees)"),
    ("environment_supervisor", "Training Environment Score (Supervisor)"),
    ("attendance_rate", "Attendance Rate (%)"),
)


def _suffix(key):
    return "%" if key.endswith("_rate") else ""


class TrainingDashboard(models.TransientModel):
    """P1 / BRD FR-050..056: the General Supervisor's dashboard in Odoo.
    Every number comes from training.analytics (the single KPI source), so
    dashboard and reports agree for the same filters; nothing is stored.
    Filters: program, course, trainer, date range and training-day state
    (FR-055). Drill-down to the days behind the numbers (FR-056)."""

    _name = "training.dashboard"
    _description = "General Supervisor Dashboard"

    def _compute_display_name(self):
        for record in self:
            record.display_name = _("Dashboard")

    program_id = fields.Many2one("training.program", string="Program")
    course_id = fields.Many2one(
        "training.course", string="Course",
        domain="[('program_id', '=?', program_id)]",
    )
    trainer_id = fields.Many2one(
        "res.users", string="Trainer",
        domain=lambda self: [
            ("group_ids", "in", [self.env.ref("training_management.group_training_trainer").id])
        ],
    )
    date_from = fields.Date(string="From")
    date_to = fields.Date(string="To")
    day_state = fields.Selection(
        selection=[("planned", "Planned"), ("open", "Open"), ("closed", "Closed")],
        string="Day Status",
        help="Cancelled and postponed days are never counted (DEC-22).",
    )

    days_count = fields.Integer(compute="_compute_indicators")
    trainer_score = fields.Float(compute="_compute_indicators", digits=(3, 2))
    trainer_score_has_data = fields.Boolean(compute="_compute_indicators")
    content_score = fields.Float(compute="_compute_indicators", digits=(3, 2))
    content_score_has_data = fields.Boolean(compute="_compute_indicators")
    environment_score = fields.Float(
        string="Environment (Trainees)", compute="_compute_indicators", digits=(3, 2)
    )
    environment_score_has_data = fields.Boolean(compute="_compute_indicators")
    environment_supervisor_score = fields.Float(
        string="Environment (Supervisor)", compute="_compute_indicators", digits=(3, 2)
    )
    environment_supervisor_score_has_data = fields.Boolean(compute="_compute_indicators")
    attendance_rate = fields.Float(compute="_compute_indicators", digits=(5, 1))
    attendance_rate_has_data = fields.Boolean(compute="_compute_indicators")
    absence_rate = fields.Float(compute="_compute_indicators", digits=(5, 1))
    absence_rate_has_data = fields.Boolean(compute="_compute_indicators")
    late_rate = fields.Float(compute="_compute_indicators", digits=(5, 1))
    late_rate_has_data = fields.Boolean(compute="_compute_indicators")
    response_rate = fields.Float(compute="_compute_indicators", digits=(5, 1))
    response_rate_has_data = fields.Boolean(compute="_compute_indicators")
    comparison_html = fields.Html(compute="_compute_indicators", sanitize=False)

    def _scope(self):
        self.ensure_one()
        scope = {}
        if self.program_id:
            scope["program"] = self.program_id
        if self.course_id:
            scope["course"] = self.course_id
        if self.trainer_id:
            scope["trainer"] = self.trainer_id
        return scope

    def _states(self):
        return [self.day_state] if self.day_state else None

    @api.depends(
        "program_id", "course_id", "trainer_id", "date_from", "date_to", "day_state"
    )
    def _compute_indicators(self):
        analytics = self.env["training.analytics"]
        for dash in self:
            scope = dash._scope()
            states = dash._states()
            common = dict(date_from=dash.date_from, date_to=dash.date_to, states=states)
            days = analytics._resolve_days(
                date_from=dash.date_from, date_to=dash.date_to, states=states, **scope
            )
            pooled = analytics.get_kpi(
                categories=("trainer_performance", "content"), **common, **scope
            )
            env_trainee = analytics.get_kpi(
                categories=("environment",), respondent_role="trainee", **common, **scope
            )["environment"]
            env_supervisor = analytics.get_kpi(
                categories=("environment",), respondent_role="supervisor", **common, **scope
            )["environment"]
            attendance = analytics.get_attendance_metrics(**common, **scope)
            response_rate = analytics.get_trainee_response_rate(**common, **scope)

            def put(name, value):
                dash[name] = value or 0.0
                dash[name + "_has_data"] = value is not None

            dash.days_count = len(days)
            put("trainer_score", pooled["trainer_performance"])
            put("content_score", pooled["content"])
            put("environment_score", env_trainee)
            put("environment_supervisor_score", env_supervisor)
            put("attendance_rate", attendance["attendance_rate"])
            put("absence_rate", attendance["absence_rate"])
            put("late_rate", attendance["late_rate"])
            put("response_rate", response_rate)
            dash.comparison_html = dash._build_comparison(analytics, days)

    def _build_comparison(self, analytics, days):
        """FR-053/054: day comparison inside a chosen course, otherwise
        course comparison inside the chosen program (or all programs),
        with the trend (last minus first period with data, DEC-20)."""
        self.ensure_one()
        scope_extra = {"trainer": self.trainer_id} if self.trainer_id else {}
        if self.course_id:
            periods = [
                analytics.get_period_figures(
                    fields.Date.to_string(day.date), None, None, {"day": day}
                )
                for day in days.sorted(lambda d: (d.date, d.id))
            ]
        else:
            courses = days.mapped("course_id").sorted(
                lambda c: (c.program_id.id, c.sequence, c.start_date, c.id)
            )
            periods = [
                analytics.get_period_figures(
                    course.name, self.date_from, self.date_to,
                    dict(course=course, states=self._states(), **scope_extra),
                )
                for course in courses
            ]
        if not periods:
            return Markup("<p>%s</p>") % _("No data")

        def cell(value, suffix=""):
            if value is None:
                return escape(_("No data"))
            return escape("%.2f%s" % (value, suffix))

        head = Markup("").join(
            Markup("<th>%s</th>") % _(label) for _key, label in _INDICATORS
        )
        rows = Markup("").join(
            Markup("<tr><td>%s</td>%s</tr>")
            % (
                period["label"],
                Markup("").join(
                    Markup("<td>%s</td>") % cell(period[key], _suffix(key))
                    for key, _l in _INDICATORS
                ),
            )
            for period in periods
        )
        trend = Markup("").join(
            Markup("<td>%s</td>")
            % cell(
                self._trend_value([period[key] for period in periods]), _suffix(key)
            )
            for key, _l in _INDICATORS
        )
        return Markup(
            '<table class="table table-sm"><thead><tr><th></th>%s</tr></thead>'
            "<tbody>%s<tr><td><strong>%s</strong></td>%s</tr></tbody></table>"
        ) % (head, rows, _("Trend (last minus first)"), trend)

    @staticmethod
    def _trend_value(values):
        present = [v for v in values if v is not None]
        if len(present) < 2:
            return None
        return round(present[-1] - present[0], 2)

    def action_view_days(self):
        """FR-056: drill down from the indicators to the days behind them."""
        self.ensure_one()
        days = self.env["training.analytics"]._resolve_days(
            date_from=self.date_from, date_to=self.date_to,
            states=self._states(), **self._scope(),
        )
        return {
            "type": "ir.actions.act_window",
            "name": _("Training Days"),
            "res_model": "training.day",
            "view_mode": "list,form,calendar",
            "domain": [("id", "in", days.ids)],
        }
