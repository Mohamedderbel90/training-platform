from odoo import fields, models


class ResConfigSettings(models.TransientModel):
    _inherit = "res.config.settings"

    # PROJECT_SPEC section 8: "Configuration: Use res.config.settings
    # extension for global configuration. Program-specific settings
    # belong on training.program, not global settings." These toggles are
    # global deployment/policy decisions (which channels are provisioned
    # at all), not per-program content, so res.config.settings is the
    # correct place for them -- never exposed in Next.js (section 16).
    training_notification_reminders_enabled = fields.Boolean(
        string="Enable Daily Task Reminders",
        config_parameter="training_management.notification_reminders_enabled",
        default=True,
    )
    training_notification_sms_enabled = fields.Boolean(
        string="Enable SMS Reminders",
        config_parameter="training_management.notification_sms_enabled",
    )
    training_notification_whatsapp_enabled = fields.Boolean(
        string="Enable WhatsApp Reminders",
        config_parameter="training_management.notification_whatsapp_enabled",
    )
    training_notification_channel_fallback = fields.Boolean(
        string="Fallback to Next Channel on Failure",
        config_parameter="training_management.notification_channel_fallback",
    )
    training_notification_max_retries = fields.Integer(
        string="Maximum Retry Attempts",
        config_parameter="training_management.notification_max_retries",
        default=3,
    )
    training_sms_provider_mode = fields.Selection(
        selection=[
            ("test", "Test / Log Only (no real SMS is sent)"),
            ("odoo_sms", "Odoo SMS (standard IAP-based sms module)"),
        ],
        string="SMS Provider Mode",
        config_parameter="training_management.sms_provider_mode",
        default="test",
    )
    training_whatsapp_provider_mode = fields.Selection(
        selection=[
            ("test", "Test / Log Only (no real WhatsApp message is sent)"),
        ],
        string="WhatsApp Provider Mode",
        config_parameter="training_management.whatsapp_provider_mode",
        default="test",
    )
