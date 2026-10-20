from odoo import _, api, fields, models
from odoo.exceptions import AccessError, MissingError, UserError, ValidationError
from odoo.tools import format_date

SURVEY_ROLE_FIELDS = {
    "trainee_survey_id": "trainee",
    "supervisor_survey_id": "supervisor",
    "trainer_survey_id": "trainer",
}


class TrainingDay(models.Model):
    _name = "training.day"
    _inherit = ["training.smart.buttons"]
    _description = "Training Day"
    _order = "date, start_datetime"

    course_id = fields.Many2one(
        "training.course",
        string="Course",
        required=True,
        ondelete="restrict",
    )
    date = fields.Date(required=True)
    # Per-day subject covered, distinct from course_id (the course it
    # belongs to). Optional/nullable: a day with no topic set yet (e.g.
    # not backfilled on existing data) must render fine everywhere --
    # no default, no backfill of fake text. translate=True to match the
    # other short admin-editable bilingual AR/EN text fields on this
    # addon (training.course.name, training.program.name).
    topic = fields.Char(string="Topic", translate=True)
    start_datetime = fields.Datetime(required=True)
    end_datetime = fields.Datetime(required=True)
    state = fields.Selection(
        selection=[
            ("planned", "Planned"),
            ("open", "Open"),
            ("closed", "Closed"),
            ("postponed", "Postponed"),
            ("cancelled", "Cancelled"),
        ],
        required=True,
        default="planned",
    )
    # One supervisor per training day in V1 (PROJECT_SPEC section 5).
    # The domains only filter the pickers; _check_assignments below is the
    # server-side enforcement.
    supervisor_id = fields.Many2one(
        "res.users",
        string="Supervisor",
        required=True,
        domain=lambda self: [
            ("group_ids", "in", self.env.ref("training_management.group_training_supervisor").ids)
        ],
    )
    # Direct Many2many for V1; no training.trainer.assignment model.
    trainer_ids = fields.Many2many(
        "res.users",
        "training_day_trainer_rel",
        "day_id",
        "user_id",
        string="Trainers",
        domain=lambda self: [
            ("group_ids", "in", self.env.ref("training_management.group_training_trainer").ids)
        ],
    )
    # P4 / DEC-02 / SRS-PROG-003: why a day was postponed or cancelled, and
    # the date it had when it was postponed (a postponed day can only be
    # reopened on a new date).
    status_reason = fields.Text(
        string="Postpone / Cancel Reason",
        help="Required to postpone or cancel the training day.",
    )
    postponed_from_date = fields.Date(readonly=True, copy=False)
    survey_open_at = fields.Datetime(required=True)
    survey_close_at = fields.Datetime(required=True)
    active = fields.Boolean(default=True)

    attendance_ids = fields.One2many(
        "training.attendance", "training_day_id", string="Attendance Records"
    )

    # Survey version assignment for M2 (Odoo Survey standard, extended).
    # Domains are a UI filtering hint only; _check_survey_roles below is
    # the actual server-side enforcement.
    trainee_survey_id = fields.Many2one(
        "survey.survey",
        string="Trainee Survey",
        domain=[("survey_role", "=", "trainee")],
    )
    supervisor_survey_id = fields.Many2one(
        "survey.survey",
        string="Supervisor Survey",
        domain=[("survey_role", "=", "supervisor")],
    )
    trainer_survey_id = fields.Many2one(
        "survey.survey",
        string="Trainer Survey",
        domain=[("survey_role", "=", "trainer")],
    )

    # Neither this model nor training.enrollment (see
    # models/training_enrollment.py) has a `name` field, and neither
    # sets `_rec_name` -- with no _rec_name, Odoo 19's own default
    # _compute_display_name() (odoo/orm/models.py) falls back to the
    # literal f"{self._name},{self.id}" string, e.g. "training.day,3",
    # which is exactly what appeared, unreadable, in every Many2one
    # widget referencing this model (Attendance Records and anywhere
    # else). _rec_name itself was not an option here: it must name a
    # single existing field used verbatim, and the desired label
    # ("<course> - <date>") is composed from two fields, so overriding
    # _compute_display_name() is the correct mechanism -- and because
    # it is a model-level override, every Many2one/breadcrumb/search
    # result referencing training.day anywhere is fixed by this one
    # change, not just the Attendance Records view.
    #
    # Depends on the lang context (not just on course_id.name/date) as
    # well, because course_id.name is itself a translate=True field
    # (M1): reading it under a different Accept-Language/UI language
    # returns a different string, which the compute must react to.
    @api.depends("course_id.name", "date")
    @api.depends_context("lang")
    def _compute_display_name(self):
        for day in self:
            course_name = day.course_id.name or _("Unassigned Course")
            if day.date:
                day.display_name = "%s - %s" % (
                    course_name,
                    format_date(day.env, day.date),
                )
            else:
                day.display_name = course_name

    def _check_surveys_have_questions(self):
        """P5 / SRS-SURVEY-001: a survey without questions is never put in
        front of respondents; checked when the day is opened."""
        for day in self:
            for field_name in SURVEY_ROLE_FIELDS:
                survey = day[field_name]
                if survey and not survey.question_ids:
                    raise ValidationError(
                        _("The survey \"%s\" has no questions and cannot be "
                          "used by a training day.") % survey.title
                    )

    attendance_count = fields.Integer(compute="_compute_smart_counts")
    trainee_response_count = fields.Integer(compute="_compute_smart_counts")
    supervisor_response_count = fields.Integer(compute="_compute_smart_counts")
    trainer_response_count = fields.Integer(compute="_compute_smart_counts")

    def _compute_smart_counts(self):
        for day in self:
            day.attendance_count = day._smart_count(
                "training.attendance", [("training_day_id", "=", day.id)])
            for role in ("trainee", "supervisor", "trainer"):
                day["%s_response_count" % role] = day._smart_count(
                    "survey.user_input",
                    day._responses_domain("training_day_id", role))

    def action_open_attendance(self):
        return self._smart_action(
            _("Attendance Records"), "training.attendance",
            [("training_day_id", "=", self.id)],
            context={"default_training_day_id": self.id})

    def _open_responses(self, name, role):
        return self._smart_action(
            name, "survey.user_input",
            self._responses_domain("training_day_id", role),
            context={"create": False})

    def action_open_trainee_responses(self):
        return self._open_responses(_("Trainee Responses"), "trainee")

    def action_open_supervisor_response(self):
        return self._open_responses(_("Supervisor Evaluation"), "supervisor")

    def action_open_trainer_responses(self):
        return self._open_responses(_("Trainer Reports"), "trainer")

    @api.constrains("trainee_survey_id", "supervisor_survey_id", "trainer_survey_id")
    def _check_survey_roles(self):
        for day in self:
            for field_name, expected_role in SURVEY_ROLE_FIELDS.items():
                survey = day[field_name]
                if survey and survey.survey_role != expected_role:
                    raise ValidationError(
                        _(
                            "%(field)s must reference a survey with "
                            "survey_role = %(role)s."
                        )
                        % {"field": field_name, "role": expected_role}
                    )

    @api.constrains("supervisor_id", "trainer_ids")
    def _check_assignments(self):
        """M1 / SRS-PROG-003, ERD: the supervisor and the trainers of a day
        are active users holding the matching operational role, and at
        least one trainer is assigned."""
        supervisor_group = self.env.ref("training_management.group_training_supervisor")
        trainer_group = self.env.ref("training_management.group_training_trainer")
        for day in self:
            supervisor = day.supervisor_id
            if not supervisor.active or supervisor_group not in supervisor.group_ids:
                raise ValidationError(
                    _("%s must be an active user with the Supervisor role.")
                    % supervisor.display_name
                )
            if not day.trainer_ids:
                raise ValidationError(
                    _("At least one trainer must be assigned to the training "
                      "day on %s.") % day.date
                )
            for trainer in day.trainer_ids:
                if not trainer.active or trainer_group not in trainer.group_ids:
                    raise ValidationError(
                        _("%s must be an active user with the Trainer role.")
                        % trainer.display_name
                    )

    @api.onchange("date", "course_id")
    def _onchange_date_within_course(self):
        """P9 / SRS-PROG-002: a warning (not a block) when the day falls
        outside its course's dates."""
        for day in self:
            course = day.course_id
            if course and day.date and not (course.start_date <= day.date <= course.end_date):
                return {
                    "warning": {
                        "title": _("Date outside the course"),
                        "message": _("The day's date is outside the course's dates."),
                    }
                }

    @api.constrains("start_datetime", "end_datetime")
    def _check_datetimes(self):
        for day in self:
            if day.end_datetime <= day.start_datetime:
                raise ValidationError(
                    _("The end time must be after the start time for training "
                      "day on %(date)s.") % {"date": day.date}
                )

    @api.constrains("survey_open_at", "survey_close_at")
    def _check_survey_window(self):
        for day in self:
            if day.survey_close_at <= day.survey_open_at:
                raise ValidationError(
                    _("The survey close time must be after the survey open "
                      "time for training day on %(date)s.") % {"date": day.date}
                )

    def unlink(self):
        for day in self:
            if day.state != "planned":
                raise UserError(
                    _("Only planned training days can be deleted. Archive or "
                      "cancel the training day on %(date)s instead.")
                    % {"date": day.date}
                )
        return super().unlink()

    # ------------------------------------------------------------------
    # Explicit workflow actions (M3). Day state is controlled exclusively
    # by an authorized Odoo user; there is no automatic time-based state
    # transition (survey_open_at/survey_close_at remain independent time
    # constraints checked by check_survey_access() above, regardless of
    # state). Legal transitions are validated centrally in write() below
    # so that no path -- action button, statusbar click, or a direct
    # write({'state': ...}) from any other code -- can bypass them.
    # ------------------------------------------------------------------

    _ALLOWED_STATE_TRANSITIONS = {
        "planned": {"open", "postponed", "cancelled"},
        "open": {"closed", "postponed", "cancelled"},
        "postponed": {"open", "cancelled"},
        # Reopening a closed day is an exceptional event (PROJECT_SPEC
        # section 17 lists it as audit-worthy); allowed here and
        # audited centrally in write() below, so every path (button,
        # statusbar, direct write) is logged.
        "closed": {"open"},
        "cancelled": set(),
    }

    def write(self, vals):
        new_state = vals.get("state")
        if new_state is not None:
            for day in self:
                if new_state == day.state:
                    continue
                if new_state not in self._ALLOWED_STATE_TRANSITIONS.get(
                    day.state, set()
                ):
                    raise UserError(
                        _(
                            "Cannot change training day on %(date)s from "
                            "%(from_state)s to %(to_state)s."
                        )
                        % {
                            "date": day.date,
                            "from_state": day.state,
                            "to_state": new_state,
                        }
                    )
        # P4 / DEC-02: a day is postponed or cancelled only with a reason,
        # and a postponed day is reopened only on a new date.
        postponing = self.browse()
        if new_state in ("postponed", "cancelled"):
            for day in self:
                if day.state == new_state:
                    continue
                reason = vals.get("status_reason", day.status_reason)
                if not (reason or "").strip():
                    raise UserError(
                        _("A reason is required to postpone or cancel the "
                          "training day on %s.") % day.date
                    )
            if new_state == "postponed":
                postponing = self.filtered(lambda day: day.state != "postponed")
        if new_state == "open":
            for day in self.filtered(lambda d: d.state == "postponed"):
                new_date = vals.get("date", day.date)
                if str(new_date) == str(day.postponed_from_date):
                    raise UserError(
                        _("Set a new date before reopening the postponed "
                          "training day (currently %s).") % day.date
                    )
        reopened = self.browse()
        closed = self.browse()
        if new_state == "open":
            reopened = self.filtered(lambda day: day.state == "closed")
        elif new_state == "closed":
            closed = self.filtered(lambda day: day.state != "closed")
        postponed_from = {day.id: day.date for day in postponing}
        result = super().write(vals)
        if new_state == "open":
            self._check_surveys_have_questions()
        for day in postponing:
            super(TrainingDay, day).write(
                {"postponed_from_date": postponed_from[day.id]}
            )
        # PROJECT_SPEC section 17: exceptional reopen of a training day
        # is audit-worthy. Logged here (not only in action_reopen) so a
        # statusbar click or a direct write({'state': 'open'}) on a
        # closed day cannot bypass the audit trail.
        for day in reopened:
            self.env["training.audit.log"]._log(
                "day_reopen",
                _("Training day on %(date)s was reopened by %(user)s.")
                % {"date": day.date, "user": self.env.user.name},
                record=day,
            )
        # SRS 6.11 also lists day closing (closing freezes the day's
        # responses, BR-004), so the actor/time of every close is kept.
        for day in closed:
            self.env["training.audit.log"]._log(
                "day_close",
                _("Training day on %(date)s was closed by %(user)s.")
                % {"date": day.date, "user": self.env.user.name},
                record=day,
            )
        return result

    def action_open(self):
        """planned -> open, or postponed -> open (after rescheduling).

        Both this and action_reopen() write the same target state
        ('open'), so the generic transition matrix in write() alone
        cannot tell them apart; each action additionally checks its own
        specific source state so a closed day can only be reopened via
        action_reopen(), never via action_open().
        """
        for day in self:
            if day.state not in ("planned", "postponed"):
                raise UserError(
                    _(
                        "Cannot open training day on %(date)s from state "
                        "%(state)s. Use Reopen for a closed day."
                    )
                    % {"date": day.date, "state": day.state}
                )
        self.write({"state": "open"})

    def action_close(self):
        """open -> closed."""
        self.write({"state": "closed"})

    def action_reopen(self):
        """closed -> open. See action_open() for why this is a separate
        method rather than reusing it.

        PROJECT_SPEC section 17 names this as audit-worthy ("exceptional
        reopen/close of a training day"). M3/ADR-004 deliberately left
        this unaudited because training.audit.log did not exist yet;
        M10 closes that gap (see docs/adr/ADR-010-hardening-and-deployment-readiness.md).
        The audit entry itself is written by write() so it also covers
        non-button paths.
        """
        for day in self:
            if day.state != "closed":
                raise UserError(
                    _(
                        "Cannot reopen training day on %(date)s: it is "
                        "%(state)s, not closed."
                    )
                    % {"date": day.date, "state": day.state}
                )
        self.write({"state": "open"})

    def action_postpone(self):
        """planned/open -> postponed."""
        self.write({"state": "postponed"})

    def action_cancel(self):
        """planned/open/postponed -> cancelled. A closed (completed) day
        is not cancellable through this action."""
        self.write({"state": "cancelled"})

    # ------------------------------------------------------------------
    # Survey availability service (M2). No HTTP controller is exposed
    # here; this is the reusable model-level service M4's Operational
    # API will call.
    # ------------------------------------------------------------------

    def _get_role_survey(self, role):
        self.ensure_one()
        field_name = {
            "trainee": "trainee_survey_id",
            "supervisor": "supervisor_survey_id",
            "trainer": "trainer_survey_id",
        }.get(role)
        if not field_name:
            raise UserError(_("Unknown survey role: %s") % role)
        return self[field_name]

    def _check_role_ownership(self, role, user, require_active_enrollment=True):
        """Raise AccessError/UserError if ``user`` is not the intended
        respondent for ``role`` on this day. Deliberately does NOT check
        day state / survey window / existing-final-response -- only
        ownership, so it can be reused both by check_survey_access()
        (the full submit-eligibility gate) and by
        get_survey_definition_dto() (a read-only "can I even see this
        survey" check that intentionally ignores the time window, per
        M4: viewing a not-yet-open or already-closed survey definition
        is allowed; submitting to it is not).
        """
        self.ensure_one()
        if role == "trainee":
            # D2 / DEC-07: only an ACTIVE enrollment gives access to a
            # day's survey; inactive or completed enrollees keep only the
            # read-back of what they already submitted
            # (require_active_enrollment=False).
            domain = [
                ("program_id", "=", self.course_id.program_id.id),
                ("partner_id", "=", user.partner_id.id),
            ]
            if require_active_enrollment:
                domain.append(("state", "=", "active"))
            enrollment = (
                self.env["training.enrollment"]
                .with_user(user)
                .search(domain, limit=1)
            )
            if not enrollment:
                raise AccessError(
                    _("You are not actively enrolled in this training "
                      "day's program.")
                )
        elif role == "supervisor":
            if self.supervisor_id != user:
                raise AccessError(
                    _("You are not the assigned supervisor for this "
                      "training day.")
                )
        elif role == "trainer":
            if user not in self.trainer_ids:
                raise AccessError(
                    _("You are not an assigned trainer for this training day.")
                )
        else:
            raise UserError(_("Unknown survey role: %s") % role)

    def get_survey_definition_dto(self, role, user=None, require_active_enrollment=True):
        """Read-only survey definition (M4 point 10): ownership is
        checked, but not day state / survey window -- a trainee/
        supervisor/trainer may look at a survey's questions before it
        opens or after it closes; only submitting is time-gated."""
        self.ensure_one()
        user = user or self.env.user
        day = self.with_user(user)  # M1 record rule enforces day-level access
        survey = day._get_role_survey(role)
        if not survey:
            raise UserError(
                _("No %s survey is configured for this training day.") % role
            )
        day._check_role_ownership(
            role, user, require_active_enrollment=require_active_enrollment
        )
        return survey.with_user(user)._get_definition_dto()

    def check_survey_access(self, role, user=None):
        """Verify that ``user`` may access/submit the ``role`` survey for
        this training day. Raises AccessError/UserError with a specific
        reason and returns (survey, partner) on success. Performs no
        write; callers use get_or_create_survey_response() to actually
        obtain the survey.user_input record.
        """
        self.ensure_one()
        user = user or self.env.user
        day = self.with_user(user)  # re-check via M1's own record rules
        partner = user.partner_id

        survey = day._get_role_survey(role)
        if not survey:
            raise UserError(
                _("No %s survey is configured for this training day.") % role
            )

        day._check_role_ownership(role, user)

        if day.state != "open":
            raise UserError(
                _("This training day is not open for survey submission.")
            )

        now = fields.Datetime.now()
        if now < day.survey_open_at:
            raise UserError(_("The survey window has not opened yet."))
        if now > day.survey_close_at:
            raise UserError(_("The survey window has closed."))

        existing_final = (
            self.env["survey.user_input"]
            .with_user(user)
            .search_count(
                [
                    ("training_day_id", "=", day.id),
                    ("respondent_role", "=", role),
                    ("partner_id", "=", partner.id),
                    ("state", "=", "done"),
                ]
            )
        )
        if existing_final:
            raise UserError(
                _("A final response has already been submitted for this "
                  "training day.")
            )

        return survey, partner

    def get_or_create_survey_response(self, role, user=None):
        """Return the (possibly newly created) survey.user_input for
        ``user``'s ``role`` response to this training day, reusing the
        standard survey.survey._create_answer() service so state/partner
        defaults follow normal Odoo Survey behavior. Never creates a
        second attempt: at most one row per (training day, role,
        respondent) can ever exist (enforced by
        survey.user_input._training_day_role_partner_uniq).
        """
        self.ensure_one()
        user = user or self.env.user
        survey, partner = self.check_survey_access(role, user=user)

        existing = (
            self.env["survey.user_input"]
            .with_user(user)
            .search(
                [
                    ("training_day_id", "=", self.id),
                    ("respondent_role", "=", role),
                    ("partner_id", "=", partner.id),
                ],
                limit=1,
            )
        )
        if existing:
            return existing

        return survey.with_user(user)._create_answer(
            user=user,
            training_day_id=self.id,
            respondent_role=role,
        )

    def get_survey_status(self, role, user=None):
        """Non-raising status for dashboards and GET .../status
        endpoints. Reuses check_survey_access() for the "can I act now"
        determination so that logic lives in exactly one place."""
        self.ensure_one()
        user = user or self.env.user
        partner = user.partner_id
        survey = self._get_role_survey(role)
        if not survey:
            return {
                "configured": False,
                "response": None,
                "can_submit": False,
                "reason": "not_configured",
            }

        existing = (
            self.env["survey.user_input"]
            .with_user(user)
            .search(
                [
                    ("training_day_id", "=", self.id),
                    ("respondent_role", "=", role),
                    ("partner_id", "=", partner.id),
                ],
                limit=1,
            )
        )

        can_submit = False
        reason = None
        if existing and existing.state == "done":
            reason = "already_submitted"
        else:
            try:
                self.check_survey_access(role, user=user)
                can_submit = True
            except (UserError, AccessError) as exc:
                reason = str(exc)

        return {
            "configured": True,
            "response": existing._get_status_dto() if existing else None,
            "can_submit": can_submit,
            "reason": reason,
        }

    def submit_survey_response(self, role, answers, user=None):
        """Full submit flow for a role's survey response: get-or-create
        the attempt, apply the submitted answers, validate required
        questions, and finalize to state='done'.

        Idempotent (M4 point 14): if a final response already exists
        for (day, role, respondent), it is returned as-is without
        error and without re-applying the submitted answers -- a
        retried final-submit request (e.g. a network retry) never
        creates a second final response and never raises a conflict
        for what is, from the caller's point of view, the same
        successful action repeated.
        """
        self.ensure_one()
        user = user or self.env.user
        partner = user.partner_id

        existing = (
            self.env["survey.user_input"]
            .with_user(user)
            .search(
                [
                    ("training_day_id", "=", self.id),
                    ("respondent_role", "=", role),
                    ("partner_id", "=", partner.id),
                ],
                limit=1,
            )
        )
        if existing and existing.state == "done":
            return existing

        response = self.get_or_create_survey_response(role, user=user)
        response = response.with_user(user)
        response._apply_answers(answers or [])
        response._check_mandatory_answers()
        # end_datetime is not auto-set by a direct ORM write (only
        # Odoo's own portal submit controller sets it, which this
        # flow deliberately bypasses); set it explicitly so
        # _get_status_dto()'s submitted_at is meaningful.
        response.write({"state": "done", "end_datetime": fields.Datetime.now()})
        return response

    def save_draft_survey_response(self, role, answers, user=None):
        """Save a non-final set of answers. Draft = the standard Odoo
        Survey 'in_progress' state, never an invented custom state
        (ADR-003/M4 point 12). Does not validate required questions --
        that only happens at final submit."""
        self.ensure_one()
        user = user or self.env.user
        response = self.get_or_create_survey_response(role, user=user)
        response = response.with_user(user)
        response._apply_answers(answers or [])
        if response.state == "new":
            response.write({"state": "in_progress"})
        return response

    def get_trainee_submitted_response_dto(self, user=None):
        """Read-back of the caller's OWN final trainee response (OPD-01,
        approved by the project owner): the survey definition plus the
        saved answers, only once the response is submitted (state "done").
        Ownership comes from the same checks every other trainee endpoint
        uses -- the day record rule, enrolment (_check_role_ownership) and a
        search scoped to the caller's own partner -- so another trainee's
        response, or a draft, can never be returned. Read-only: nothing
        here writes, and no edit path is introduced."""
        self.ensure_one()
        user = user or self.env.user
        definition = self.get_survey_definition_dto(
            "trainee", user=user, require_active_enrollment=False
        )
        existing = (
            self.env["survey.user_input"]
            .with_user(user)
            .search(
                [
                    ("training_day_id", "=", self.id),
                    ("respondent_role", "=", "trainee"),
                    ("partner_id", "=", user.partner_id.id),
                    ("state", "=", "done"),
                ],
                limit=1,
            )
        )
        if not existing:
            raise UserError(_("You have not submitted this survey yet."))
        return {
            "definition": definition,
            "status": existing._get_status_dto(),
            "answers": existing._get_answers_dto(),
        }

    def get_trainer_report_dto(self, role, user=None):
        """Combined definition + current status/answers for roles whose
        single GET endpoint must support resuming a draft (trainer)."""
        self.ensure_one()
        user = user or self.env.user
        definition = self.get_survey_definition_dto(role, user=user)
        status = self.get_survey_status(role, user=user)
        answers = None
        if status["response"]:
            response = (
                self.env["survey.user_input"]
                .with_user(user)
                .browse(status["response"]["response_id"])
            )
            answers = response._get_answers_dto()
        return {"definition": definition, "status": status, "answers": answers}

    @api.model
    def _assigned_days_domain(self, role, user):
        """Days assigned to ``user`` in ``role``: the supervisor's own days,
        the trainer's own days, or the days of the trainee's program. Applied
        by the role listings on top of the M1 record rules, so a listing is
        scoped to the logged-in user even for an account that holds more
        than one group (record rules of several groups are OR-ed)."""
        if role == "supervisor":
            return [("supervisor_id", "=", user.id)]
        if role == "trainer":
            return [("trainer_ids", "in", [user.id])]
        if role == "trainee":
            return [
                ("course_id.program_id.enrollment_ids.partner_id", "=", user.partner_id.id)
            ]
        raise UserError(_("Unknown role: %s") % role)

    def _assigned_days(self, role, user):
        return self.with_user(user).search(
            self._assigned_days_domain(role, user),
            order="date desc, start_datetime desc",
        )

    def get_dashboard(self, role, user=None):
        """Dashboard listing for ``role``: the training days assigned to
        ``user`` in that role, scoped by the M1 record rules and, explicitly,
        by _assigned_days_domain()."""
        user = user or self.env.user
        days = self._assigned_days(role, user)
        return [day._build_dashboard_entry(role, user) for day in days]

    def get_dashboard_summary(self, role, user=None, program_id=None):
        """Dashboard home aggregates (welcome/stat-card/next-session
        blocks), scoped to ONE program: ``program_id`` when given, else the
        user's current program (the one of the nearest upcoming, else most
        recent, assigned day). ``days``, ``stats``, ``next_session`` and
        ``program`` are all computed from that program's days only, out of
        the days assigned to ``user`` (see _assigned_days_domain), so a
        program the user has no assigned day in is refused, never shown.
        ``programs`` lists every program the user has assigned days in (the
        header's program selector). Plain counts derived from the days; no
        stored KPI and no formula duplicated out of training.analytics (M5
        point 7/8). Everything is None/empty when the user has no assigned
        days at all, never a misleading zeroed-out block.
        """
        user = user or self.env.user
        all_days = self._assigned_days(role, user)

        programs = []
        for program in all_days.mapped("course_id.program_id").sorted(
            key=lambda p: (p.start_date or fields.Date.today(), p.id), reverse=True
        ):
            programs.append(
                {
                    "id": program.id,
                    "name": program.name,
                    "start_date": fields.Date.to_string(program.start_date),
                    "end_date": fields.Date.to_string(program.end_date),
                    "state": program.state,
                }
            )

        today = fields.Date.context_today(self)

        def nearest(days):
            # `days` is ordered date desc, so the nearest upcoming day is
            # the LAST upcoming element, not the first.
            upcoming = days.filtered(
                lambda d: d.state in ("planned", "open") and d.date and d.date >= today
            )
            return (upcoming[-1] if upcoming else days[0]), upcoming

        selected = None
        if program_id:
            selected = all_days.mapped("course_id.program_id").filtered(
                lambda p: p.id == program_id
            )
            if not selected:
                raise AccessError(
                    _("You have no training days assigned in this program.")
                )
        elif all_days:
            selected = nearest(all_days)[0].course_id.program_id

        days = (
            all_days.filtered(lambda d: d.course_id.program_id == selected)
            if selected
            else all_days.browse()
        )
        entries = [day._build_dashboard_entry(role, user) for day in days]

        program = None
        stats = None
        next_session = None

        if days:
            current_day, upcoming = nearest(days)
            training_days_count = len(days)
            closed_count = len(days.filtered(lambda d: d.state == "closed"))
            stats = {
                "courses_count": len(days.mapped("course_id")),
                "training_days_count": training_days_count,
                "training_hours": round(days._get_training_hours(), 1),
                "progress_percent": round(
                    (closed_count / training_days_count) * 100.0, 1
                ),
            }
            program = {
                "id": selected.id,
                "name": selected.name,
                "start_date": fields.Date.to_string(selected.start_date),
                "end_date": fields.Date.to_string(selected.end_date),
                "state": selected.state,
                "courses": days._get_dashboard_courses(),
            }
            if upcoming:
                # _build_dashboard_entry() already carries `trainers`.
                next_session = current_day._build_dashboard_entry(role, user)

        return {
            "days": entries,
            "program": program,
            "programs": programs,
            "stats": stats,
            "next_session": next_session,
        }

    def _get_training_hours(self):
        """Scheduled session hours of the days in ``self`` (the single
        formula behind both ``stats.training_hours`` and each
        ``program.courses[].training_hours`` -- not rounded here)."""
        return sum(
            (d.end_datetime - d.start_datetime).total_seconds() / 3600.0
            for d in self
            if d.start_datetime and d.end_datetime
        )

    def _get_dashboard_courses(self):
        """Per-course breakdown of the (already role-scoped) days in
        ``self``, for the dashboard summary's ``program.courses``. Only
        counts derived from the days the caller can see -- no course
        status is exposed, since training.course has no state field
        (PROJECT_SPEC section 5)."""
        courses = self.mapped("course_id").sorted(
            key=lambda c: (c.sequence, c.start_date, c.id)
        )
        result = []
        for course in courses:
            course_days = self.filtered(lambda d, c=course: d.course_id == c)
            result.append(
                {
                    "id": course.id,
                    "name": course.name,
                    "sequence": course.sequence,
                    "training_days_count": len(course_days),
                    "closed_days_count": len(
                        course_days.filtered(lambda d: d.state == "closed")
                    ),
                    "training_hours": round(course_days._get_training_hours(), 1),
                }
            )
        return result

    @api.model
    def get_dashboard_day(self, role, day_id, user=None):
        """Single training day in the dashboard-entry shape (the same
        dict get_dashboard() returns per day, ``trainers`` included).

        - MissingError (404) when the id does not exist or is archived
          (archived days are never listed on the dashboards either).
        - AccessError (403) when the M1 record rules hide the day from
          ``user`` -- checked explicitly, not left to a lazy field read.
        - AccessError (403) when ``user`` can see the day, but not in
          ``role`` (e.g. a supervisor+trainer user asking for the
          trainer view of a day they only supervise), via the same
          _check_role_ownership() the survey endpoints use.
        No sudo(): everything is read as ``user``.
        """
        user = user or self.env.user
        day = self.with_user(user).browse(day_id).exists()
        if not day:
            raise MissingError(_("Training day not found."))
        day.check_access("read")
        if not day.active:
            raise MissingError(_("Training day not found."))
        day._check_role_ownership(role, user)
        return day._build_dashboard_entry(role, user)

    def _build_dashboard_entry(self, role, user):
        self.ensure_one()
        entry = {
            "training_day_id": self.id,
            "course_id": self.course_id.id,
            "program_id": self.course_id.program_id.id,
            "date": fields.Date.to_string(self.date) if self.date else None,
            "topic": self.topic or None,
            "course_name": self.course_id.name,
            "program_name": self.course_id.program_id.name,
            "start_datetime": (
                fields.Datetime.to_string(self.start_datetime)
                if self.start_datetime
                else None
            ),
            "end_datetime": (
                fields.Datetime.to_string(self.end_datetime)
                if self.end_datetime
                else None
            ),
            "state": self.state,
            "survey_open_at": (
                fields.Datetime.to_string(self.survey_open_at)
                if self.survey_open_at
                else None
            ),
            "survey_close_at": (
                fields.Datetime.to_string(self.survey_close_at)
                if self.survey_close_at
                else None
            ),
            # Trainer identity is ordinary scheduling info (who is
            # teaching a given day), not a sensitive survey answer, so
            # it is safe to expose to every role viewing the day.
            "trainers": [
                {"id": trainer.id, "name": trainer.name}
                for trainer in self.trainer_ids
            ],
        }
        if role == "trainee":
            entry["survey"] = self.get_survey_status("trainee", user=user)
        elif role == "supervisor":
            entry["attendance"] = self._get_attendance_summary(user)
            entry["survey"] = self.get_survey_status("supervisor", user=user)
        elif role == "trainer":
            entry["trainer_report"] = self.get_survey_status("trainer", user=user)
        return entry

    def _get_attendance_summary(self, user):
        self.ensure_one()
        # Same population as get_attendance_dto()/upsert_attendance():
        # only ACTIVE enrollments are expected to have attendance, so an
        # inactive/completed enrollment must not keep `complete` false
        # forever, and a leftover record for one must not be counted.
        total_enrolled = (
            self.env["training.enrollment"]
            .with_user(user)
            .search_count(
                [
                    ("program_id", "=", self.course_id.program_id.id),
                    ("state", "=", "active"),
                ]
            )
        )
        recorded = (
            self.env["training.attendance"]
            .with_user(user)
            .search_count(
                [
                    ("training_day_id", "=", self.id),
                    ("enrollment_id.state", "=", "active"),
                ]
            )
        )
        return {
            "recorded_count": recorded,
            "total_enrolled": total_enrolled,
            "complete": bool(total_enrolled) and recorded >= total_enrolled,
        }

    # ------------------------------------------------------------------
    # Supervisor attendance operational API support (M4). "trainee_id"
    # in the DTO is the API-friendly name for training.enrollment.id,
    # not res.partner.id (M4 point 15) -- attendance is scoped to a
    # program enrollment, not to the person in the abstract.
    # ------------------------------------------------------------------

    def get_attendance_dto(self, user=None):
        """Every actively enrolled trainee for this day's program, with
        their current attendance status if already recorded. Relying on
        .with_user(user) means the M1 record rule (supervisor: only
        their assigned days) is what actually enforces "only the
        assigned supervisor" -- not a duplicate check here."""
        self.ensure_one()
        user = user or self.env.user
        day = self.with_user(user)
        enrollments = (
            self.env["training.enrollment"]
            .with_user(user)
            .search(
                [
                    ("program_id", "=", day.course_id.program_id.id),
                    ("state", "=", "active"),
                ]
            )
        )
        attendance_by_enrollment = {
            attendance.enrollment_id.id: attendance
            for attendance in self.env["training.attendance"]
            .with_user(user)
            .search([("training_day_id", "=", day.id)])
        }
        items = []
        for enrollment in enrollments:
            attendance = attendance_by_enrollment.get(enrollment.id)
            items.append(
                {
                    "trainee_id": enrollment.id,
                    "name": enrollment.partner_id.name,
                    "status": attendance.status if attendance else None,
                    "late_minutes": (
                        attendance.late_minutes
                        if attendance and attendance.status == "late"
                        else None
                    ),
                }
            )
        return items

    def upsert_attendance(self, items, user=None):
        """Bulk create/update attendance for this day. Each item:
        {trainee_id (enrollment id), status, late_minutes?}. An
        enrollment not actually belonging to this day's program is
        rejected -- no arbitrary participant ID is accepted.
        """
        self.ensure_one()
        user = user or self.env.user
        day = self.with_user(user)
        Attendance = self.env["training.attendance"].with_user(user)
        Enrollment = self.env["training.enrollment"].with_user(user)

        valid_enrollment_ids = set(
            Enrollment.search(
                [
                    ("program_id", "=", day.course_id.program_id.id),
                    ("state", "=", "active"),
                ]
            ).ids
        )

        results = self.env["training.attendance"]
        for item in items or []:
            enrollment_id = item.get("trainee_id")
            if enrollment_id not in valid_enrollment_ids:
                raise ValidationError(
                    _(
                        "Trainee %s is not an active enrollment in this "
                        "training day's program."
                    )
                    % enrollment_id
                )
            status = item.get("status")
            if status not in ("present", "absent", "late"):
                raise ValidationError(_("Invalid attendance status: %s") % status)

            vals = {"status": status}
            vals["late_minutes"] = item.get("late_minutes") or 0 if status == "late" else 0

            existing = Attendance.search(
                [
                    ("training_day_id", "=", day.id),
                    ("enrollment_id", "=", enrollment_id),
                ],
                limit=1,
            )
            if existing:
                existing.write(vals)
                results |= existing
            else:
                vals.update({"training_day_id": day.id, "enrollment_id": enrollment_id})
                results |= Attendance.create(vals)
        return results
