from odoo import models


class TrainingSmartButtons(models.AbstractModel):
    """Helpers for the navigation smart buttons on the Program, Course and
    Training Day forms. Counts and actions are evaluated as the current
    user, so access rights and record rules apply; a user without read
    access to the target model sees a count of 0 (the buttons themselves
    are also hidden by group in the views)."""

    _name = "training.smart.buttons"
    _description = "Smart button helpers"

    def _smart_count(self, model, domain):
        target = self.env[model]
        if not target.has_access("read"):
            return 0
        return target.search_count(domain)

    def _smart_action(self, name, model, domain, view_mode="list,form",
                      context=None):
        self.ensure_one()
        return {
            "type": "ir.actions.act_window",
            "name": name,
            "res_model": model,
            "view_mode": view_mode,
            "domain": domain,
            "context": dict(context or {}),
        }

    def _responses_domain(self, scope, role=None):
        """Submitted (final) survey responses within ``scope``."""
        domain = [("state", "=", "done"), (scope, "=", self.id)]
        if role:
            domain.append(("respondent_role", "=", role))
        return domain
