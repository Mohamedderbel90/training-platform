from datetime import timedelta

from odoo import fields
from odoo.tests.common import TransactionCase, tagged

from .fixtures import day_supervisor, day_trainer


@tagged("post_install", "-at_install", "training_management_smart_buttons")
class TestSmartButtons(TransactionCase):
    """Smart buttons open only records of the current program/course/day,
    show matching counts, and respect the user's access."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        env = cls.env
        mk = env["res.users"].with_context(no_reset_password=True).create
        cls.gs = mk({
            "name": "SB GS", "login": "sb_gs", "email": "sb_gs@example.com",
            "group_ids": [(4, env.ref("base.group_user").id),
                          (4, env.ref("training_management.group_training_admin").id)],
        })
        cls.trainee = mk({
            "name": "SB Trainee", "login": "sb_trainee", "email": "sb_trainee@example.com",
            "group_ids": [(4, env.ref("base.group_user").id),
                          (4, env.ref("training_management.group_training_trainee").id)],
        })
        cls.supervisor = day_supervisor(env)
        cls.trainer = day_trainer(env)
        cls.survey = env["survey.survey"].create(
            {"title": "SB Trainee Survey", "survey_role": "trainee"})
        cls.sup_survey = env["survey.survey"].create(
            {"title": "SB Supervisor Survey", "survey_role": "supervisor"})
        cls.trn_survey = env["survey.survey"].create(
            {"title": "SB Trainer Survey", "survey_role": "trainer"})
        now = fields.Datetime.now()

        def build(label):
            program = env["training.program"].create(
                {"name": "SB Program " + label, "start_date": "2000-01-01",
                 "end_date": "2099-12-31"})
            course = env["training.course"].create(
                {"program_id": program.id, "name": "SB Course " + label,
                 "start_date": "2000-01-01", "end_date": "2099-12-31"})
            day = env["training.day"].create({
                "course_id": course.id, "date": fields.Date.today(),
                "start_datetime": now - timedelta(hours=2),
                "end_datetime": now + timedelta(hours=2), "state": "open",
                "supervisor_id": cls.supervisor.id,
                "trainer_ids": [(6, 0, [cls.trainer.id])],
                "survey_open_at": now - timedelta(hours=1),
                "survey_close_at": now + timedelta(hours=1),
                "trainee_survey_id": cls.survey.id,
                "supervisor_survey_id": cls.sup_survey.id,
                "trainer_survey_id": cls.trn_survey.id,
            })
            return program, course, day

        cls.program, cls.course, cls.day = build("A")
        cls.other_program, cls.other_course, cls.other_day = build("B")
        cls.course2 = env["training.course"].create(
            {"program_id": cls.program.id, "name": "SB Course A2",
             "start_date": "2000-01-01", "end_date": "2099-12-31"})
        cls.enrollment = env["training.enrollment"].create(
            {"program_id": cls.program.id, "partner_id": cls.trainee.partner_id.id})
        env["training.enrollment"].create(
            {"program_id": cls.other_program.id, "partner_id": cls.trainee.partner_id.id})
        for day in (cls.day, cls.other_day):
            env["training.attendance"].create(
                {"training_day_id": day.id, "enrollment_id": (
                    cls.enrollment if day == cls.day else
                    env["training.enrollment"].search(
                        [("program_id", "=", cls.other_program.id)])).id,
                 "status": "present"})
        for day in (cls.day, cls.other_day):
            for role, user in (("trainee", cls.trainee), ("supervisor", cls.supervisor),
                               ("trainer", cls.trainer)):
                day.get_or_create_survey_response(role, user=user).write({"state": "done"})
        env["training.report"].create(
            {"report_type": "course", "program_id": cls.program.id,
             "course_id": cls.course.id})

    def test_program_counts_and_actions_are_scoped(self):
        program = self.program.with_user(self.gs)
        self.assertEqual(
            (program.course_count, program.day_count, program.enrollment_count,
             program.attendance_count, program.response_count), (2, 1, 1, 1, 3))
        for method, model in (
            ("action_open_courses", "training.course"),
            ("action_open_days", "training.day"),
            ("action_open_enrollments", "training.enrollment"),
            ("action_open_attendance", "training.attendance"),
            ("action_open_responses", "survey.user_input"),
        ):
            action = getattr(program, method)()
            records = self.env[action["res_model"]].with_user(self.gs).search(action["domain"])
            self.assertEqual(action["res_model"], model)
            self.assertEqual(len(records), getattr(program, {
                "action_open_courses": "course_count", "action_open_days": "day_count",
                "action_open_enrollments": "enrollment_count",
                "action_open_attendance": "attendance_count",
                "action_open_responses": "response_count"}[method]))
            for rec in records:
                self.assertEqual(
                    (rec.program_id if "program_id" in rec._fields else rec.course_id.program_id),
                    self.program, method)

    def test_course_counts_and_actions_are_scoped(self):
        course = self.course.with_user(self.gs)
        self.assertEqual(
            (course.day_count, course.attendance_count, course.response_count,
             course.report_count), (1, 1, 3, 1))
        self.assertEqual(self.course2.with_user(self.gs).day_count, 0)
        for method in ("action_open_days", "action_open_attendance",
                       "action_open_responses", "action_open_reports"):
            action = getattr(course, method)()
            for rec in self.env[action["res_model"]].with_user(self.gs).search(action["domain"]):
                self.assertEqual(rec.course_id, self.course, method)

    def test_day_counts_and_actions_are_scoped(self):
        day = self.day.with_user(self.gs)
        self.assertEqual(
            (day.attendance_count, day.trainee_response_count,
             day.supervisor_response_count, day.trainer_response_count), (1, 1, 1, 1))
        for method, role in (("action_open_trainee_responses", "trainee"),
                             ("action_open_supervisor_response", "supervisor"),
                             ("action_open_trainer_responses", "trainer")):
            action = getattr(day, method)()
            self.assertFalse(action["context"].get("create", True))
            records = self.env["survey.user_input"].with_user(self.gs).search(action["domain"])
            self.assertEqual(records.mapped("respondent_role"), [role])
            self.assertEqual(records.training_day_id, self.day)
        attendance = day.action_open_attendance()
        self.assertEqual(
            self.env["training.attendance"].with_user(self.gs).search_count(
                attendance["domain"]), 1)
