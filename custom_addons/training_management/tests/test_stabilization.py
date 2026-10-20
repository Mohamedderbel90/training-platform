"""Final stabilization: program state transitions."""
from odoo.exceptions import UserError
from odoo.tests.common import tagged

from .test_requirements_alignment import AlignmentCase


@tagged("post_install", "-at_install", "training_management_security")
class TestProgramStates(AlignmentCase):
    def test_program_state_transitions(self):
        program = self.env["training.program"].create(
            {"name": "States", "start_date": "2026-01-01", "end_date": "2026-12-31"}
        )
        with self.assertRaises(UserError):
            program.state = "completed"  # draft -> completed not allowed
        program.state = "active"
        program.state = "completed"
        for target in ("draft", "active", "cancelled"):
            with self.assertRaises(UserError):
                program.state = target
        cancelled = self.env["training.program"].create(
            {"name": "States2", "start_date": "2026-01-01", "end_date": "2026-12-31"}
        )
        cancelled.state = "cancelled"
        with self.assertRaises(UserError):
            cancelled.state = "active"
