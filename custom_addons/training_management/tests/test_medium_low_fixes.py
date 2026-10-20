"""Medium/Low fixes of the Business-vs-Odoo audit: D3 response-rate target,
D4 (history kept, DEC-18), D6 attendance deletion, D7 no default status,
Print button vs C4, anonymise wizard, P9 date warnings, E1."""
from odoo.exceptions import AccessError, UserError, ValidationError
from odoo.tests.common import tagged

from .test_requirements_alignment import AlignmentCase


@tagged("post_install", "-at_install", "training_management_analytics",
        "training_management_security")
class TestMediumLowFixes(AlignmentCase):
    # ---- D3 / D4 ----------------------------------------------------------

    def test_response_rate_never_exceeds_100_and_counts_targets_only(self):
        # 4 present, 1 absent; all 5 submitted (the absent one too).
        program, _c, day = self.build_program(
            "D3", 4, ["present", "present", "present", "present", "absent"], 5
        )
        rate = self.analytics.get_trainee_response_rate(program=program)
        self.assertEqual(rate, 100.0)

    def test_response_rate_ignores_responses_of_non_targets(self):
        program, _c, day = self.build_program("D3b", 4, ["present", "absent"], 2)
        # one target (present), one response from her only -> 100, not 200
        self.assertEqual(self.analytics.get_trainee_response_rate(program=program), 100.0)

    def test_attendance_history_is_kept_when_enrollment_becomes_inactive(self):
        """DEC-18 (clarified 2026-10-04): already-recorded attendance counts
        in rates whatever the enrollment is now."""
        program, _c, _d = self.build_program("D4", 4, ["present", "absent"], 0)
        before = self.analytics.get_attendance_metrics(program=program)
        self.env["training.enrollment"].search(
            [("program_id", "=", program.id)]
        ).write({"state": "completed"})
        after = self.analytics.get_attendance_metrics(program=program)
        self.assertEqual(before, after)
        self.assertEqual(after["total_count"], 2)

    # ---- D6 / D7 ------------------------------------------------------------

    def _attendance(self, day_state):
        program, _c, day = self.build_program(
            "D6%s" % day_state, 4, ["present"], 0, day_state=day_state
        )
        return self.env["training.attendance"].search([("training_day_id", "=", day.id)])

    def test_attendance_of_a_closed_day_cannot_be_deleted(self):
        for state in ("closed", "postponed", "cancelled"):
            attendance = self._attendance(state)
            with self.assertRaises(UserError):
                attendance.with_user(self.gs_user).unlink()
            self.assertTrue(attendance.exists())

    def test_attendance_of_an_open_day_can_be_corrected_by_deletion(self):
        attendance = self._attendance("open")
        attendance.with_user(self.gs_user).unlink()
        self.assertFalse(attendance.exists())

    def test_attendance_has_no_default_status(self):
        self.assertFalse(
            self.env["training.attendance"].default_get(["status"]).get("status")
        )

    # ---- Print button (C4) ------------------------------------------------------

    def test_print_is_refused_for_training_responses_only(self):
        _p, _c, day = self.build_program("Print", 4, ["present"], 1)
        response = self.env["survey.user_input"].search(
            [("training_day_id", "=", day.id)], limit=1
        )
        with self.assertRaises(UserError):
            response.action_print_answers()

    # ---- anonymise wizard ---------------------------------------------------------

    def test_anonymise_wizard_from_partner_and_enrollment(self):
        program, _c, _d = self.build_program("Anon", 4, ["present"], 0)
        user = self.make_user("anon_wiz", "training_management.group_training_trainee")
        enrollment = self.env["training.enrollment"].create(
            {"program_id": program.id, "partner_id": user.partner_id.id}
        )
        Wizard = self.env["training.anonymise.wizard"]
        wiz = Wizard.with_user(self.gs_user).with_context(
            active_model="training.enrollment", active_id=enrollment.id
        ).create({"reason": "PDPL request 1"})
        self.assertEqual(wiz.partner_id, user.partner_id)
        wiz.action_anonymise()
        self.assertFalse(user.active)
        self.assertEqual(enrollment.state, "inactive")
        with self.assertRaises(AccessError):
            Wizard.with_user(self.supervisor_user).create({"reason": "x"})
        other = self.make_user("anon_wiz2", "training_management.group_training_trainee")
        self.env["training.enrollment"].create(
            {"program_id": program.id, "partner_id": other.partner_id.id}
        )
        wiz2 = Wizard.with_user(self.gs_user).with_context(
            active_model="res.partner", active_id=other.partner_id.id
        ).create({"reason": " "})
        with self.assertRaises(UserError):
            wiz2.action_anonymise()

    # ---- P9 ------------------------------------------------------------------------

    def test_course_date_outside_program_only_warns(self):
        program = self.env["training.program"].create(
            {"name": "P9", "start_date": "2026-01-01", "end_date": "2026-06-30"}
        )
        course = self.env["training.course"].new(
            {"program_id": program.id, "name": "C", "start_date": "2026-05-01",
             "end_date": "2026-09-01"}
        )
        self.assertTrue(course.dates_outside_program)  # the form's warning banner
        inside = self.env["training.course"].new(
            {"program_id": program.id, "name": "C2", "start_date": "2026-02-01",
             "end_date": "2026-03-01"}
        )
        self.assertFalse(inside.dates_outside_program)
        saved = self.env["training.course"].create(
            {"program_id": program.id, "name": "C", "start_date": "2026-05-01",
             "end_date": "2026-09-01"}
        )
        self.assertTrue(saved)  # a warning, never a block

    # ---- E1 / D8 ----------------------------------------------------------------

    def test_enrollment_has_no_unused_user_field(self):
        self.assertNotIn("user_id", self.env["training.enrollment"]._fields)

    def test_one_operational_role_per_account(self):
        user = self.make_user("d8", "training_management.group_training_trainee")
        with self.assertRaises(ValidationError):
            user.write({"group_ids": [(4, self.env.ref(
                "training_management.group_training_trainer").id)]})

    # ---- attendance integrity (DEC-07) ---------------------------------------------

    def test_attendance_needs_an_active_enrollment_of_the_days_program(self):
        program, _c, day = self.build_program("AI", 4, ["present"], 0)
        other_program, _c2, _d2 = self.build_program("AI2", 4, ["present"], 0)
        foreign = self.env["training.enrollment"].search(
            [("program_id", "=", other_program.id)], limit=1
        )
        own_partner = self.env["res.partner"].create({"name": "Late joiner"})
        inactive = self.env["training.enrollment"].create(
            {"program_id": program.id, "partner_id": own_partner.id, "state": "inactive"}
        )
        Attendance = self.env["training.attendance"].with_user(self.gs_user)
        with self.assertRaises(ValidationError):
            Attendance.create(
                {"training_day_id": day.id, "enrollment_id": foreign.id, "status": "present"}
            )
        with self.assertRaises(ValidationError):
            Attendance.create(
                {"training_day_id": day.id, "enrollment_id": inactive.id, "status": "present"}
            )
