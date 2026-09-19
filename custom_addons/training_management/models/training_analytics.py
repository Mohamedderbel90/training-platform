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
        date_from=None, date_to=None,
    ):
        """training.day recordset matching the given optional filters.
        Each argument is a recordset (or None to not filter on it)."""
        domain = []
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
        return self.env["training.day"].search(domain)

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
        date_from=None, date_to=None, categories=None,
    ):
        """{category: score|None}, pooling all final responses linked to
        training days matching the given filters. Equal weight per
        response; never average-of-day-averages or
        average-of-course-averages."""
        days = self._resolve_days(program, course, day, trainer, date_from, date_to)
        responses = self.env["survey.user_input"].search(
            [("training_day_id", "in", days.ids), ("state", "=", "done")]
        )
        return {
            category: self._aggregate_response_scores(responses, category)
            for category in (categories or self.KPI_CATEGORIES)
        }

    # ------------------------------------------------------------------
    # Attendance metrics
    # ------------------------------------------------------------------

    def get_attendance_metrics(
        self, program=None, course=None, day=None, date_from=None, date_to=None,
    ):
        """Counts and rates over training.attendance records for the
        given scope. Rates are None (not 0) when their denominator is
        zero."""
        days = self._resolve_days(
            program=program, course=course, day=day, date_from=date_from,
            date_to=date_to,
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
    ):
        """Submitted trainee survey responses / (present + late) * 100.
        Absent trainees are excluded from the denominator. None (not 0)
        if attendance has not been recorded (denominator is zero)."""
        days = self._resolve_days(
            program=program, course=course, day=day, date_from=date_from,
            date_to=date_to,
        )
        eligible_count = self.env["training.attendance"].search_count(
            [
                ("training_day_id", "in", days.ids),
                ("status", "in", ("present", "late")),
            ]
        )
        if not eligible_count:
            return None
        submitted_count = self.env["survey.user_input"].search_count(
            [
                ("training_day_id", "in", days.ids),
                ("respondent_role", "=", "trainee"),
                ("state", "=", "done"),
            ]
        )
        return (submitted_count / eligible_count) * 100.0
