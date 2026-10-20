import base64
import io
import re
from collections import Counter, OrderedDict

import xlsxwriter

from odoo import _, api, fields, models
from odoo.exceptions import AccessError, UserError, ValidationError

# Fields that define what a report covers. Once a report has been
# generated (state != 'draft'), these cannot be changed in place --
# PROJECT_SPEC section 15 / DEVELOPMENT_PLAN M8: "New changes create a
# new version." action_new_version() is the only sanctioned way to
# change them after generation.
FILTER_FIELDS = {
    "report_type",
    "program_id",
    "course_id",
    "date_from",
    "date_to",
    "show_trainer_score",
    "show_content_score",
    "show_environment_score",
    "show_attendance",
    "show_response_rate",
    "show_summary",
    "show_comparison",
    "show_comments",
}

# Attachment pointers are system-managed (set only by _render_report_pdf()/
# action_export_excel(), never edited directly by a user) and are exempt
# from the approved-immutability lock: regenerating the PDF that reflects
# an already-approved snapshot's own stored numbers, or exporting those
# same stored numbers to Excel, does not alter any approved data.
SYSTEM_MANAGED_FIELDS = {"pdf_attachment_id", "excel_attachment_id"}


class TrainingReport(models.Model):
    _name = "training.report"
    _description = "Training Program/Course Report"
    _order = "create_date desc"

    name = fields.Char(compute="_compute_name", store=True)
    report_type = fields.Selection(
        selection=[("course", "Course Report"), ("program", "Program Report")],
        required=True,
        default="course",
    )
    program_id = fields.Many2one(
        "training.program", string="Program", required=True, ondelete="restrict"
    )
    course_id = fields.Many2one(
        "training.course",
        string="Course",
        ondelete="restrict",
        domain="[('program_id', '=', program_id)]",
    )
    date_from = fields.Date(string="Period From")
    date_to = fields.Date(string="Period To")
    # Snapshot of the actually-resolved period (explicit date_from/date_to,
    # or the course/program's own dates when left blank), set once at
    # action_generate() time so the PDF/Excel output and this field never
    # disagree about which period a generated report actually covers.
    resolved_date_from = fields.Date(readonly=True)
    resolved_date_to = fields.Date(readonly=True)

    state = fields.Selection(
        selection=[
            ("draft", "Draft"),
            ("generated", "Generated"),
            ("approved", "Approved"),
        ],
        required=True,
        default="draft",
    )
    active = fields.Boolean(default=True)

    # ---- versioning (mirrors survey.survey's version_no/previous_version_id
    # pattern from ADR-003) ----
    version_no = fields.Integer(default=1, required=True)
    previous_report_id = fields.Many2one(
        "training.report", string="Previous Version", readonly=True
    )
    next_version_ids = fields.One2many(
        "training.report", "previous_report_id", string="Newer Versions"
    )

    generated_date = fields.Datetime(readonly=True)
    approved_by = fields.Many2one("res.users", readonly=True)
    approved_date = fields.Datetime(readonly=True)

    # ---- filters / show-hide report sections ----
    show_trainer_score = fields.Boolean(default=True)
    show_content_score = fields.Boolean(default=True)
    show_environment_score = fields.Boolean(default=True)
    show_attendance = fields.Boolean(default=True)
    show_response_rate = fields.Boolean(default=True)
    # DEC-23: BRD 11.1/11.2 narrative sections. Each can be hidden before
    # export (FR-064).
    show_summary = fields.Boolean(
        string="Executive Summary", default=True,
        help="Training days covered, highest indicators (strengths) and "
        "lowest indicators (opportunities).",
    )
    show_comparison = fields.Boolean(
        string="Comparison and Trend", default=True,
        help="Day comparison and trend for a course report; course "
        "comparison and trend for a program report.",
    )
    show_comments = fields.Boolean(
        string="Notes and Recommendations", default=True,
        help="Free-text answers of the supervisor, trainers and trainees "
        "(without identity) and repeated comments.",
    )

    # ---- KPI snapshot, computed once at action_generate() time and never
    # recomputed live. A companion "*_has_data" boolean is used everywhere
    # instead of relying on the Float value itself, because a stored 0.0
    # would otherwise be indistinguishable from "no valid data" (the same
    # null-vs-zero pitfall ADR-004 documents for training.analytics; a
    # snapshot must not lose that distinction either). ----
    kpi_trainer_score = fields.Float(string="Trainer Score", readonly=True)
    kpi_trainer_score_has_data = fields.Boolean(readonly=True)
    kpi_content_score = fields.Float(string="Content Score", readonly=True)
    kpi_content_score_has_data = fields.Boolean(readonly=True)
    kpi_environment_score = fields.Float(string="Environment Score", readonly=True)
    kpi_environment_score_has_data = fields.Boolean(readonly=True)
    # DEC-21: environment is two separate indicators; kpi_environment_score
    # above is the trainees' indicator, this one the supervisor's.
    kpi_environment_supervisor_score = fields.Float(
        string="Training Environment Score (Supervisor)", readonly=True
    )
    kpi_environment_supervisor_score_has_data = fields.Boolean(readonly=True)
    # DEC-23 snapshot of the narrative/comparison sections, computed once
    # at generation time like every other figure (null-safe, never live).
    narrative_json = fields.Json(readonly=True, copy=False)

    present_count = fields.Integer(readonly=True)
    late_count = fields.Integer(readonly=True)
    absent_count = fields.Integer(readonly=True)
    total_attendance_count = fields.Integer(readonly=True)
    attendance_rate = fields.Float(readonly=True)
    attendance_rate_has_data = fields.Boolean(readonly=True)
    absence_rate = fields.Float(readonly=True)
    absence_rate_has_data = fields.Boolean(readonly=True)
    late_rate = fields.Float(readonly=True)
    late_rate_has_data = fields.Boolean(readonly=True)

    response_rate = fields.Float(readonly=True)
    response_rate_has_data = fields.Boolean(readonly=True)

    pdf_attachment_id = fields.Many2one(
        "ir.attachment", string="PDF Document", readonly=True, copy=False
    )
    excel_attachment_id = fields.Many2one(
        "ir.attachment", string="Excel Export", readonly=True, copy=False
    )

    @api.depends("report_type", "program_id.name", "course_id.name", "version_no")
    def _compute_name(self):
        for report in self:
            if report.report_type == "course" and report.course_id:
                base = report.course_id.name
            else:
                base = report.program_id.name
            report.name = _("%(base)s Report (v%(version)s)") % {
                "base": base or _("Untitled"),
                "version": report.version_no,
            }

    @api.constrains("report_type", "course_id", "program_id")
    def _check_course_required(self):
        for report in self:
            if report.report_type == "course" and not report.course_id:
                raise ValidationError(
                    _("A course report must reference a course.")
                )
            if report.course_id and report.course_id.program_id != report.program_id:
                raise ValidationError(
                    _("The selected course does not belong to the selected program.")
                )

    @api.constrains("date_from", "date_to")
    def _check_dates(self):
        for report in self:
            if report.date_from and report.date_to and report.date_to < report.date_from:
                raise ValidationError(
                    _("The report period's end date cannot precede its start date.")
                )

    # ------------------------------------------------------------------
    # Immutability / versioning enforcement
    # ------------------------------------------------------------------

    @api.model_create_multi
    def create(self, vals_list):
        # Approval/generation are workflow transitions (action_generate /
        # action_approve, audited in write()); a report can never be
        # *created* already generated/approved or with approval stamps,
        # which would forge an approved report without the audit trail.
        if not self.env.su:
            for vals in vals_list:
                if (
                    vals.get("state", "draft") != "draft"
                    or vals.get("approved_by")
                    or vals.get("approved_date")
                ):
                    raise AccessError(
                        _("A report can only be created as a draft.")
                    )
        return super().create(vals_list)

    def write(self, vals):
        approving = self.browse()
        if vals.get("state") == "approved":
            approving = self.filtered(lambda report: report.state != "approved")
        if approving and not self.env.su:
            # PROJECT_SPEC section 7.1/15: only the General Supervisor
            # approves. Enforced on the write itself, not just in
            # action_approve(), so no other user can set state='approved'
            # directly.
            if not self.env.user.has_group(
                "training_management.group_training_admin"
            ):
                raise AccessError(
                    _("Only the General Supervisor/Admin can approve a report.")
                )
            if any(report.state != "generated" for report in approving):
                raise UserError(_("Only a generated report can be approved."))
            # Approver/timestamp are always recorded (FR-080/081), even
            # for a direct write that did not supply them.
            vals = dict(vals)
            # Always the effective user/now: never client-supplied.
            vals["approved_by"] = self.env.user.id
            vals["approved_date"] = fields.Datetime.now()
        elif not self.env.su and {"approved_by", "approved_date"} & set(vals):
            raise AccessError(
                _("Approval details can only be set by approving the report.")
            )
        if not self.env.su:
            touched = set(vals.keys())
            locked_touched = touched - SYSTEM_MANAGED_FIELDS
            for report in self:
                if report.state == "approved" and locked_touched:
                    raise UserError(
                        _(
                            "%s is an approved report and is immutable. "
                            "Create a new version instead of editing it."
                        )
                        % report.name
                    )
                if report.state == "generated" and (FILTER_FIELDS & touched):
                    raise UserError(
                        _(
                            "%s has already been generated; its scope/filters "
                            "cannot be changed in place. Create a new version "
                            "instead."
                        )
                        % report.name
                    )
        result = super().write(vals)
        # PROJECT_SPEC section 17: report approval is audit-worthy.
        # Logged on the state transition itself so a direct write of
        # state='approved' cannot skip the audit trail.
        for report in approving:
            self.env["training.audit.log"]._log(
                "report_approval",
                _("%(report)s was approved by %(user)s.")
                % {"report": report.name, "user": self.env.user.name},
                record=report,
            )
        return result

    def unlink(self):
        for report in self:
            if report.state != "draft":
                raise UserError(
                    _(
                        "Only draft reports can be deleted. Archive %s instead."
                    )
                    % report.name
                )
        return super().unlink()

    def action_new_version(self):
        """Create a new draft version linked to this one, per
        PROJECT_SPEC section 15: "Re-generation after changes creates a
        new version." The source report (generated or approved) is left
        completely untouched -- only a new record is created."""
        self.ensure_one()
        new_report = self.copy(
            {
                "version_no": self.version_no + 1,
                "previous_report_id": self.id,
                "state": "draft",
                "generated_date": False,
                "resolved_date_from": False,
                "resolved_date_to": False,
                "approved_by": False,
                "approved_date": False,
                "pdf_attachment_id": False,
                "excel_attachment_id": False,
                "kpi_trainer_score": 0.0,
                "kpi_trainer_score_has_data": False,
                "kpi_content_score": 0.0,
                "kpi_content_score_has_data": False,
                "kpi_environment_score": 0.0,
                "kpi_environment_score_has_data": False,
                "kpi_environment_supervisor_score": 0.0,
                "kpi_environment_supervisor_score_has_data": False,
                "narrative_json": False,
                "present_count": 0,
                "late_count": 0,
                "absent_count": 0,
                "total_attendance_count": 0,
                "attendance_rate": 0.0,
                "attendance_rate_has_data": False,
                "absence_rate": 0.0,
                "absence_rate_has_data": False,
                "late_rate": 0.0,
                "late_rate_has_data": False,
                "response_rate": 0.0,
                "response_rate_has_data": False,
            }
        )
        return {
            "type": "ir.actions.act_window",
            "res_model": "training.report",
            "view_mode": "form",
            "res_id": new_report.id,
        }

    # ------------------------------------------------------------------
    # Scope resolution (reuses training.analytics -- PROJECT_SPEC
    # section 14: "Analytics logic lives in Odoo services... not
    # re-derived elsewhere.")
    # ------------------------------------------------------------------

    def _resolve_dates(self):
        self.ensure_one()
        if self.date_from and self.date_to:
            return self.date_from, self.date_to
        if self.report_type == "course" and self.course_id:
            return self.course_id.start_date, self.course_id.end_date
        return self.program_id.start_date, self.program_id.end_date

    def _get_scope_kwargs(self):
        """{'program': recordset} or {'course': recordset} depending on
        report_type -- never both, so course-report scope is not
        additionally narrowed by a redundant program filter."""
        self.ensure_one()
        if self.report_type == "course":
            return {"course": self.course_id}
        return {"program": self.program_id}

    # ------------------------------------------------------------------
    # Narrative / comparison sections (DEC-23, BRD 11.1 and 11.2)
    # ------------------------------------------------------------------

    NARRATIVE_KPI_KEYS = (
        "trainer_performance",
        "content",
        "environment",
        "environment_supervisor",
    )

    def _narrative_labels(self):
        return {
            "trainer_performance": _("Trainer Score"),
            "content": _("Content Score"),
            "environment": _("Training Environment Score (Trainees)"),
            "environment_supervisor": _("Training Environment Score (Supervisor)"),
            "attendance_rate": _("Attendance Rate (%)"),
        }

    def _narrative_role_label(self, role):
        return {
            "trainee": _("Trainees (anonymous)"),
            "supervisor": _("Supervisor"),
            "trainer": _("Trainers"),
        }.get(role, role or "-")

    def _period_figures(self, analytics, label, date_from, date_to, scope):
        return analytics.get_period_figures(label, date_from, date_to, scope)

    @staticmethod
    def _trend(values):
        """Last period minus first period among periods that have data
        (DEC-20); None when fewer than two periods have data."""
        present = [v for v in values if v is not None]
        if len(present) < 2:
            return None
        return round(present[-1] - present[0], 2)

    def _collect_comments(self, analytics, days):
        """Free-text answers of final responses, grouped by respondent
        role and question; no identity is read or stored (DEC-15)."""
        responses = analytics._survey_input_model().search(
            [("training_day_id", "in", days.ids), ("state", "=", "done")]
        )
        groups = OrderedDict()
        all_texts = []
        for response in responses.sorted("id"):
            for line in response.user_input_line_ids:
                if line.skipped:
                    continue
                if line.answer_type == "char_box":
                    text = line.value_char_box
                elif line.answer_type == "text_box":
                    text = line.value_text_box
                else:
                    continue
                text = (text or "").strip()
                if not text:
                    continue
                key = (response.respondent_role or "", line.question_id.title or "")
                groups.setdefault(key, []).append(text)
                all_texts.append(text)
        normalized = Counter(
            re.sub(r"\s+", " ", text).strip().lower() for text in all_texts
        )
        first_seen = {}
        for text in all_texts:
            first_seen.setdefault(re.sub(r"\s+", " ", text).strip().lower(), text)
        repeated = [
            {"text": first_seen[norm], "count": count}
            for norm, count in normalized.most_common()
            if count >= 2
        ]
        return {
            "withheld": False,
            "groups": [
                {"role": role, "question": question, "answers": answers}
                for (role, question), answers in groups.items()
            ],
            "repeated": repeated,
        }

    def _build_narrative(self, date_from, date_to, overall):
        """Snapshot for the BRD 11.1/11.2 sections. ``overall`` carries the
        already-computed report-level indicators (value or None)."""
        self.ensure_one()
        analytics = self.env["training.analytics"]
        scope = self._get_scope_kwargs()
        days = analytics._resolve_days(date_from=date_from, date_to=date_to, **scope)

        if self.report_type == "course":
            kind = "day"
            periods = [
                self._period_figures(
                    analytics, fields.Date.to_string(day.date), None, None, {"day": day}
                )
                for day in days.sorted(lambda d: (d.date, d.id))
            ]
        else:
            kind = "course"
            periods = [
                self._period_figures(
                    analytics, course.name, date_from, date_to, {"course": course}
                )
                for course in self.program_id.course_ids.sorted(
                    lambda c: (c.sequence, c.start_date, c.id)
                )
            ]

        available = [
            (key, overall[key]) for key in self.NARRATIVE_KPI_KEYS
            if overall.get(key) is not None
        ]
        highlights = {"highest": None, "lowest": None}
        if len(available) >= 2:
            highest = max(available, key=lambda kv: kv[1])
            lowest = min(available, key=lambda kv: kv[1])
            highlights = {
                "highest": {"key": highest[0], "value": round(highest[1], 2)},
                "lowest": {"key": lowest[0], "value": round(lowest[1], 2)},
            }

        # Comments are individual trainee detail territory (BR-008, D-14):
        # only the General Supervisor's generation collects them.
        can_read_comments = self.env.su or self.env.user.has_group(
            "training_management.group_training_admin"
        )
        if can_read_comments:
            comments = self._collect_comments(analytics, days)
        else:
            comments = {"withheld": True, "groups": [], "repeated": []}

        return {
            "days_count": len(days),
            "highlights": highlights,
            "comparison": {"kind": kind, "rows": periods},
            "trend": {
                key: self._trend([row[key] for row in periods])
                for key in self.NARRATIVE_KPI_KEYS + ("attendance_rate",)
            },
            "comments": comments,
        }

    # ------------------------------------------------------------------
    # Generation / approval workflow
    # ------------------------------------------------------------------

    def _check_general_supervisor(self):
        """DEC-15: reports are produced and exported by the General
        Supervisor only."""
        if not self.env.su and not self.env.user.has_group(
            "training_management.group_training_admin"
        ):
            raise AccessError(
                _("Only the General Supervisor can generate or export reports.")
            )

    def action_generate(self):
        self._check_general_supervisor()
        analytics = self.env["training.analytics"]
        for report in self:
            if report.state == "approved":
                raise UserError(
                    _(
                        "%s is approved and immutable. Create a new version "
                        "to regenerate it."
                    )
                    % report.name
                )
            date_from, date_to = report._resolve_dates()
            scope = report._get_scope_kwargs()

            kpi = analytics.get_kpi(date_from=date_from, date_to=date_to, **scope)
            attendance = analytics.get_attendance_metrics(
                date_from=date_from, date_to=date_to, **scope
            )
            response_rate = analytics.get_trainee_response_rate(
                date_from=date_from, date_to=date_to, **scope
            )

            trainer_score = kpi.get("trainer_performance")
            content_score = kpi.get("content")
            environment_score = analytics.get_kpi(
                date_from=date_from, date_to=date_to, categories=("environment",),
                respondent_role="trainee", **scope
            )["environment"]
            environment_supervisor_score = analytics.get_kpi(
                date_from=date_from, date_to=date_to, categories=("environment",),
                respondent_role="supervisor", **scope
            )["environment"]

            report.write(
                {
                    "state": "generated",
                    "generated_date": fields.Datetime.now(),
                    "resolved_date_from": date_from,
                    "resolved_date_to": date_to,
                    "kpi_trainer_score": trainer_score or 0.0,
                    "kpi_trainer_score_has_data": trainer_score is not None,
                    "kpi_content_score": content_score or 0.0,
                    "kpi_content_score_has_data": content_score is not None,
                    "kpi_environment_score": environment_score or 0.0,
                    "kpi_environment_score_has_data": environment_score is not None,
                    "kpi_environment_supervisor_score": environment_supervisor_score
                    or 0.0,
                    "kpi_environment_supervisor_score_has_data": (
                        environment_supervisor_score is not None
                    ),
                    "narrative_json": report._build_narrative(
                        date_from,
                        date_to,
                        {
                            "trainer_performance": trainer_score,
                            "content": content_score,
                            "environment": environment_score,
                            "environment_supervisor": environment_supervisor_score,
                        },
                    ),
                    "present_count": attendance["present_count"],
                    "late_count": attendance["late_count"],
                    "absent_count": attendance["absent_count"],
                    "total_attendance_count": attendance["total_count"],
                    "attendance_rate": attendance["attendance_rate"] or 0.0,
                    "attendance_rate_has_data": attendance["attendance_rate"]
                    is not None,
                    "absence_rate": attendance["absence_rate"] or 0.0,
                    "absence_rate_has_data": attendance["absence_rate"] is not None,
                    "late_rate": attendance["late_rate"] or 0.0,
                    "late_rate_has_data": attendance["late_rate"] is not None,
                    "response_rate": response_rate or 0.0,
                    "response_rate_has_data": response_rate is not None,
                }
            )
            report._render_report_pdf()
        return True

    def action_approve(self):
        if not self.env.user.has_group("training_management.group_training_admin"):
            # PROJECT_SPEC section 7.1: only the General Supervisor approves.
            raise AccessError(
                _("Only the General Supervisor/Admin can approve a report.")
            )
        for report in self:
            if report.state != "generated":
                raise UserError(_("Only a generated report can be approved."))
            report.write(
                {
                    "state": "approved",
                    "approved_by": self.env.user.id,
                    "approved_date": fields.Datetime.now(),
                }
            )
            # Re-render so the PDF's visual approval stamp reflects the
            # approval metadata just set above. The audit entry
            # (PROJECT_SPEC section 17) is written by write() on the
            # state transition itself.
            report._render_report_pdf()
        return True

    # ------------------------------------------------------------------
    # PDF / Excel output
    # ------------------------------------------------------------------

    def _render_report_pdf(self):
        self.ensure_one()
        old_attachment = self.pdf_attachment_id
        pdf_content, _report_type = self.env["ir.actions.report"]._render_qweb_pdf(
            "training_management.action_report_training_report", res_ids=self.id
        )
        attachment = self.env["ir.attachment"].create(
            {
                "name": "%s.pdf" % self.name,
                "type": "binary",
                "datas": base64.b64encode(pdf_content),
                "res_model": self._name,
                "res_id": self.id,
                "mimetype": "application/pdf",
            }
        )
        self.write({"pdf_attachment_id": attachment.id})
        if old_attachment:
            old_attachment.unlink()

    def action_view_pdf(self):
        self.ensure_one()
        if not self.pdf_attachment_id:
            raise UserError(_("No PDF has been generated yet."))
        return {
            "type": "ir.actions.act_url",
            "url": "/web/content/%s" % self.pdf_attachment_id.id,
            "target": "new",
        }

    def _kpi_summary_rows(self):
        """[(label, value|None, show)] used by both the QWeb template and
        the Excel export, so the two never drift apart."""
        self.ensure_one()
        return [
            (
                _("Trainer Score"),
                self.kpi_trainer_score if self.kpi_trainer_score_has_data else None,
                self.show_trainer_score,
            ),
            (
                _("Content Score"),
                self.kpi_content_score if self.kpi_content_score_has_data else None,
                self.show_content_score,
            ),
            (
                _("Training Environment Score (Trainees)"),
                self.kpi_environment_score
                if self.kpi_environment_score_has_data
                else None,
                self.show_environment_score,
            ),
            (
                _("Training Environment Score (Supervisor)"),
                self.kpi_environment_supervisor_score
                if self.kpi_environment_supervisor_score_has_data
                else None,
                self.show_environment_score,
            ),
            (
                _("Attendance Rate (%)"),
                self.attendance_rate if self.attendance_rate_has_data else None,
                self.show_attendance,
            ),
            (
                _("Absence Rate (%)"),
                self.absence_rate if self.absence_rate_has_data else None,
                self.show_attendance,
            ),
            (
                _("Late Rate (%)"),
                self.late_rate if self.late_rate_has_data else None,
                self.show_attendance,
            ),
            (
                _("Survey Response Rate (%)"),
                self.response_rate if self.response_rate_has_data else None,
                self.show_response_rate,
            ),
        ]

    def _write_narrative_to_sheet(self, sheet, bold, row):
        """Same narrative sections as the PDF (DEC-23), same show/hide
        toggles, written from the stored snapshot."""
        nar = self.narrative_json or {}
        labels = self._narrative_labels()
        if self.show_summary and nar:
            row += 1
            sheet.write(row, 0, _("Executive Summary"), bold)
            row += 1
            sheet.write(row, 0, _("Training days covered"))
            sheet.write(row, 1, nar.get("days_count", 0))
            row += 1
            for title, item in (
                (_("Strength (highest indicator)"), nar["highlights"]["highest"]),
                (_("Opportunity (lowest indicator)"), nar["highlights"]["lowest"]),
            ):
                if item:
                    sheet.write(row, 0, title)
                    sheet.write(
                        row, 1, "%s: %s" % (labels[item["key"]], item["value"])
                    )
                    row += 1
        if self.show_comparison and nar:
            comparison = nar["comparison"]
            row += 1
            sheet.write(
                row, 0,
                _("Day Comparison") if comparison["kind"] == "day"
                else _("Course Comparison"),
                bold,
            )
            row += 1
            keys = list(self.NARRATIVE_KPI_KEYS) + ["attendance_rate"]
            sheet.write(row, 0, "", bold)
            for col, key in enumerate(keys, start=1):
                sheet.write(row, col, labels[key], bold)
            row += 1
            for period in comparison["rows"]:
                sheet.write(row, 0, period["label"])
                for col, key in enumerate(keys, start=1):
                    value = period[key]
                    sheet.write(
                        row, col, round(value, 2) if value is not None else _("No data")
                    )
                row += 1
            sheet.write(row, 0, _("Trend (last minus first)"), bold)
            for col, key in enumerate(keys, start=1):
                value = nar["trend"].get(key)
                sheet.write(
                    row, col, value if value is not None else _("No data")
                )
            row += 1
        if self.show_comments and nar:
            comments = nar["comments"]
            row += 1
            sheet.write(row, 0, _("Notes and Recommendations"), bold)
            row += 1
            if comments["withheld"]:
                sheet.write(
                    row, 0,
                    _("Withheld: comments are collected only when the General "
                      "Supervisor generates the report."),
                )
                row += 1
            for group in comments["groups"]:
                for answer in group["answers"]:
                    sheet.write(row, 0, self._narrative_role_label(group["role"]))
                    sheet.write(row, 1, group["question"])
                    sheet.write(row, 2, answer)
                    row += 1
            if comments["repeated"]:
                row += 1
                sheet.write(row, 0, _("Repeated comments (identical wording)"), bold)
                row += 1
                for item in comments["repeated"]:
                    sheet.write(row, 0, item["count"])
                    sheet.write(row, 1, item["text"])
                    row += 1
        return row

    def action_export_excel(self):
        self.ensure_one()
        self._check_general_supervisor()
        if self.state == "draft":
            raise UserError(_("Generate the report before exporting it."))

        output = io.BytesIO()
        workbook = xlsxwriter.Workbook(output, {"in_memory": True})
        sheet = workbook.add_worksheet(_("Report")[:31])
        bold = workbook.add_format({"bold": True})

        row = 0
        sheet.write(row, 0, self.name, bold)
        row += 1
        sheet.write(row, 0, _("Program"))
        sheet.write(row, 1, self.program_id.name)
        row += 1
        if self.course_id:
            sheet.write(row, 0, _("Course"))
            sheet.write(row, 1, self.course_id.name)
            row += 1
        sheet.write(row, 0, _("Period"))
        sheet.write(
            row,
            1,
            "%s - %s" % (self.resolved_date_from or "", self.resolved_date_to or ""),
        )
        row += 1
        sheet.write(row, 0, _("Version"))
        sheet.write(row, 1, self.version_no)
        row += 1
        if self.state == "approved":
            # Same approval block the PDF stamp carries (BRD FR-067/FR-082).
            sheet.write(row, 0, _("Approved by"))
            sheet.write(
                row,
                1,
                "%s - %s" % (self.approved_by.name or "", self.approved_date or ""),
            )
            row += 1
        row += 1

        sheet.write(row, 0, _("KPI"), bold)
        sheet.write(row, 1, _("Value"), bold)
        row += 1
        for label, value, show in self._kpi_summary_rows():
            if not show:
                continue
            sheet.write(row, 0, label)
            sheet.write(row, 1, round(value, 2) if value is not None else _("No data"))
            row += 1

        # Attendance counts follow the same show_attendance toggle as
        # the PDF's Attendance section, so both outputs stay in parity.
        if self.show_attendance:
            row += 1
            for label, value in (
                (_("Present"), self.present_count),
                (_("Late"), self.late_count),
                (_("Absent"), self.absent_count),
                (_("Total"), self.total_attendance_count),
            ):
                sheet.write(row, 0, label)
                sheet.write(row, 1, value)
                row += 1

        row = self._write_narrative_to_sheet(sheet, bold, row)

        workbook.close()
        output.seek(0)
        content = output.read()
        output.close()

        old_attachment = self.excel_attachment_id
        attachment = self.env["ir.attachment"].create(
            {
                "name": "%s.xlsx" % self.name,
                "type": "binary",
                "datas": base64.b64encode(content),
                "res_model": self._name,
                "res_id": self.id,
                "mimetype": (
                    "application/vnd.openxmlformats-officedocument"
                    ".spreadsheetml.sheet"
                ),
            }
        )
        self.write({"excel_attachment_id": attachment.id})
        if old_attachment:
            old_attachment.unlink()

        return {
            "type": "ir.actions.act_url",
            "url": "/web/content/%s?download=true" % attachment.id,
            "target": "self",
        }
