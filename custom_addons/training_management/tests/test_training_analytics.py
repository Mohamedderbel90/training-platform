from datetime import timedelta

from odoo import fields
from odoo.exceptions import AccessError
from odoo.tests.common import TransactionCase, tagged


@tagged("post_install", "-at_install", "training_management_analytics")
class TestTrainingAnalytics(TransactionCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.analytics = cls.env["training.analytics"]
        cls.admin = cls.env.ref("base.user_admin")

        cls.program = cls.env["training.program"].create(
            {
                "name": "Analytics Program",
                "start_date": "2026-01-01",
                "end_date": "2026-12-31",
            }
        )
        cls.course_a = cls.env["training.course"].create(
            {
                "program_id": cls.program.id,
                "name": "Course A",
                "start_date": "2026-01-01",
                "end_date": "2026-06-30",
            }
        )
        cls.course_b = cls.env["training.course"].create(
            {
                "program_id": cls.program.id,
                "name": "Course B",
                "start_date": "2026-07-01",
                "end_date": "2026-12-31",
            }
        )

        # Survey with 5 rating options (approved descriptive scale) plus
        # one non-rating option, on two KPI-relevant questions and one
        # non-KPI question.
        cls.survey = cls.env["survey.survey"].create(
            {"title": "Analytics Trainee Survey", "survey_role": "trainee"}
        )
        cls.q_trainer = cls.env["survey.question"].create(
            {
                "survey_id": cls.survey.id,
                "title": "Trainer performance",
                "question_type": "simple_choice",
                "kpi_category": "trainer_performance",
            }
        )
        cls.q_content = cls.env["survey.question"].create(
            {
                "survey_id": cls.survey.id,
                "title": "Content quality",
                "question_type": "simple_choice",
                "kpi_category": "content",
            }
        )
        cls.q_comment = cls.env["survey.question"].create(
            {
                "survey_id": cls.survey.id,
                "title": "Free comment",
                "question_type": "char_box",
            }
        )

        def make_scale(question):
            labels = [
                ("Poor / ضعيف", 1),
                ("Acceptable / مقبول", 2),
                ("Good / جيد", 3),
                ("Very Good / جيد جداً", 4),
                ("Excellent / ممتاز", 5),
            ]
            options = cls.env["survey.question.answer"]
            for label, value in labels:
                options |= cls.env["survey.question.answer"].create(
                    {
                        "question_id": question.id,
                        "value": label,
                        "rating_value": value,
                    }
                )
            # A non-rating suggested option (e.g. "Not applicable"),
            # deliberately left without a rating_value.
            options |= cls.env["survey.question.answer"].create(
                {"question_id": question.id, "value": "N/A"}
            )
            return options

        cls.trainer_options = make_scale(cls.q_trainer)
        cls.content_options = make_scale(cls.q_content)

        def option_for(options, value):
            return options.filtered(lambda o: o.rating_value == value)[:1]

        cls.trainer_options_by_value = {
            v: option_for(cls.trainer_options, v) for v in range(1, 6)
        }
        cls.content_options_by_value = {
            v: option_for(cls.content_options, v) for v in range(1, 6)
        }
        cls.trainer_na_option = cls.trainer_options.filtered(
            lambda o: not o.rating_value
        )

    def _make_day(self, course, **overrides):
        now = fields.Datetime.now()
        values = {
            "course_id": course.id,
            "date": fields.Date.today(),
            "start_datetime": now - timedelta(hours=2),
            "end_datetime": now + timedelta(hours=2),
            "supervisor_id": self.admin.id,
            "trainer_ids": [(6, 0, [self.admin.id])],
            "survey_open_at": now - timedelta(hours=1),
            "survey_close_at": now + timedelta(hours=1),
        }
        values.update(overrides)
        return self.env["training.day"].create(values)

    def _make_response(
        self, day, partner, answers, role="trainee", state="done", finalize=True
    ):
        """answers: dict question -> suggested_answer_id recordset (or
        None to leave unanswered/absent from the response), plus an
        optional 'skipped' set of questions to mark skipped."""
        enrollment = self.env["training.enrollment"].search(
            [("program_id", "=", day.course_id.program_id.id), ("partner_id", "=", partner.id)],
            limit=1,
        ) or self.env["training.enrollment"].create(
            {"program_id": day.course_id.program_id.id, "partner_id": partner.id}
        )
        if not self.env["training.attendance"].search_count(
            [("training_day_id", "=", day.id), ("enrollment_id", "=", enrollment.id)]
        ):
            self.env["training.attendance"].create(
                {
                    "training_day_id": day.id,
                    "enrollment_id": enrollment.id,
                    "status": "present",
                }
            )
        user_input = self.env["survey.user_input"].create(
            {
                "survey_id": self.survey.id,
                "training_day_id": day.id,
                "respondent_role": role,
                "partner_id": partner.id,
                "state": "in_progress",
            }
        )
        for question, option in answers.items():
            if option is None:
                continue
            self.env["survey.user_input.line"].create(
                {
                    "user_input_id": user_input.id,
                    "question_id": question.id,
                    "answer_type": "suggestion",
                    "suggested_answer_id": option.id,
                    "skipped": False,
                }
            )
        if finalize:
            user_input.write({"state": state})
        return user_input

    def _make_partner(self, name):
        return self.env["res.partner"].create({"name": name})

    # ---- descriptive rating mapping ----

    def test_rating_mapping_independent_of_label_text(self):
        option = self.trainer_options_by_value[4]
        original_label = option.value
        option.value = "some completely different text"
        self.assertEqual(option.rating_value, 4)
        option.value = original_label  # restore for other assertions

    # ---- response-level category score ----

    def test_response_category_score_single_answer(self):
        partner = self._make_partner("Trainee One")
        day = self._make_day(self.course_a)
        response = self._make_response(
            day, partner, {self.q_trainer: self.trainer_options_by_value[4]}
        )
        self.assertEqual(
            self.analytics.get_response_category_score(response, "trainer_performance"),
            4.0,
        )

    def test_response_category_score_averages_multiple_questions(self):
        partner = self._make_partner("Trainee Two")
        day = self._make_day(self.course_a)
        # Add a second trainer_performance question to average over.
        q_trainer_2 = self.env["survey.question"].create(
            {
                "survey_id": self.survey.id,
                "title": "Trainer punctuality",
                "question_type": "simple_choice",
                "kpi_category": "trainer_performance",
            }
        )
        options_2 = {}
        for opt in self.trainer_options:
            copy_opt = opt.copy({"question_id": q_trainer_2.id})
            options_2[opt.rating_value] = copy_opt
        response = self._make_response(
            day,
            partner,
            {self.q_trainer: self.trainer_options_by_value[2]},
            finalize=False,
        )
        self.env["survey.user_input.line"].create(
            {
                "user_input_id": response.id,
                "question_id": q_trainer_2.id,
                "answer_type": "suggestion",
                "suggested_answer_id": options_2[4].id,
            }
        )
        response.write({"state": "done"})
        # (2 + 4) / 2 = 3.0
        self.assertEqual(
            self.analytics.get_response_category_score(response, "trainer_performance"),
            3.0,
        )

    # ---- missing/skipped answers excluded ----

    def test_non_kpi_question_does_not_participate(self):
        partner = self._make_partner("Trainee Three")
        day = self._make_day(self.course_a)
        response = self._make_response(
            day,
            partner,
            {self.q_trainer: self.trainer_options_by_value[5]},
            finalize=False,
        )
        self.env["survey.user_input.line"].create(
            {
                "user_input_id": response.id,
                "question_id": self.q_comment.id,
                "answer_type": "char_box",
                "value_char_box": "great session",
            }
        )
        response.write({"state": "done"})
        # Free-text comment must not affect trainer_performance score.
        self.assertEqual(
            self.analytics.get_response_category_score(response, "trainer_performance"),
            5.0,
        )
        self.assertIsNone(
            self.analytics.get_response_category_score(response, "content")
        )

    def test_skipped_answer_excluded(self):
        partner = self._make_partner("Trainee Four")
        day = self._make_day(self.course_a)
        user_input = self._make_response(day, partner, {}, state="in_progress")
        self.env["survey.user_input.line"].create(
            {
                "user_input_id": user_input.id,
                "question_id": self.q_trainer.id,
                "skipped": True,
            }
        )
        user_input.write({"state": "done"})
        self.assertIsNone(
            self.analytics.get_response_category_score(user_input, "trainer_performance")
        )

    def test_answer_without_rating_value_excluded(self):
        partner = self._make_partner("Trainee Five")
        day = self._make_day(self.course_a)
        response = self._make_response(
            day, partner, {self.q_trainer: self.trainer_na_option}
        )
        self.assertIsNone(
            self.analytics.get_response_category_score(response, "trainer_performance")
        )

    # ---- no-data returns None ----

    def test_no_data_returns_none_not_zero(self):
        day = self._make_day(self.course_a)
        result = self.analytics.get_kpi(day=day)
        self.assertIsNone(result["trainer_performance"])
        self.assertIsNone(result["content"])
        self.assertIsNone(result["environment"])

    # ---- course/program KPI weighting; proof against average-of-averages ----

    def test_course_kpi_equal_weight_per_response_not_average_of_days(self):
        day_1 = self._make_day(self.course_a)
        day_2 = self._make_day(self.course_a)
        self._make_response(
            day_1, self._make_partner("P1"), {self.q_trainer: self.trainer_options_by_value[5]}
        )
        self._make_response(
            day_2, self._make_partner("P2"), {self.q_trainer: self.trainer_options_by_value[1]}
        )
        self._make_response(
            day_2, self._make_partner("P3"), {self.q_trainer: self.trainer_options_by_value[1]}
        )
        self._make_response(
            day_2, self._make_partner("P4"), {self.q_trainer: self.trainer_options_by_value[1]}
        )
        # Average-of-day-averages would be (5 + 1) / 2 = 3.0.
        # Equal weight per response (required) is (5+1+1+1)/4 = 2.0.
        result = self.analytics.get_kpi(course=self.course_a)
        self.assertEqual(result["trainer_performance"], 2.0)
        self.assertNotEqual(result["trainer_performance"], 3.0)

    def test_program_kpi_pools_all_courses_equal_weight(self):
        day_a = self._make_day(self.course_a)
        day_b = self._make_day(self.course_b)
        self._make_response(
            day_a, self._make_partner("P5"), {self.q_trainer: self.trainer_options_by_value[3]}
        )
        self._make_response(
            day_b, self._make_partner("P6"), {self.q_trainer: self.trainer_options_by_value[5]}
        )
        # Course A avg = 3.0, Course B avg = 5.0. Average-of-course-
        # averages would be 4.0. Pooled equal weight is (3+5)/2 = 4.0
        # here by coincidence with 1 response/course, so add a second
        # response to course B to make the two diverge.
        self._make_response(
            day_b, self._make_partner("P7"), {self.q_trainer: self.trainer_options_by_value[5]}
        )
        # Course A avg = 3.0 (1 response), Course B avg = 5.0 (2
        # responses). Average-of-course-averages = (3+5)/2 = 4.0.
        # Pooled equal weight per response = (3+5+5)/3 = 4.333...
        result = self.analytics.get_kpi(program=self.program)
        self.assertAlmostEqual(result["trainer_performance"], 13 / 3)
        self.assertNotEqual(result["trainer_performance"], 4.0)

    # ---- attendance metrics ----

    def test_attendance_rates(self):
        day = self._make_day(self.course_a)
        program = self.program
        partners = [self._make_partner("A%s" % i) for i in range(5)]
        enrollments = [
            self.env["training.enrollment"].create(
                {"program_id": program.id, "partner_id": p.id}
            )
            for p in partners
        ]
        statuses = ["present", "present", "late", "absent", "absent"]
        for enrollment, status in zip(enrollments, statuses):
            self.env["training.attendance"].create(
                {
                    "training_day_id": day.id,
                    "enrollment_id": enrollment.id,
                    "status": status,
                }
            )
        metrics = self.analytics.get_attendance_metrics(day=day)
        self.assertEqual(metrics["present_count"], 2)
        self.assertEqual(metrics["late_count"], 1)
        self.assertEqual(metrics["absent_count"], 2)
        self.assertEqual(metrics["total_count"], 5)
        self.assertAlmostEqual(metrics["attendance_rate"], 60.0)  # (2+1)/5*100
        self.assertAlmostEqual(metrics["absence_rate"], 40.0)  # 2/5*100
        self.assertAlmostEqual(metrics["late_rate"], 100 / 3)  # 1/(2+1)*100

    def test_attendance_metrics_unavailable_when_no_records(self):
        day = self._make_day(self.course_a)
        metrics = self.analytics.get_attendance_metrics(day=day)
        self.assertEqual(metrics["total_count"], 0)
        self.assertIsNone(metrics["attendance_rate"])
        self.assertIsNone(metrics["absence_rate"])
        self.assertIsNone(metrics["late_rate"])

    # ---- trainee response rate ----

    def test_trainee_response_rate_excludes_absent(self):
        day = self._make_day(self.course_a)
        present_partner = self._make_partner("Present One")
        late_partner = self._make_partner("Late One")
        absent_partner = self._make_partner("Absent One")
        for partner, status in (
            (present_partner, "present"),
            (late_partner, "late"),
            (absent_partner, "absent"),
        ):
            enrollment = self.env["training.enrollment"].create(
                {"program_id": self.program.id, "partner_id": partner.id}
            )
            self.env["training.attendance"].create(
                {
                    "training_day_id": day.id,
                    "enrollment_id": enrollment.id,
                    "status": status,
                }
            )
        # Only the present trainee submits.
        self._make_response(
            day, present_partner, {self.q_trainer: self.trainer_options_by_value[3]}
        )
        rate = self.analytics.get_trainee_response_rate(day=day)
        # 1 submitted / (1 present + 1 late) * 100 = 50.0; absent excluded.
        self.assertAlmostEqual(rate, 50.0)

    def test_trainee_response_rate_pending_when_no_attendance(self):
        day = self._make_day(self.course_a)
        rate = self.analytics.get_trainee_response_rate(day=day)
        self.assertIsNone(rate)

    # ---- historical version safety ----

    def test_historical_response_uses_version_linked_at_submission(self):
        day = self._make_day(self.course_a)
        day.write({"trainee_survey_id": self.survey.id})
        partner = self._make_partner("Historical Trainee")
        response = self._make_response(
            day, partner, {self.q_content: self.content_options_by_value[4]}
        )
        self.assertEqual(
            self.analytics.get_response_category_score(response, "content"), 4.0
        )

        # Clone to a new version and change the CLONED question's
        # kpi_category -- must not affect the historical response, which
        # is still linked to the original (v1) question.
        action = self.survey.action_clone_as_new_version()
        v2 = self.env["survey.survey"].browse(action["res_id"])
        v2_content_question = v2.question_ids.filtered(
            lambda q: q.title == self.q_content.title
        )
        v2_content_question.kpi_category = "environment"

        # Even after reassigning the day to the new version (as would
        # happen for FUTURE use), the historical response's score must
        # be unaffected.
        day.write({"trainee_survey_id": v2.id})
        self.assertEqual(
            self.analytics.get_response_category_score(response, "content"), 4.0
        )
        self.assertEqual(
            self.analytics.get_kpi(day=day)["content"], 4.0
        )

    # ---- analytics permission/privacy boundary (reporting model) ----

    def test_kpi_reporting_model_denied_to_trainee(self):
        trainee_user = (
            self.env["res.users"]
            .with_context(no_reset_password=True)
            .create(
                {
                    "name": "Analytics Trainee User",
                    "login": "analytics_trainee",
                    "email": "analytics_trainee@example.com",
                    "group_ids": [
                        (4, self.env.ref("base.group_user").id),
                        (4, self.env.ref("training_management.group_training_trainee").id),
                    ],
                }
            )
        )
        with self.assertRaises(AccessError):
            self.env["training.survey.response.kpi"].with_user(trainee_user).search([])

    def test_kpi_reporting_model_readable_by_admin(self):
        day = self._make_day(self.course_a)
        day.write({"trainee_survey_id": self.survey.id})
        partner = self._make_partner("Reporting Trainee")
        self._make_response(
            day, partner, {self.q_trainer: self.trainer_options_by_value[5]}
        )
        rows = self.env["training.survey.response.kpi"].search(
            [("training_day_id", "=", day.id), ("kpi_category", "=", "trainer_performance")]
        )
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows.score, 5.0)
