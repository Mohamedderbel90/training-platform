from odoo import _, api, fields, models
from odoo.exceptions import AccessError, UserError, ValidationError
from odoo.tools import format_date

SURVEY_ROLE_FIELDS = {
    "trainee_survey_id": "trainee",
    "supervisor_survey_id": "supervisor",
    "trainer_survey_id": "trainer",
}


class TrainingDay(models.Model):
    _name = "training.day"
    _description = "Training Day"
    _order = "date, start_datetime"

    course_id = fields.Many2one(
        "training.course",
        string="Course",
        required=True,
        ondelete="restrict",
    )
    date = fields.Date(required=True)
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
    supervisor_id = fields.Many2one(
        "res.users",
        string="Supervisor",
        required=True,
    )
    # Direct Many2many for V1; no training.trainer.assignment model.
    trainer_ids = fields.Many2many(
        "res.users",
        "training_day_trainer_rel",
        "day_id",
        "user_id",
        string="Trainers",
    )
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

    @api.constrains("start_datetime", "end_datetime")
    def _check_datetimes(self):
        for day in self:
            if day.end_datetime <= day.start_datetime:
                raise ValidationError(
                    "The end time must be after the start time for training "
                    "day on %s." % day.date
                )

    @api.constrains("survey_open_at", "survey_close_at")
    def _check_survey_window(self):
        for day in self:
            if day.survey_close_at <= day.survey_open_at:
                raise ValidationError(
                    "The survey close time must be after the survey open "
                    "time for training day on %s." % day.date
                )

    def unlink(self):
        for day in self:
            if day.state != "planned":
                raise UserError(
                    "Only planned training days can be deleted. Archive or "
                    "cancel the training day on %s instead." % day.date
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
        # section 17 lists it as audit-worthy); allowed here, but no
        # audit trail exists yet -- see ADR-004 and the M3 report.
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
        return super().write(vals)

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
        for day in self:
            self.env["training.audit.log"]._log(
                "day_reopen",
                _("Training day on %s was reopened by %s.")
                % (day.date, self.env.user.name),
                record=day,
            )

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

    def _check_role_ownership(self, role, user):
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
            enrollment = (
                self.env["training.enrollment"]
                .with_user(user)
                .search(
                    [
                        ("program_id", "=", self.course_id.program_id.id),
                        ("partner_id", "=", user.partner_id.id),
                    ],
                    limit=1,
                )
            )
            if not enrollment:
                raise AccessError(
                    _("You are not enrolled in this training day's program.")
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

    def get_survey_definition_dto(self, role, user=None):
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
        day._check_role_ownership(role, user)
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

    def get_dashboard(self, role, user=None):
        """Dashboard listing for ``role``: every training.day accessible
        to ``user``, scoped entirely by the M1 record rules on
        training.day (no duplicate ownership filtering here)."""
        user = user or self.env.user
        days = self.with_user(user).search([], order="date desc, start_datetime desc")
        return [day._build_dashboard_entry(role, user) for day in days]

    def get_dashboard_summary(self, role, user=None):
        """Dashboard home aggregates (welcome/stat-card/next-session
        blocks): the same ``days`` list get_dashboard() already returns,
        plus a "current program" snapshot, plain counts derived from it,
        and the nearest upcoming session -- all computed from data
        already scoped by the M1 record rules, with no new stored KPI
        and no formula duplicated out of training.analytics (M5 point
        7/8). ``program``/``stats``/``next_session`` are None when the
        user has no accessible training days at all, never a misleading
        zeroed-out block.
        """
        user = user or self.env.user
        days = self.with_user(user).search([], order="date desc, start_datetime desc")
        entries = [day._build_dashboard_entry(role, user) for day in days]

        program = None
        stats = None
        next_session = None

        if days:
            today = fields.Date.context_today(self)
            # `days` is ordered date desc, so within the filtered subset
            # the nearest upcoming day is the LAST element, not the first.
            upcoming = days.filtered(
                lambda d: d.state in ("planned", "open") and d.date and d.date >= today
            )
            current_day = upcoming[-1] if upcoming else days[0]
            current_program = current_day.course_id.program_id

            if current_program:
                program_days = days.filtered(
                    lambda d: d.course_id.program_id.id == current_program.id
                )
                training_days_count = len(program_days)
                closed_count = len(
                    program_days.filtered(lambda d: d.state == "closed")
                )
                training_hours = sum(
                    (d.end_datetime - d.start_datetime).total_seconds() / 3600.0
                    for d in program_days
                    if d.start_datetime and d.end_datetime
                )
                stats = {
                    "courses_count": len(program_days.mapped("course_id")),
                    "training_days_count": training_days_count,
                    "training_hours": round(training_hours, 1),
                    "progress_percent": (
                        round((closed_count / training_days_count) * 100.0, 1)
                        if training_days_count
                        else None
                    ),
                }
                program = {
                    "id": current_program.id,
                    "name": current_program.name,
                    "start_date": fields.Date.to_string(current_program.start_date),
                    "end_date": fields.Date.to_string(current_program.end_date),
                }

            if upcoming:
                next_session = current_day._build_dashboard_entry(role, user)
                # Trainer identity is ordinary scheduling info (who is
                # teaching a given day), not a sensitive survey answer,
                # so it is safe to expose to every role viewing the day.
                next_session["trainers"] = [
                    {"id": trainer.id, "name": trainer.name}
                    for trainer in current_day.trainer_ids
                ]

        return {
            "days": entries,
            "program": program,
            "stats": stats,
            "next_session": next_session,
        }

    def _build_dashboard_entry(self, role, user):
        self.ensure_one()
        entry = {
            "training_day_id": self.id,
            "course_id": self.course_id.id,
            "program_id": self.course_id.program_id.id,
            "date": fields.Date.to_string(self.date) if self.date else None,
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
        total_enrolled = (
            self.env["training.enrollment"]
            .with_user(user)
            .search_count([("program_id", "=", self.course_id.program_id.id)])
        )
        recorded = (
            self.env["training.attendance"]
            .with_user(user)
            .search_count([("training_day_id", "=", self.id)])
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
