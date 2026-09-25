from odoo import api, models

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


def _project_groups(env):
    return env["res.groups"].browse(
        [env.ref(xmlid).id for xmlid in ROLE_GROUPS.values()]
    )


def _log_role_change(env, user, added, removed):
    """One audit entry per user whose project role set changed
    (PROJECT_SPEC section 17: "permission/role changes"). Scoped to this
    project's own five groups only -- not every res.groups membership
    change on the system (M10: docs/adr/ADR-010)."""
    if not (added or removed):
        return
    env["training.audit.log"]._log(
        "permission_change",
        env._(
            "%(user)s's training roles were changed by "
            "%(actor)s: added %(added)s, removed %(removed)s."
        )
        % {
            "user": user.name,
            "actor": env.user.name,
            "added": ", ".join(added.mapped("name")) or "-",
            "removed": ", ".join(removed.mapped("name")) or "-",
        },
        record=user,
    )


class ResUsers(models.Model):
    _inherit = "res.users"

    @api.model_create_multi
    def create(self, vals_list):
        users = super().create(vals_list)
        # A user created already holding a project role is a role
        # grant too; audit it (no "before" state, everything is added).
        project_groups = _project_groups(self.env)
        for user in users:
            _log_role_change(
                self.env, user, user.group_ids & project_groups, project_groups.browse()
            )
        return users

    def write(self, vals):
        project_groups = None
        before_by_user = {}
        if "group_ids" in vals:
            project_groups = _project_groups(self.env)
            before_by_user = {
                user.id: user.group_ids & project_groups for user in self
            }
        result = super().write(vals)
        if project_groups is not None:
            for user in self:
                after = user.group_ids & project_groups
                before = before_by_user[user.id]
                _log_role_change(self.env, user, after - before, before - after)
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
            # IANA zone for display (PROJECT_SPEC section 10: datetimes
            # are stored/sent in UTC, shown in the user's timezone).
            # None when unset; the client then falls back to the
            # browser's own zone, as Odoo's web client does.
            "tz": self.tz or None,
            "roles": roles,
            "capabilities": self._get_operational_capabilities(roles),
        }


class ResGroups(models.Model):
    _inherit = "res.groups"

    def write(self, vals):
        # Assigning users from the group form (or `user_ids` over RPC)
        # writes res.groups, not res.users, so ResUsers.write() above
        # never sees it. Same audit event, same project-only scope.
        tracked = "user_ids" in vals
        before = {}
        if tracked:
            project_groups = _project_groups(self.env)
            before = {
                group.id: group.user_ids
                for group in self & project_groups
            }
        result = super().write(vals)
        for group in self.browse(list(before)):
            after = group.user_ids
            for user in after - before[group.id]:
                _log_role_change(self.env, user, group, group.browse())
            for user in before[group.id] - after:
                _log_role_change(self.env, user, group.browse(), group)
        return result
