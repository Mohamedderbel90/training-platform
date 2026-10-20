import math

from odoo import _, api, fields, models
from odoo.exceptions import AccessError, UserError, ValidationError

# API DTO field -> how it is applied to survey.user_input.line
# (M4 point 15: the API is allowed frontend-friendly names; this is the
# single place that maps them to Odoo's actual answer_type/value_*
# fields, so no controller re-derives this mapping).
_TEXT_QUESTION_VALUE_FIELD = {
    "char_box": "value_char_box",
    "text_box": "value_text_box",
}


class SurveyUserInput(models.Model):
    _inherit = "survey.user_input"

    # Project-defined fields (PROJECT_SPEC section 6). Optional at the
    # field level: this extension applies to every survey.user_input in
    # the database, including ones unrelated to this project.
    training_day_id = fields.Many2one("training.day", string="Training Day")
    respondent_role = fields.Selection(
        selection=[
            ("trainee", "Trainee"),
            ("supervisor", "Supervisor"),
            ("trainer", "Trainer"),
        ],
    )

    # Stored related fields purely for Back-office search/group-by
    # convenience (M3 point 10); plain foreign keys, not derived metrics.
    course_id = fields.Many2one(
        "training.course",
        string="Course",
        related="training_day_id.course_id",
        store=True,
    )
    program_id = fields.Many2one(
        "training.program",
        string="Program",
        related="course_id.program_id",
        store=True,
    )

    # Business "Submitted" maps to state == 'done' (Odoo 19 standard
    # states: new / in_progress / done). No custom "submitted" state is
    # introduced (PROJECT_SPEC section 4).
    #
    # At most one response per (training day, role, respondent) ever
    # exists -- callers must get-or-create via
    # training.day.get_or_create_survey_response() rather than calling
    # create() directly, so a record can move new -> in_progress -> done
    # without ever having two parallel attempts. PostgreSQL treats NULLs
    # as distinct in a UNIQUE constraint, so survey.user_input rows
    # unrelated to this project (training_day_id/respondent_role/
    # partner_id left empty) are never affected.
    _training_day_role_partner_uniq = models.Constraint(
        "unique(training_day_id, respondent_role, partner_id)",
        "Only one response is allowed per training day, role and "
        "respondent.",
    )

    def _is_training_privileged(self):
        """True for internal/system code and the General Supervisor,
        who (SEC-007) may see and manage every response. Everyone else
        (trainee/supervisor/trainer) is an end-user respondent whose
        access to training responses is bounded by the survey window,
        ownership and the identity checks below -- enforced here, at
        the model, so it holds for direct ORM/RPC access as well as for
        the Operational API (which calls the same model code)."""
        return self.env.su or self.env.user.has_group(
            "training_management.group_training_admin"
        )

    @api.model_create_multi
    def create(self, vals_list):
        if not self._is_training_privileged():
            user = self.env.user
            for vals in vals_list:
                # These two checks must apply unconditionally, even when
                # training_day_id is absent -- otherwise a day-less
                # create() would skip every guard below and produce a
                # finalized response with no ownership/window check
                # (and write()'s _check_respondent_write() then blocks
                # ever attaching a day to it afterwards).
                if vals.get("state") == "done":
                    raise UserError(
                        _("A response can only be finalized by submitting it.")
                    )
                partner_id = vals.get("partner_id") or user.partner_id.id
                if partner_id != user.partner_id.id:
                    raise AccessError(
                        _("You can only create a response for yourself.")
                    )
                if not vals.get("training_day_id"):
                    continue
                day = self.env["training.day"].browse(vals["training_day_id"])
                # Ownership + open day + open survey window + no final
                # response yet (same gate as the Operational API).
                survey, _partner = day.check_survey_access(
                    vals.get("respondent_role"), user=user
                )
                if vals.get("survey_id") != survey.id:
                    raise AccessError(
                        _("The survey does not match this training day.")
                    )
        return super().create(vals_list)

    def write(self, vals):
        if not self.env.su:
            for user_input in self:
                if user_input.state == "done":
                    raise UserError(
                        _(
                            "This response has already been submitted and "
                            "is final; it cannot be modified."
                        )
                    )
        if not self._is_training_privileged():
            self._check_respondent_write(vals)
        # SRS section 6.11 / PROJECT_SPEC section 17: "administrative
        # correction of a final response" is audit-worthy. The guard
        # above already means only a privileged, env.su-scoped caller
        # can ever reach this point for a response whose state is
        # already 'done' (ADR-003) -- there is no admin UI/wizard for
        # this yet (that workflow is OPD-11, not decided here); this
        # only makes that one existing, otherwise-silent path leave a
        # trace, matching how day_reopen/day_close/report_approval/
        # permission_change are logged elsewhere in this addon.
        to_audit = self.browse()
        before_by_id = {}
        if self._is_training_privileged():
            to_audit = self.filtered(
                lambda ui: ui.state == "done" and ui.training_day_id
            )
            before_by_id = {
                user_input.id: {
                    name: user_input._audit_field_repr(name)
                    for name in vals
                    if name in user_input._fields
                }
                for user_input in to_audit
            }
        if to_audit:
            self.env["training.audit.log"]._require_correction_reason()
        result = super().write(vals)
        for user_input in to_audit:
            before = before_by_id[user_input.id]
            changes = (
                ", ".join(
                    "%s: %r -> %r"
                    % (name, before[name], user_input._audit_field_repr(name))
                    for name in before
                )
                or "(no tracked field changed)"
            )
            self.env["training.audit.log"]._log(
                "response_correction",
                _(
                    "Final response for training day %(day)s (%(role)s) "
                    "was administratively corrected by %(user)s. "
                    "Changes: %(changes)s."
                )
                % {
                    "day": user_input.training_day_id.date,
                    "role": user_input._role_label(user_input.respondent_role),
                    "user": self.env.user.name,
                    "changes": changes,
                },
                record=user_input,
            )
        return result

    def action_print_answers(self):
        """C4: the standard print page is a public survey route, refused
        for project surveys; say so instead of opening an error page."""
        if self.filtered("training_day_id"):
            raise UserError(
                _(
                    "Training responses cannot be printed from the survey "
                    "pages. Use the training reports instead."
                )
            )
        return super().action_print_answers()

    def action_open_correction_wizard(self):
        """P2: the Odoo button on a final response (General Supervisor)."""
        self.ensure_one()
        if not self.env.user.has_group("training_management.group_training_admin"):
            raise AccessError(
                _("Only the General Supervisor can correct a final response.")
            )
        return {
            "type": "ir.actions.act_window",
            "name": _("Correct Final Response"),
            "res_model": "training.response.correction",
            "view_mode": "form",
            "target": "new",
            "context": {"default_response_id": self.id},
        }

    def action_correct_final_response(self, vals, reason):
        """DEC-11: the one sanctioned way to correct an already-final
        response. General Supervisor only; a non-blank ``reason`` is
        mandatory and is stored with the before/after values in the
        audit log. The response stays ``done`` (there is no separate
        "administratively corrected" state) and approved reports are
        unaffected -- a correction shows up in a new report version."""
        if not self.env.user.has_group("training_management.group_training_admin"):
            raise AccessError(
                _("Only the General Supervisor can correct a final response.")
            )
        reason = (reason or "").strip()
        if not reason:
            raise UserError(
                _("A reason is required to correct a final response.")
            )
        self.sudo().with_context(correction_reason=reason).write(vals)
        return True

    def _audit_field_repr(self, name):
        """Safe, human-readable snapshot of one field's current value for
        the audit description above -- relational fields are reduced to
        their display name rather than an internal recordset repr."""
        self.ensure_one()
        value = self[name]
        if isinstance(value, models.BaseModel):
            return value.display_name if value else False
        return value

    def _check_respondent_write(self, vals):
        """End-user writes to a training response: identity/context
        fields are immutable, and finalizing re-checks the survey
        window server-side at the moment of submission."""
        user = self.env.user
        if vals.get("training_day_id") or vals.get("respondent_role"):
            # A day-less response must not be retro-attached to a day
            # (or given a role) by an end user: that would skip every
            # window/ownership check done at creation.
            if self.filtered(lambda ui: not ui.training_day_id):
                raise AccessError(
                    _("A response cannot be attached to a training day.")
                )
        for user_input in self.filtered("training_day_id"):
            for name in ("training_day_id", "respondent_role", "partner_id", "survey_id"):
                if name not in vals:
                    continue
                new_value = vals[name]
                current = user_input[name]
                if isinstance(new_value, models.BaseModel):
                    new_value = new_value.id
                if (current.id if current else False) != (new_value or False):
                    raise AccessError(
                        _("The %s of a response cannot be changed.") % name
                    )
            if vals.get("state") == "done":
                user_input.training_day_id.check_survey_access(
                    user_input.respondent_role, user=user
                )

    def _role_label(self, role):
        """Readable (translated) respondent role for audit descriptions."""
        labels = dict(self._fields["respondent_role"]._description_selection(self.env))
        return labels.get(role, role or "-")

    def unlink(self):
        if not self.env.su:
            for user_input in self:
                if user_input.state == "done":
                    raise UserError(
                        _("A final, submitted response cannot be deleted.")
                    )
        # Same audit-trail gap as write() above: only env.su can delete
        # an already-final response, and that was previously silent.
        to_audit = []
        if self._is_training_privileged():
            to_audit = [
                (user_input, user_input.training_day_id.date, user_input.respondent_role)
                for user_input in self
                if user_input.state == "done" and user_input.training_day_id
            ]
        if to_audit:
            self.env["training.audit.log"]._require_correction_reason()
        result = super().unlink()
        for user_input, day_date, role in to_audit:
            self.env["training.audit.log"]._log(
                "response_correction",
                _(
                    "Final response for training day %(day)s (%(role)s) "
                    "was administratively deleted by %(user)s."
                )
                % {"day": day_date, "role": self._role_label(role), "user": self.env.user.name},
                record=user_input,
            )
        return result

    # ------------------------------------------------------------------
    # Operational API support (M4). Answer application/validation lives
    # here, not in any controller, so the DTO-to-ORM mapping and the
    # "mandatory questions answered" rule have one home.
    # ------------------------------------------------------------------

    def _apply_answers(self, answers):
        """Replace this response's answer lines for the given questions.

        ``answers``: list of dicts, each with ``question_id`` and one of
        ``answer_option_id`` (API name for suggested_answer_id, single
        choice), ``answer_option_ids`` (multiple choice), ``text``
        (char_box/text_box), or ``value`` (numerical_box/scale).
        Only usable while this response is not yet final -- the
        write()/create() guards above already enforce that once
        state='done'.
        """
        self.ensure_one()
        Line = self.env["survey.user_input.line"]
        for item in answers:
            question = self.survey_id.question_and_page_ids.filtered(
                lambda q: q.id == item.get("question_id")
            )
            if not question:
                raise ValidationError(
                    _("question_id %s does not belong to this survey.")
                    % item.get("question_id")
                )
            question.ensure_one()
            # Rewriting an answer of the caller's own, still in-progress
            # response: respondents hold no delete right on answer lines,
            # so the replaced line is removed with sudo, after the explicit
            # guard (sudo would bypass the final-response check in unlink).
            if self.state == "done":
                raise UserError(
                    _("A final, submitted response cannot be changed here.")
                )
            self.user_input_line_ids.filtered(
                lambda line, q=question: line.question_id == q
            ).sudo().unlink()

            if question.question_type == "simple_choice" and item.get(
                "answer_option_id"
            ):
                self._check_option_belongs(question, [item["answer_option_id"]])
                Line.create(
                    {
                        "user_input_id": self.id,
                        "question_id": question.id,
                        "answer_type": "suggestion",
                        "suggested_answer_id": item["answer_option_id"],
                    }
                )
            elif question.question_type == "multiple_choice" and item.get(
                "answer_option_ids"
            ):
                self._check_option_belongs(question, item["answer_option_ids"])
                for option_id in item["answer_option_ids"]:
                    Line.create(
                        {
                            "user_input_id": self.id,
                            "question_id": question.id,
                            "answer_type": "suggestion",
                            "suggested_answer_id": option_id,
                        }
                    )
            elif (
                question.question_type in _TEXT_QUESTION_VALUE_FIELD
                and item.get("text") is not None
            ):
                Line.create(
                    {
                        "user_input_id": self.id,
                        "question_id": question.id,
                        "answer_type": question.question_type,
                        _TEXT_QUESTION_VALUE_FIELD[question.question_type]: item[
                            "text"
                        ],
                    }
                )
            elif question.question_type == "numerical_box" and item.get(
                "value"
            ) is not None:
                Line.create(
                    {
                        "user_input_id": self.id,
                        "question_id": question.id,
                        "answer_type": "numerical_box",
                        "value_numerical_box": item["value"],
                    }
                )
            elif question.question_type == "scale" and item.get("value") is not None:
                raw = item["value"]
                if (
                    isinstance(raw, bool)
                    or not isinstance(raw, (int, float))
                    or not math.isfinite(raw)
                    or raw != int(raw)
                    or not (question.scale_min <= raw <= question.scale_max)
                ):
                    raise ValidationError(
                        _("The value for '%(question)s' must be a whole number "
                          "between %(min)s and %(max)s.")
                        % {
                            "question": question.title,
                            "min": question.scale_min,
                            "max": question.scale_max,
                        }
                    )
                Line.create(
                    {
                        "user_input_id": self.id,
                        "question_id": question.id,
                        "answer_type": "scale",
                        "value_scale": int(raw),
                    }
                )
            # A question with no usable answer payload is simply left
            # unanswered; _check_mandatory_answers() below rejects the
            # submission if that question was required.

    @staticmethod
    def _check_option_belongs(question, option_ids):
        """A submitted option must be one of this question's own
        suggested answers -- otherwise a client could attach another
        question's (e.g. rating 5) option and skew the KPI."""
        valid_ids = set(question.suggested_answer_ids.ids)
        if not all(
            isinstance(option_id, int) and option_id in valid_ids
            for option_id in option_ids
        ):
            raise ValidationError(
                _("Invalid answer option for question '%s'.") % question.title
            )

    def _check_mandatory_answers(self):
        self.ensure_one()
        answered_question_ids = set(
            self.user_input_line_ids.filtered(lambda line: not line.skipped)
            .mapped("question_id")
            .ids
        )
        missing = self.survey_id.question_and_page_ids.filtered(
            lambda q: not q.is_page
            and q.constr_mandatory
            and q.id not in answered_question_ids
        )
        if missing:
            raise ValidationError(
                _("Missing required answers for: %s")
                % ", ".join(missing.mapped("title"))
            )

    def _get_status_dto(self):
        """Frontend-facing status for GET .../my-survey/status and
        dashboard listings. "submitted" is the business-facing label for
        the Odoo standard state='done' (PROJECT_SPEC section 4); the
        stable Odoo state is never renamed for anyone else."""
        self.ensure_one()
        state_label = {"new": "not_started", "in_progress": "in_progress", "done": "submitted"}
        return {
            "response_id": self.id,
            "state": state_label.get(self.state, self.state),
            "submitted_at": (
                fields.Datetime.to_string(self.end_datetime)
                if self.state == "done" and self.end_datetime
                else None
            ),
            "editable": self.state != "done",
        }

    def _get_answers_dto(self):
        """Currently saved answers in the same shape submit/draft
        endpoints accept (M4 point 15), so a resumed draft can be
        pre-filled with exactly what was last saved."""
        self.ensure_one()
        by_question = {}
        for line in self.user_input_line_ids.filtered(lambda line: not line.skipped):
            item = by_question.setdefault(
                line.question_id.id, {"question_id": line.question_id.id}
            )
            if line.answer_type == "suggestion":
                if line.question_id.question_type == "multiple_choice":
                    item.setdefault("answer_option_ids", []).append(
                        line.suggested_answer_id.id
                    )
                else:
                    item["answer_option_id"] = line.suggested_answer_id.id
            elif line.answer_type == "char_box":
                item["text"] = line.value_char_box
            elif line.answer_type == "text_box":
                item["text"] = line.value_text_box
            elif line.answer_type == "numerical_box":
                item["value"] = line.value_numerical_box
            elif line.answer_type == "scale":
                item["value"] = line.value_scale
        return list(by_question.values())


