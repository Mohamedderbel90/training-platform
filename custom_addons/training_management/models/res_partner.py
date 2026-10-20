from odoo import _, models
from odoo.exceptions import AccessError, UserError


class ResPartner(models.Model):
    _inherit = "res.partner"

    def action_anonymise_trainee(self, reason):
        """DEC-44 (Saudi PDPL): meet a trainee's deletion request by
        anonymising her identity data. General Supervisor only; a
        non-blank reason is mandatory. Attendance rows, responses and
        approved reports are kept (they hold no identity once the
        partner is anonymised, DEC-15, BR-005, D-11); her login is
        disabled and her enrollments are set inactive (DEC-07). The audit
        entry records record ids only, never the original identity."""
        if not self.env.user.has_group("training_management.group_training_admin"):
            raise AccessError(
                _("Only the General Supervisor can anonymise a trainee.")
            )
        reason = (reason or "").strip()
        if not reason:
            raise UserError(_("A reason is required to anonymise a trainee."))
        for partner in self:
            enrollments = (
                self.env["training.enrollment"]
                .sudo()
                .with_context(active_test=False)
                .search([("partner_id", "=", partner.id)])
            )
            if not enrollments:
                raise UserError(_("This contact is not an enrolled trainee."))
            users = (
                self.env["res.users"]
                .sudo()
                .with_context(active_test=False)
                .search([("partner_id", "=", partner.id)])
            )
            if any(
                user.has_group("training_management.group_training_admin")
                for user in users
            ):
                raise UserError(_("Administrator accounts cannot be anonymised."))
            users.write({"active": False})
            for user in users:
                user.write({"login": "anonymised-%s" % user.id})
            old_name = partner.name
            old_email = partner.email
            partner._erase_personal_traces(old_name, old_email)
            partner.sudo().write(
                {
                    "name": "%s %s" % (_("Anonymised trainee"), partner.id),
                    "email": False,
                    "phone": False,
                    "street": False,
                    "street2": False,
                    "zip": False,
                    "city": False,
                    "state_id": False,
                    "country_id": False,
                    "vat": False,
                    "website": False,
                    "function": False,
                    "comment": False,
                    "image_1920": False,
                }
            )
            enrollments.filtered(lambda e: e.state == "active").write(
                {"state": "inactive"}
            )
            self.env["training.audit.log"]._log(
                "personal_data_anonymised",
                _(
                    "Personal data of partner %(partner)s was anonymised by "
                    "%(user)s. Reason: %(reason)s"
                )
                % {
                    "partner": partner.id,
                    "user": self.env.user.name,
                    "reason": reason,
                },
                record=partner,
            )
        return True

    def _erase_personal_traces(self, old_name, old_email):
        """P3 / DEC-44: remove the stored copies of a trainee's identity
        outside the partner record itself -- mail already sent to her
        (queue rows and their messages: the reminder body carries her name
        and address), her follower rows, the optional email/nickname kept
        on her survey responses, and her name inside audit descriptions.
        Attendance, responses and approved reports are kept. Plain SQL is
        used for the response and audit text so that anonymising never
        triggers the final-response correction guard nor the audit log's
        immutability guard."""
        self.ensure_one()
        env = self.env
        domain = [("recipient_ids", "in", self.ids)]
        if old_email:
            domain = ["|", ("email_to", "ilike", old_email)] + domain
        mails = env["mail.mail"].sudo().with_context(active_test=False).search(domain)
        messages = mails.mapped("mail_message_id") | env["mail.message"].sudo().search(
            [("partner_ids", "in", self.ids)]
        )
        mails.unlink()
        messages.unlink()
        env["mail.followers"].sudo().search([("partner_id", "=", self.id)]).unlink()
        env.cr.execute(
            "UPDATE survey_user_input SET email = NULL, nickname = NULL "
            "WHERE partner_id = %s",
            (self.id,),
        )
        if old_name and len(old_name.strip()) >= 3:
            env.cr.execute(
                "UPDATE training_audit_log SET description = "
                "replace(description, %s, %s) WHERE description LIKE %s",
                (old_name, _("Anonymised trainee"), "%" + old_name + "%"),
            )
        env["survey.user_input"].invalidate_model(["email", "nickname"])
        env["training.audit.log"].invalidate_model(["description"])
