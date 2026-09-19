import base64
import io

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

    def write(self, vals):
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
        return super().write(vals)

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
    # Generation / approval workflow
    # ------------------------------------------------------------------

    def action_generate(self):
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
            environment_score = kpi.get("environment")

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
            # PROJECT_SPEC section 7.2: Assistant Admin does not, by
            # default, approve final reports.
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
            # approval metadata just set above.
            report._render_report_pdf()
            # PROJECT_SPEC section 17 names "report approval" explicitly
            # as audit-worthy, alongside its own approved_by/approved_date
            # fields (M10: docs/adr/ADR-010-hardening-and-deployment-readiness.md).
            self.env["training.audit.log"]._log(
                "report_approval",
                _("%(report)s was approved by %(user)s.")
                % {"report": report.name, "user": self.env.user.name},
                record=report,
            )
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
                _("Training Environment Score"),
                self.kpi_environment_score
                if self.kpi_environment_score_has_data
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

    def action_export_excel(self):
        self.ensure_one()
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
        row += 2

        sheet.write(row, 0, _("KPI"), bold)
        sheet.write(row, 1, _("Value"), bold)
        row += 1
        for label, value, show in self._kpi_summary_rows():
            if not show:
                continue
            sheet.write(row, 0, label)
            sheet.write(row, 1, round(value, 2) if value is not None else _("No data"))
            row += 1

        row += 1
        sheet.write(row, 0, _("Present"))
        sheet.write(row, 1, self.present_count)
        row += 1
        sheet.write(row, 0, _("Late"))
        sheet.write(row, 1, self.late_count)
        row += 1
        sheet.write(row, 0, _("Absent"))
        sheet.write(row, 1, self.absent_count)

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
