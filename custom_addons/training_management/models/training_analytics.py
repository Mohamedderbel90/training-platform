from odoo import models

KPI_CATEGORIES = ("trainer_performance", "content", "environment")


class TrainingAnalytics(models.AbstractModel):
    """Single source of truth for KPI/attendance/response-rate formulas
    (PROJECT_SPEC section 14; M3). Pure query/computation service: no
    stored/persisted derived metrics, no HTTP controller here (M4).

    All "no data" cases return None, never a misleading 0 -- callers
    (Back-office views, and later dashboards/reports/API) must decide
    how to render "unavailable" distinctly from an actual value.
    """

    _name = "training.analytics"
    _description = "Training Analytics Service"

    KPI_CATEGORIES = KPI_CATEGORIES

    # ------------------------------------------------------------------
    # Scope resolution
    # ------------------------------------------------------------------

    def _resolve_days(
        self, program=None, course=None, day=None, trainer=None,
        date_from=None, date_to=None, states=None,
    ):
        """training.day recordset matching the given optional filters.
        Each argument is a recordset (or None to not filter on it);
        ``states`` optionally narrows to training-day states (FR-055
        "status"), never widening past the not-held exclusion below."""
        # DEC-22: days that were not held (cancelled, or postponed and not
        # yet reopened) never contribute to any KPI.
        domain = [("state", "not in", ("cancelled", "postponed"))]
        if day:
            domain.append(("id", "in", day.ids))
        if course:
            domain.append(("course_id", "in", course.ids))
        if program:
            domain.append(("course_id.program_id", "in", program.ids))
        if trainer:
            domain.append(("trainer_ids", "in", trainer.ids))
        if date_from:
            domain.append(("date", ">=", date_from))
        if date_to:
            domain.append(("date", "<=", date_to))
        if states:
            domain.append(("state", "in", list(states)))
        return self.env["training.day"].search(domain)

    def _survey_input_model(self):
        """survey.user_input as seen by this service.

        Only the General Supervisor generates reports, and that role has
        no direct ACL on survey.user_input rows it does not own
        (SEC-007), so a plain search could make a generated report
        silently incomplete. KPI/response-rate output here is aggregate
        only (no respondent identity), so for the General Supervisor
        the aggregation reads through sudo(). Everyone else --
        including any authenticated user calling this public service
        method over RPC -- keeps the caller's own ACL/record rules, so
        it can never be used to read other people's responses. The
        scope is still bounded by the caller-visible training days.
        """
        UserInput = self.env["survey.user_input"]
        user = self.env.user
        if not self.env.su and user.has_group(
            "training_management.group_training_admin"
        ):
            return UserInput.sudo()
        return UserInput

    @staticmethod
    def _safe_ratio(numerator, denominator):
        """Percentage, or None if the denominator is zero/unavailable --
        never a misleading 0."""
        if not denominator:
            return None
        return (numerator / denominator) * 100.0

    # ------------------------------------------------------------------
    # Response-level KPI (rating scale)
    # ------------------------------------------------------------------

    @staticmethod
    def _line_rating_value(line):
        """Stable numeric value (1-5) for one answer line, or None if it
        does not carry a valid rating. Never derived from translated
        label text (PROJECT_SPEC section 12: analytics must not depend
        on UI language)."""
        if line.skipped:
            return None
        if line.answer_type == "suggestion" and line.suggested_answer_id:
            return line.suggested_answer_id.rating_value or None
        if line.answer_type == "scale":
            return line.value_scale or None
        return None

    def get_response_category_score(self, user_input, category):
        """Arithmetic mean of valid numeric-mapped answers for
        ``category`` within a single response. None if the response has
        no valid mapped answer for that category (never 0)."""
        user_input.ensure_one()
        lines = user_input.user_input_line_ids.filtered(
            lambda line: line.question_id.kpi_category == category
        )
        values = [
            v for v in (self._line_rating_value(line) for line in lines)
            if v is not None
        ]
        if not values:
            return None
        return sum(values) / len(values)

    def get_response_scores(self, user_input):
        """{category: score|None} for one final (state='done') response.
        Historical version safety: this reads user_input_line_ids /
        question_id exactly as linked on this response record, i.e. the
        survey/question version actually used at submission time --
        never the training.day's *current* survey assignment."""
        user_input.ensure_one()
        return {
            category: self.get_response_category_score(user_input, category)
            for category in self.KPI_CATEGORIES
        }

    def _aggregate_response_scores(self, responses, category):
        """Mean of response-level category scores, each valid response
        weighted equally. Responses with no valid score for this
        category are excluded, not treated as 0. This is used for BOTH
        course- and program-level KPIs: pooling all matching final
        responses directly (never averaging per-day or per-course
        sub-averages) is what keeps every response equally weighted."""
        scores = [
            v for v in (
                self.get_response_category_score(response, category)
                for response in responses
            )
            if v is not None
        ]
        if not scores:
            return None
        return sum(scores) / len(scores)

    def get_kpi(
        self, program=None, course=None, day=None, trainer=None,
        date_from=None, date_to=None, categories=None, respondent_role=None,
        states=None,
    ):
        """{category: score|None}, pooling all final responses linked to
        training days matching the given filters. Equal weight per
        response; never average-of-day-averages or
        average-of-course-averages. ``respondent_role`` optionally
        restricts to one role's responses (DEC-21: environment is
        reported separately for trainees and the supervisor)."""
        days = self._resolve_days(
            program, course, day, trainer, date_from, date_to, states=states
        )
        domain = [("training_day_id", "in", days.ids), ("state", "=", "done")]
        if respondent_role:
            domain.append(("respondent_role", "=", respondent_role))
        responses = self._survey_input_model().search(domain)
        return {
            category: self._aggregate_response_scores(responses, category)
            for category in (categories or self.KPI_CATEGORIES)
        }

    # ------------------------------------------------------------------
    # Attendance metrics
    # ------------------------------------------------------------------

    def get_attendance_metrics(
        self, program=None, course=None, day=None, date_from=None, date_to=None,
        trainer=None, states=None,
    ):
        """Counts and rates over training.attendance records for the
        given scope. Rates are None (not 0) when their denominator is
        zero."""
        days = self._resolve_days(
            program=program, course=course, day=day, date_from=date_from,
            date_to=date_to, trainer=trainer, states=states,
        )
        attendances = self.env["training.attendance"].search(
            [("training_day_id", "in", days.ids)]
        )
        present_count = len(attendances.filtered(lambda a: a.status == "present"))
        late_count = len(attendances.filtered(lambda a: a.status == "late"))
        absent_count = len(attendances.filtered(lambda a: a.status == "absent"))
        total_count = len(attendances)
        return {
            "present_count": present_count,
            "late_count": late_count,
            "absent_count": absent_count,
            "total_count": total_count,
            "attendance_rate": self._safe_ratio(
                present_count + late_count, total_count
            ),
            "absence_rate": self._safe_ratio(absent_count, total_count),
            "late_rate": self._safe_ratio(late_count, present_count + late_count),
        }

    # ------------------------------------------------------------------
    # Trainee survey response rate
    # ------------------------------------------------------------------

    def get_trainee_response_rate(
        self, program=None, course=None, day=None, date_from=None, date_to=None,
        trainer=None, states=None,
    ):
        """Submitted trainee survey responses / (present + late) * 100.
        Absent trainees are excluded from the denominator. None (not 0)
        if attendance has not been recorded (denominator is zero)."""
        days = self._resolve_days(
            program=program, course=course, day=day, date_from=date_from,
            date_to=date_to, trainer=trainer, states=states,
        )
        # D3 / DEC-17: the target of a day is the trainees recorded present
        # or late on it (their rows are history, kept whatever the
        # enrollment is now, DEC-18). Only THEIR final responses count, so
        # the rate can never exceed 100%.
        eligible = self.env["training.attendance"].search(
            [
                ("training_day_id", "in", days.ids),
                ("status", "in", ("present", "late")),
            ]
        )
        if not eligible:
            return None
        targets = {
            (row.training_day_id.id, row.enrollment_id.partner_id.id)
            for row in eligible
        }
        responses = self._survey_input_model().search(
            [
                ("training_day_id", "in", days.ids),
                ("respondent_role", "=", "trainee"),
                ("state", "=", "done"),
            ]
        )
        submitted_count = len(
            {
                (response.training_day_id.id, response.partner_id.id)
                for response in responses
            }
            & targets
        )
        return (submitted_count / len(targets)) * 100.0

    # ------------------------------------------------------------------
    # One comparison row (a day, or a course) -- shared by the report
    # narrative and the General Supervisor dashboard so both show the
    # same numbers for the same scope (AC-ALN-15).
    # ------------------------------------------------------------------

    def get_period_figures(self, label, date_from, date_to, scope):
        pooled = self.get_kpi(
            date_from=date_from, date_to=date_to,
            categories=("trainer_performance", "content"), **scope
        )
        env_trainee = self.get_kpi(
            date_from=date_from, date_to=date_to, categories=("environment",),
            respondent_role="trainee", **scope
        )["environment"]
        env_supervisor = self.get_kpi(
            date_from=date_from, date_to=date_to, categories=("environment",),
            respondent_role="supervisor", **scope
        )["environment"]
        attendance = self.get_attendance_metrics(
            date_from=date_from, date_to=date_to, **scope
        )
        return {
            "label": label,
            "trainer_performance": pooled["trainer_performance"],
            "content": pooled["content"],
            "environment": env_trainee,
            "environment_supervisor": env_supervisor,
            "attendance_rate": attendance["attendance_rate"],
        }
