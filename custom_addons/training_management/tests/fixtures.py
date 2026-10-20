"""Day-assignment fixtures: M1 requires a training day's supervisor and
trainers to be active users holding the matching operational role."""


def _get(env, login, group_xmlid):
    user = env["res.users"].search([("login", "=", login)], limit=1)
    if not user:
        user = (
            env["res.users"]
            .with_context(no_reset_password=True)
            .create(
                {
                    "name": login,
                    "login": login,
                    "email": "%s@example.com" % login,
                    "group_ids": [
                        (4, env.ref("base.group_user").id),
                        (4, env.ref(group_xmlid).id),
                    ],
                }
            )
        )
    return user


def day_supervisor(env):
    return _get(env, "fx_day_supervisor", "training_management.group_training_supervisor")


def day_trainer(env):
    return _get(env, "fx_day_trainer", "training_management.group_training_trainer")
