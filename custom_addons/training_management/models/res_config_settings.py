from odoo import _, api, fields, models
from odoo.exceptions import AccessError

_PREFIX = "training_management."
_CHANNEL_ORDERS = [
    ("email,sms,whatsapp", "Email, SMS, WhatsApp"),
    ("email,whatsapp,sms", "Email, WhatsApp, SMS"),
    ("sms,email,whatsapp", "SMS, Email, WhatsApp"),
    ("sms,whatsapp,email", "SMS, WhatsApp, Email"),
    ("whatsapp,email,sms", "WhatsApp, Email, SMS"),
    ("whatsapp,sms,email", "WhatsApp, SMS, Email"),
]
# (field, ir.config_parameter key, kind, default) -- stored as explicit
# strings under the keys training.notification.log._get_config() reads, so
# "0" and "False" are real values (Odoo's own config_parameter fields would
# delete the parameter and fall back to the default).
_FIELDS = (
    ("training_reminders_enabled", "notification_reminders_enabled", "bool", "True"),
    ("training_reminder_lead_hours", "notification_reminder_lead_hours", "int", "0"),
    ("training_reminder_count", "notification_reminder_count", "int", "1"),
    ("training_reminder_interval_hours", "notification_reminder_interval_hours", "int", "24"),
    ("training_notification_max_retries", "notification_max_retries", "int", "3"),
    ("training_notification_channel_fallback", "notification_channel_fallback", "bool", "False"),
    ("training_channel_order", "notification_channel_order", "str", "email,sms,whatsapp"),
    ("training_notification_sms_enabled", "notification_sms_enabled", "bool", "False"),
    ("training_sms_provider_mode", "sms_provider_mode", "str", "none"),
    ("training_notification_whatsapp_enabled", "notification_whatsapp_enabled", "bool", "False"),
)


class ResConfigSettings(models.TransientModel):
    """FR-072 / DEC-26: reminder configuration as a native Odoo Settings
    page ("Training Management" app). The General Supervisor can open and
    save it WITHOUT technical-administrator rights: execute() applies only
    these training options for a non-administrator, never any other
    setting."""

    _inherit = "res.config.settings"

    training_reminders_enabled = fields.Boolean(string="Enable Daily Task Reminders")
    training_reminder_lead_hours = fields.Integer(
        string="Remind Within Hours Before Survey Closes"
    )
    training_reminder_count = fields.Integer(string="Reminders per Channel")
    training_reminder_interval_hours = fields.Integer(string="Hours Between Reminders")
    training_notification_max_retries = fields.Integer(string="Maximum Retry Attempts")
    training_notification_channel_fallback = fields.Boolean(
        string="Fallback to Next Channel on Failure"
    )
    training_channel_order = fields.Selection(
        selection=_CHANNEL_ORDERS, string="Channel Order", default="email,sms,whatsapp"
    )
    training_notification_sms_enabled = fields.Boolean(string="Enable SMS Reminders")
    training_sms_provider_mode = fields.Selection(
        selection=[
            ("none", "Not configured (SMS is not sent; attempts are logged as failed)"),
            ("odoo_sms", "Odoo SMS (standard IAP-based sms module)"),
        ],
        string="SMS Provider",
        default="none",
    )
    training_notification_whatsapp_enabled = fields.Boolean(string="Enable WhatsApp Reminders")

    def _compute_display_name(self):
        # Odoo core searches ir.actions.act_window as the current user, which
        # only a technical administrator may read: the General Supervisor
        # then got an "Access Error" when opening the page. Same result,
        # read with sudo.
        action = self.env["ir.actions.act_window"].sudo().search(
            [("res_model", "=", self._name)], limit=1
        )
        self.display_name = action.name or self._name

    # ---------------- storage ----------------

    @api.model
    def _training_read(self):
        get_param = self.env["ir.config_parameter"].sudo().get_param
        valid = {
            "training_channel_order": {o[0] for o in _CHANNEL_ORDERS},
            "training_sms_provider_mode": {"none", "odoo_sms"},
        }
        values = {}
        for name, key, kind, default in _FIELDS:
            raw = get_param(_PREFIX + key, default)
            if kind == "bool":
                values[name] = raw == "True"
            elif kind == "int":
                try:
                    values[name] = max(int(raw), 0)
                except (TypeError, ValueError):
                    values[name] = int(default)
            else:
                values[name] = raw if raw in valid[name] else default
        return values

    def _training_write(self):
        set_param = self.env["ir.config_parameter"].sudo().set_param
        for settings in self:
            for name, key, kind, _default in _FIELDS:
                value = settings[name]
                if kind == "int":
                    value = max(int(value or 0), 0)
                    if name == "training_reminder_count":
                        value = max(value, 1)
                set_param(_PREFIX + key, str(value))

    @api.model
    def get_values(self):
        res = super().get_values()
        res.update(self._training_read())
        return res

    def set_values(self):
        super().set_values()
        self._training_write()

    def execute(self):
        self.ensure_one()
        if self.env.is_admin():
            return super().execute()
        if not self.env.user.has_group("training_management.group_training_admin"):
            raise AccessError(_("Only administrators can change the settings"))
        # General Supervisor without technical rights: only the training
        # options are saved; anything else on the record is ignored.
        self._training_write()
        return {"type": "ir.actions.client", "tag": "reload"}