class SurveyUserInputLine(models.Model):
    _inherit = "survey.user_input.line"

    def _check_training_line_values(self, vals_by_line):
        """End users can write answer lines directly over RPC, not only
        through _apply_answers(); enforce the same integrity there so a
        KPI cannot be skewed (foreign option, out-of-range scale,
        duplicate answers). Only training responses, only non-su and
        non-General-Supervisor callers."""
        if self.env.su or self.env.user.has_group(
            "training_management.group_training_admin"
        ):
            return
        for line, vals in vals_by_line:
            user_input = line.user_input_id if line else self.env[
                "survey.user_input"
            ].browse(vals.get("user_input_id"))
            if not user_input.training_day_id:
                continue
            question = (
                self.env["survey.question"].browse(vals["question_id"])
                if vals.get("question_id")
                else line.question_id
            )
            if question.survey_id != user_input.survey_id:
                raise ValidationError(
                    _("The question does not belong to this survey.")
                )
            option_id = vals.get(
                "suggested_answer_id",
                line.suggested_answer_id.id if line else False,
            )
            if option_id and option_id not in question.suggested_answer_ids.ids:
                raise ValidationError(
                    _("Invalid answer option for question '%s'.") % question.title
                )
            scale = vals.get("value_scale")
            if (
                question.question_type == "scale"
                and "value_scale" in vals
                and not vals.get("skipped")
                and (
                    scale is None
                    or not (question.scale_min <= scale <= question.scale_max)
                )
            ):
                raise ValidationError(
                    _("The value for '%s' is out of range.") % question.title
                )

    def _check_training_line_duplicates(self):
        if self.env.su or self.env.user.has_group(
            "training_management.group_training_admin"
        ):
            return
        for line in self.filtered("user_input_id.training_day_id"):
            same = line.user_input_id.user_input_line_ids.filtered(
                lambda other: other.question_id == line.question_id
            )
            if line.question_id.question_type == "multiple_choice":
                options = same.mapped("suggested_answer_id")
                if len(options) != len(same):
                    raise ValidationError(_("Duplicate answer."))
            elif len(same) > 1:
                raise ValidationError(
                    _("Only one answer is allowed for question '%s'.")
                    % line.question_id.title
                )

    def _is_training_privileged(self):
        """Same privilege test as SurveyUserInput._is_training_privileged();
        duplicated (not delegated) because it must be evaluated as this
        model, matching how _check_training_line_values() and
        _check_training_line_duplicates() already do the same check
        inline below."""
        return self.env.su or self.env.user.has_group(
            "training_management.group_training_admin"
        )

    def _audit_answer_repr(self):
        """P2/DEC-11: readable "question: answer" snapshot of one answer
        line for the before/after values of a correction. Only the
        answer content is stored, never the respondent identity."""
        self.ensure_one()
        if self.skipped:
            value = "(skipped)"
        elif self.answer_type == "suggestion":
            value = self.suggested_answer_id.value or "-"
        elif self.answer_type == "char_box":
            value = self.value_char_box
        elif self.answer_type == "text_box":
            value = self.value_text_box
        elif self.answer_type == "scale":
            value = self.value_scale
        elif self.answer_type == "numerical_box":
            value = self.value_numerical_box
        else:
            value = self.answer_type
        return "%s: %s" % (self.question_id.title or self.question_id.id, value)

    def _log_answer_correction(self, description, details=None):
        """One training.audit.log entry per affected final response
        (not per line) -- same audit-trail gap as
        SurveyUserInput.write()/unlink(): only env.su can touch an
        answer line of an already-final response, and that was
        previously silent. See SRS section 6.11 / PROJECT_SPEC 17."""
        details = details or {}
        for user_input in self.mapped("user_input_id"):
            text = description % {
                "day": user_input.training_day_id.date,
                "role": user_input._role_label(user_input.respondent_role),
                "user": self.env.user.name,
            }
            if details.get(user_input.id):
                text = "%s %s" % (
                    text, _("Values: %s.") % "; ".join(details[user_input.id])
                )
            self.env["training.audit.log"]._log(
                "response_correction", text, record=user_input,
            )

    @api.model_create_multi
    def create(self, vals_list):
        if not self.env.su:
            user_input_ids = {
                vals["user_input_id"] for vals in vals_list if vals.get("user_input_id")
            }
            if user_input_ids:
                done_count = self.env["survey.user_input"].search_count(
                    [("id", "in", list(user_input_ids)), ("state", "=", "done")]
                )
                if done_count:
                    raise UserError(
                        _(
                            "Cannot add an answer to a response that has "
                            "already been submitted and is final."
                        )
                    )
        self._check_training_line_values([(self.browse(), v) for v in vals_list])
        if self._is_training_privileged():
            parent_ids = {
                vals["user_input_id"] for vals in vals_list if vals.get("user_input_id")
            }
            if self.env["survey.user_input"].sudo().search_count(
                [
                    ("id", "in", list(parent_ids)),
                    ("state", "=", "done"),
                    ("training_day_id", "!=", False),
                ]
            ):
                self.env["training.audit.log"]._require_correction_reason()
        lines = super().create(vals_list)
        lines._check_training_line_duplicates()
        if self._is_training_privileged():
            added = lines.filtered(
                lambda line: line.user_input_id.state == "done"
                and line.user_input_id.training_day_id
            )
            details = {}
            for line in added:
                details.setdefault(line.user_input_id.id, []).append(
                    _("added %s") % line._audit_answer_repr()
                )
            added._log_answer_correction(
                _(
                    "An answer was administratively added to the final "
                    "response for training day %(day)s (%(role)s) by "
                    "%(user)s."
                ),
                details,
            )
        return lines

    def write(self, vals):
        if not self.env.su:
            for line in self:
                if line.user_input_id.state == "done":
                    raise UserError(
                        _(
                            "This response has already been submitted and "
                            "is final; its answers cannot be modified."
                        )
                    )
        to_audit = self.browse()
        if self._is_training_privileged():
            to_audit = self.filtered(
                lambda line: line.user_input_id.state == "done"
                and line.user_input_id.training_day_id
            )
        self._check_training_line_values([(line, vals) for line in self])
        before = {}
        if to_audit:
            self.env["training.audit.log"]._require_correction_reason()
            before = {line.id: line._audit_answer_repr() for line in to_audit}
        result = super().write(vals)
        self._check_training_line_duplicates()
        details = {}
        for line in to_audit:
            details.setdefault(line.user_input_id.id, []).append(
                "%s -> %s" % (before[line.id], line._audit_answer_repr())
            )
        to_audit._log_answer_correction(
            _(
                "An answer of the final response for training day "
                "%(day)s (%(role)s) was administratively modified by "
                "%(user)s."
            ),
            details,
        )
        return result

    def unlink(self):
        if not self.env.su:
            for line in self:
                if line.user_input_id.state == "done":
                    raise UserError(
                        _(
                            "This response has already been submitted and "
                            "is final; its answers cannot be deleted."
                        )
                    )
        to_audit = self.browse()
        if self._is_training_privileged():
            to_audit = self.filtered(
                lambda line: line.user_input_id.state == "done"
                and line.user_input_id.training_day_id
            )
        # Resolve to the parent response(s) before the lines themselves
        # are gone; the parent record is not deleted here, only its
        # child lines, so it remains valid to log against afterwards.
        affected_responses = to_audit.mapped("user_input_id")
        removed = {}
        if to_audit:
            self.env["training.audit.log"]._require_correction_reason()
            for line in to_audit:
                removed.setdefault(line.user_input_id.id, []).append(
                    _("removed %s") % line._audit_answer_repr()
                )
        result = super().unlink()
        for user_input in affected_responses:
            text = _(
                "An answer was administratively removed from the "
                "final response for training day %(day)s (%(role)s) "
                "by %(user)s."
            ) % {
                "day": user_input.training_day_id.date,
                "role": user_input._role_label(user_input.respondent_role),
                "user": self.env.user.name,
            }
            text = "%s %s" % (
                text, _("Values: %s.") % "; ".join(removed.get(user_input.id, []))
            )
            self.env["training.audit.log"]._log(
                "response_correction", text, record=user_input,
            )
        return result
