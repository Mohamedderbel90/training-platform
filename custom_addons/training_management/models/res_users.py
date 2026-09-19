from odoo import _, models

# Odoo groups are the authoritative role source (PROJECT_SPEC section 7,
# M4 point 8). The client never supplies a role; it is always derived
# server-side from group membership.
ROLE_GROUPS = {
    "trainee": "training_management.group_training_trainee",
    "supervisor": "training_management.group_training_supervisor",
    "trainer": "training_management.group_training_trainer",
    "admin": "training_management.group_training_admin",
    "assistant_admin": "training_management.group_training_assistant_admin",
}

# Minimal capability tags the Next.js UI needs for routing/rendering
# decisions. Admin/assistant_admin are intentionally absent: those
# roles work from Odoo Back-office (PROJECT_SPEC section 2.1), not the
# Operational API.
CAPABILITIES_BY_ROLE = {
    "trainee": ["dashboard.trainee", "survey.submit_own"],
    "supervisor": [
        "dashboard.supervisor",
        "attendance.manage_assigned",
        "survey.submit_own",
    ],
    "trainer": ["dashboard.trainer", "trainer_report.manage_own"],
}


class ResUsers(models.Model):
    _inherit = "res.users"

    def write(self, vals):
        project_groups = None
        before_by_user = {}
        if "group_ids" in vals:
            project_groups = self.env["res.groups"].browse(
                [self.env.ref(xmlid).id for xmlid in ROLE_GROUPS.values()]
            )
            before_by_user = {
                user.id: user.group_ids & project_groups for user in self
            }
        result = super().write(vals)
        # PROJECT_SPEC section 17: "permission/role changes" is
        # audit-worthy. Scoped to this project's own five groups only --
        # not every res.groups membership change on the system, which
        # would be far too broad and unrelated to this project's own
        # roles (M10: docs/adr/ADR-010-hardening-and-deployment-readiness.md).
        if project_groups is not None:
            for user in self:
                after = user.group_ids & project_groups
                before = before_by_user[user.id]
                added = after - before
                removed = before - after
                if added or removed:
                    self.env["training.audit.log"]._log(
                        "permission_change",
                        _(
                            "%(user)s's training roles were changed by "
                            "%(actor)s: added %(added)s, removed %(removed)s."
                        )
                        % {
                            "user": user.name,
                            "actor": self.env.user.name,
                            "added": ", ".join(added.mapped("name")) or "-",
                            "removed": ", ".join(removed.mapped("name")) or "-",
                        },
                        record=user,
                    )
        return result

    def _get_operational_roles(self):
        """Operational roles for this user, derived from group
        membership only -- never trusted from client input."""
        self.ensure_one()
        return [
            role for role, xmlid in ROLE_GROUPS.items() if self.has_group(xmlid)
        ]

    def _get_operational_capabilities(self, roles=None):
        self.ensure_one()
        roles = roles if roles is not None else self._get_operational_roles()
        capabilities = set()
        for role in roles:
            capabilities.update(CAPABILITIES_BY_ROLE.get(role, []))
        return sorted(capabilities)

    def _get_operational_profile(self):
        """Minimal UI-context DTO for GET /api/v1/auth/me. Never a raw
        res.users/res.partner read() (M4 point 7/15)."""
        self.ensure_one()
        roles = self._get_operational_roles()
        return {
            "id": self.id,
            "partner_id": self.partner_id.id,
            "name": self.name,
            "locale": self.lang or self.partner_id.lang,
            "roles": roles,
            "capabilities": self._get_operational_capabilities(roles),
        }
