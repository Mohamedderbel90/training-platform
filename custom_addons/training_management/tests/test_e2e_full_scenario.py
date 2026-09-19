from odoo.tests.common import tagged

from .common import OperationalApiCase


@tagged("post_install", "-at_install", "training_management_e2e")
class TestE2EFullScenario(OperationalApiCase):
    """DEVELOPMENT_PLAN M10 exit criterion: "Run full scenario: Admin
    setup -> trainee survey -> supervisor attendance/evaluation ->
    trainer report -> analytics -> report approval -> download."

    Reuses OperationalApiCase's fixture (program/course/day/enrollment/
    surveys already wired up by "admin setup") and drives every
    operational step through the real /api/v1 HTTP controllers exactly
    as the Next.js frontend would, then verifies the Back-office-only
    tail of the scenario (analytics, report generate/approve/download)
    directly against the model layer, since no HTTP endpoint exists or
    should exist for those steps (PROJECT_SPEC section 2.1/2.2).
    """

    def test_full_scenario_admin_to_report_download(self):
        # ---- trainee survey ----
        self.authenticate("opapi_trainee", "Test1234!")
        resp = self.api_post(
            "/training-days/%d/my-survey/submit" % self.day.id,
            {
                "answers": [
                    {
                        "question_id": self.trainee_question.id,
                        "answer_option_id": self.trainee_options[5].id,
                    }
                ]
            },
        )
        self.assertEqual(resp.status_code, 200, resp.json())
        self.assertEqual(resp.json()["data"]["state"], "submitted")

        # ---- supervisor: attendance + evaluation ----
        self.authenticate("opapi_supervisor", "Test1234!")
        resp = self.api_put(
            "/training-days/%d/attendance" % self.day.id,
            {"items": [{"trainee_id": self.enrollment.id, "status": "present"}]},
        )
        self.assertEqual(resp.status_code, 200, resp.json())

        resp = self.api_post(
            "/training-days/%d/supervisor-survey/submit" % self.day.id,
            {
                "answers": [
                    {"question_id": self.supervisor_question.id, "text": "All good"}
                ]
            },
        )
        self.assertEqual(resp.status_code, 200, resp.json())
        self.assertEqual(resp.json()["data"]["state"], "submitted")

        # ---- trainer: draft then final report ----
        self.authenticate("opapi_trainer", "Test1234!")
        resp = self.api_put(
            "/training-days/%d/trainer-report/draft" % self.day.id,
            {
                "answers": [
                    {"question_id": self.trainer_question.id, "text": "Draft notes"}
                ]
            },
        )
        self.assertEqual(resp.status_code, 200, resp.json())
        self.assertTrue(resp.json()["data"]["editable"])

        resp = self.api_post(
            "/training-days/%d/trainer-report/submit" % self.day.id, {}
        )
        self.assertEqual(resp.status_code, 200, resp.json())
        self.assertEqual(resp.json()["data"]["state"], "submitted")

        # ---- analytics (Back-office / model layer, no HTTP endpoint) ----
        analytics = self.env["training.analytics"]
        kpi = analytics.get_kpi(course=self.course)
        self.assertEqual(kpi["trainer_performance"], 5.0)
        attendance = analytics.get_attendance_metrics(course=self.course)
        self.assertEqual(attendance["attendance_rate"], 100.0)
        response_rate = analytics.get_trainee_response_rate(course=self.course)
        self.assertEqual(response_rate, 100.0)

        # ---- report generation, approval and download ----
        admin_group_user = (
            self.env["res.users"]
            .with_context(no_reset_password=True)
            .create(
                {
                    "name": "e2e_report_admin",
                    "login": "e2e_report_admin",
                    "email": "e2e_report_admin@example.com",
                    "group_ids": [
                        (4, self.env.ref("base.group_user").id),
                        (
                            4,
                            self.env.ref(
                                "training_management.group_training_admin"
                            ).id,
                        ),
                    ],
                }
            )
        )
        report = self.env["training.report"].create(
            {
                "report_type": "course",
                "program_id": self.program.id,
                "course_id": self.course.id,
            }
        )
        report.action_generate()
        self.assertEqual(report.state, "generated")
        self.assertEqual(report.kpi_trainer_score, 5.0)

        report.with_user(admin_group_user).action_approve()
        self.assertEqual(report.state, "approved")
        self.assertEqual(report.approved_by, admin_group_user)

        # "Download" -- the attachment's content is real, non-empty
        # binary data, readable by the approving admin (the same access
        # PROJECT_SPEC's "General Supervisor ... downloads a stable
        # report entirely from Odoo" exit criterion describes; the
        # actual browser download route is standard Odoo
        # /web/content/<id>, not a project-specific endpoint).
        self.assertTrue(report.pdf_attachment_id)
        content = report.pdf_attachment_id.with_user(admin_group_user).datas
        self.assertTrue(content)
