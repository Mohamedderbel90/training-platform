"use client";

import type { ComponentType, ReactNode, SVGProps } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { StatusBadge, type StatusTone } from "@/components/StatusBadge";
import { Tooltip } from "@/components/Tooltip";
import {
  CheckIcon,
  ClockIcon,
  CloseIcon,
  DocumentIcon,
  LockIcon,
  PersonIcon,
  SurveyIcon,
  TrendingUpIcon,
  UsersIcon,
} from "@/components/icons";
import { formatDateTime, formatSessionDateParts, formatTimeRange } from "@/lib/dashboard/format";
import { actionWindowStateOf, isDayClosedLike } from "@/lib/dashboard/listControls";
import type {
  AttendanceSummaryDto,
  DashboardEntryDto,
  SurveyAvailabilityDto,
  SurveyResponseStatus,
  TrainingDayStatus,
} from "@/lib/api/types";

function dayStatusTone(status: TrainingDayStatus): StatusTone {
  switch (status) {
    case "open":
      return "success";
    case "postponed":
      return "warning";
    case "cancelled":
      return "danger";
    default:
      return "neutral";
  }
}

/** A small leading glyph per day-status, matching the approved
 * reference's icon-in-pill treatment (lock for a closed-like day, a
 * check for an open one) -- purely decorative styling layered onto the
 * existing, already-correct status tone/label; it invents no new state. */
function dayStatusIcon(status: TrainingDayStatus) {
  switch (status) {
    case "open":
      return <CheckIcon aria-hidden="true" />;
    case "postponed":
      return <ClockIcon aria-hidden="true" />;
    case "cancelled":
      return <CloseIcon aria-hidden="true" />;
    default:
      return <LockIcon aria-hidden="true" />;
  }
}

/** The Training Day lifecycle badge ("Open" / "Closed" / ...). The
 * visible "Day Status" caption was dropped to keep the card lean -- the
 * coloured pill's text already reads on its own in context -- but the
 * caption survives as the badge's accessible name, so screen readers
 * still hear "Day Status: Open" rather than just "Open". */
export function DayStatus({ status, className }: { status: TrainingDayStatus; className?: string }) {
  const t = useTranslations("Dashboard");
  const label = t(`dayState.${status}`);
  return (
    <StatusBadge
      tone={dayStatusTone(status)}
      icon={dayStatusIcon(status)}
      ariaLabel={`${t("dayStatusLabel")}: ${label}`}
      className={className}
    >
      {label}
    </StatusBadge>
  );
}

/** Shared training-day summary card frame used by all three
 * dashboards (M5 points 4/5/6) -- only the role-specific body content
 * (survey status, attendance summary, trainer report status, action
 * links) differs, passed in as `children`. A bordered weekday/day/
 * month date block sits beside the content (matching the approved
 * Training Days reference), and a trainer/time facts line renders
 * whenever the API actually returns that data -- no location/room
 * field exists anywhere in the schema, so none is shown (reported as a
 * limitation rather than invented). `timeZone` is the viewer's own IANA
 * zone (profile.tz); callers pass it down rather than this shared card
 * reading auth context itself, so it keeps working in isolation (e.g.
 * DayCardStatus.test.tsx renders it with no AuthProvider). */
export function DayCard({
  entry,
  children,
  timeZone,
  dayNumber,
}: {
  entry: DashboardEntryDto;
  children: ReactNode;
  timeZone?: string | null;
  /** This day's 1-based position among all days of its own program (see
   * `dayNumbersByProgram` in lib/dashboard/listControls.ts) -- a purely
   * computed display ordinal, not a stored field. Callers derive it
   * from the full, already-fetched `days` array once and pass it down,
   * the same way `timeZone` is threaded through rather than read here. */
  dayNumber: number;
}) {
  const t = useTranslations("Dashboard");
  const locale = useLocale();
  const dateParts = entry.date ? formatSessionDateParts(entry.date, locale) : null;
  const timeRange = formatTimeRange(entry.start_datetime, entry.end_datetime, locale, timeZone, t);
  const trainerNames =
    entry.trainers && entry.trainers.length > 0
      ? entry.trainers.map((trainer) => trainer.name).join(t("listSeparator"))
      : null;
  const topic = entry.topic?.trim() ? entry.topic.trim() : null;
  // Zero-padded ("08" rather than "8"), matching the approved reference --
  // a purely cosmetic formatting tweak, the underlying ordinal is the same
  // real `dayNumber` computed from the fetched days.
  const paddedDayNumber = String(dayNumber).padStart(2, "0");
  const title = topic
    ? t("dayNumberWithTopic", { number: paddedDayNumber, topic })
    : t("dayNumberLabel", { number: paddedDayNumber });

  return (
    <article className="card card--interactive day-card">
      <div className="day-card__layout">
        {dateParts ? (
          <div className="day-card__date">
            <span className="day-card__date-weekday">{dateParts.weekday}</span>
            <span className="day-card__date-day">{dateParts.day}</span>
            <span className="day-card__date-month">{dateParts.monthYear}</span>
          </div>
        ) : null}
        <div className="day-card__main">
          {/* Title/topic/course/facts sit in their own naturally
           * start-aligned (reading-start) text column, with the
           * day-status badge sharing the SAME top row but pinned to the
           * row's opposite end -- matching the approved reference, where
           * the badge sits beside the title rather than stacked above it.
           * Plain flex + `justify-content: space-between` (no
           * row-reverse): DOM order [text, badge] already puts the badge
           * at the physically correct end in both RTL and LTR. */}
          <div className="day-card__top-row">
            <div className="day-card__text">
              <p className="card__title">{title}</p>
              {/* Secondary/meta line -- reuses the styling `program_name`
               * had here before it was removed from the card in a prior
               * session (see DayCardStatus.test.tsx). */}
              <p className="card__meta">{entry.course_name}</p>
              {!dateParts ? <p className="card__meta">{t("dateUnknown")}</p> : null}
              {trainerNames || timeRange ? (
                <p className="card__meta card__meta--inline day-card__facts">
                  {trainerNames ? (
                    <span className="card__fact">
                      <PersonIcon aria-hidden="true" /> {trainerNames}
                    </span>
                  ) : null}
                  {timeRange ? (
                    <span className="card__fact">
                      <ClockIcon aria-hidden="true" /> {timeRange}
                    </span>
                  ) : null}
                </p>
              ) : null}
            </div>
            <DayStatus status={entry.state} className="day-card__status" />
          </div>
          <div className="card__body">{children}</div>
        </div>
      </div>
    </article>
  );
}

/** `"evaluation"` is the supervisor's own daily evaluation survey --
 * same underlying `SurveyAvailabilityDto`/`actionWindowStateOf` plumbing
 * as `"survey"` (the data source, via `kind="survey"` in
 * lib/dashboard/listControls.ts, is unaffected), just distinct button
 * wording so it doesn't read as the trainee's generic "survey" action. */
export type AvailabilityKind = "survey" | "report" | "evaluation";

/** The open/continue/view label keys for each `AvailabilityKind`, so a
 * kind picks a consistent set of labels across all three button states
 * instead of only the "open" case being distinct (see the supervisor's
 * `"evaluation"` kind above). */
const KIND_LABEL_KEYS: Record<AvailabilityKind, { open: string; continue: string; view: string }> = {
  survey: { open: "openSurvey", continue: "continueSurvey", view: "viewSurvey" },
  report: { open: "openReport", continue: "continueReport", view: "viewReport" },
  evaluation: { open: "openEvaluation", continue: "continueEvaluation", view: "viewEvaluation" },
};

/** The accessible section name for each `AvailabilityKind`'s own
 * `.status-group` wrapper (see `SurveyStatusGroup` below), mirroring how
 * `AttendanceStatusGroup` already names its group via `sectionAttendance`
 * -- so a screen-reader user on the supervisor card, where attendance
 * and the evaluation survey sit side by side, hears both groups named
 * instead of just the one that happened to already have a wrapper. */
const SECTION_LABEL_KEYS: Record<AvailabilityKind, string> = {
  survey: "sectionSurvey",
  report: "sectionReport",
  evaluation: "sectionEvaluation",
};

/** A small leading icon per action kind (matching the approved
 * reference's icon-plus-label buttons), reusing existing glyphs from
 * `components/icons.tsx` -- survey/report get a document-like icon,
 * the supervisor's evaluation gets a chart icon, same as the bar-chart
 * glyph the reference's "Evaluation" buttons use. Purely decorative
 * (every usage below passes `aria-hidden`); it changes no behaviour. */
const KIND_ICONS: Record<AvailabilityKind, ComponentType<SVGProps<SVGSVGElement>>> = {
  survey: SurveyIcon,
  report: DocumentIcon,
  evaluation: TrendingUpIcon,
};

function availabilityTone(availability?: SurveyAvailabilityDto): StatusTone {
  if (!availability?.configured) return "neutral";
  const status: SurveyResponseStatus | undefined = availability.response?.state;
  if (status === "submitted") return "success";
  if (status === "in_progress") return "warning";
  return "neutral";
}

/** Status pill for a role's survey/report availability. */
export function SurveyAvailabilityBadge({ availability }: { availability?: SurveyAvailabilityDto }) {
  const t = useTranslations("Dashboard");
  if (!availability) return null;
  const label = !availability.configured
    ? t("surveyState.notConfigured")
    : t(`surveyState.${availability.response?.state ?? "not_started"}`);
  return <StatusBadge tone={availabilityTone(availability)}>{label}</StatusBadge>;
}

/** A same-shaped secondary action that is not actually available right
 * now (day not open yet, day closed/postponed/cancelled, or not
 * configured). Renders a real `<button>` -- never a `Link`, since it
 * must not navigate -- with `aria-disabled="true"` instead of the
 * native `disabled` attribute: `disabled` would drop it from the tab
 * order, hiding its explanation from keyboard and screen-reader users
 * exactly when they need it. The explanation (one of the existing
 * `hint.*` strings) is wired through `Tooltip`'s `aria-describedby`, so
 * it is announced reliably and appears on keyboard focus, not only on
 * mouse hover. */
function DisabledAction({ icon, label, hint }: { icon?: ReactNode; label: string; hint: string }) {
  return (
    <Tooltip content={hint}>
      {(trigger) => (
        <button
          type="button"
          className="button button--secondary button--disabled-look"
          aria-disabled="true"
          {...trigger}
        >
          {icon}
          {label}
        </button>
      )}
    </Tooltip>
  );
}

/** The single action for a role's survey/report on one training day: a
 * real link to open/continue/view it, or -- when it cannot be acted on
 * right now -- a visually-disabled-but-focusable button that explains
 * why via `Tooltip`. Whether an action is offered is decided entirely
 * by the server-supplied `can_submit`/`response.state`; `actionWindowStateOf`
 * (lib/dashboard/listControls.ts) turns that plus the day's own state
 * and window datetimes into one of the six button states (M7 "button-
 * state taxonomy"): not configured, not yet open, actionable, finally
 * submitted (shows the completion date when the API returns one), or a
 * missed deadline (day closed/postponed/cancelled, or the window itself
 * expired while the day stayed "open" -- distinct wording from "not yet
 * open" per that taxonomy's state 5). */
export function SurveyStatusGroup({
  availability,
  dayStatus,
  dateFields,
  href,
  kind = "survey",
  timeZone,
  showSubmittedAt = true,
}: {
  availability?: SurveyAvailabilityDto;
  dayStatus: TrainingDayStatus;
  /** The day's own survey window, needed only to tell "not started yet"
   * apart from "already expired" while the day is still `open` (see
   * `actionWindowStateOf`). Omit to always read as "not yet open" in
   * that ambiguous case. */
  dateFields?: { survey_open_at: string | null; survey_close_at: string | null };
  href: string;
  kind?: AvailabilityKind;
  /** The viewer's own IANA zone (profile.tz), for the completion date
   * shown once submitted; callers pass it down the same way `DayCard`
   * does rather than this component reading auth context itself, so it
   * keeps working in isolation (e.g. in tests with no AuthProvider). */
  timeZone?: string | null;
  /** Show "Submitted on <date>" under a submitted action. The Training
   * Days lists turn it off; the dashboards keep it. */
  showSubmittedAt?: boolean;
}) {
  const t = useTranslations("Dashboard");
  const locale = useLocale();
  if (!availability) return null;

  const labels = KIND_LABEL_KEYS[kind];
  const Icon = KIND_ICONS[kind];
  const sectionLabel = t(SECTION_LABEL_KEYS[kind]);
  const windowState = actionWindowStateOf(
    { state: dayStatus, survey_open_at: dateFields?.survey_open_at ?? null, survey_close_at: dateFields?.survey_close_at ?? null },
    availability,
  );

  if (windowState === "submitted") {
    const submittedAt = availability.response?.submitted_at;
    return (
      <div className="status-group" role="group" aria-label={sectionLabel}>
        <Link className="button button--secondary" href={href}>
          <Icon aria-hidden="true" />
          {t(labels.view)}
        </Link>
        {showSubmittedAt && submittedAt ? (
          <span className="card__meta status-group__completed-at">
            {t("submittedOn", { date: formatDateTime(submittedAt, locale, timeZone) })}
          </span>
        ) : null}
      </div>
    );
  }

  if (windowState === "actionable") {
    const inProgress = availability.response?.state === "in_progress";
    return (
      <div className="status-group" role="group" aria-label={sectionLabel}>
        <Link className="button" href={href}>
          <Icon aria-hidden="true" />
          {t(inProgress ? labels.continue : labels.open)}
        </Link>
      </div>
    );
  }

  const hint =
    windowState === "not_configured"
      ? t("hint.notConfigured")
      : windowState === "missed"
        ? t("hint.missedDeadline")
        : t(`hint.${dayStatus === "planned" ? "planned" : "open"}`);
  return (
    <div className="status-group" role="group" aria-label={sectionLabel}>
      <DisabledAction icon={<Icon aria-hidden="true" />} label={t(labels.open)} hint={hint} />
    </div>
  );
}

/** The three-way label for the supervisor's attendance action, purely
 * from fields the API already returns (`recorded_count`/`total_enrolled`/
 * `complete`) plus the day's own closed-like state -- no new backend
 * data, this only refines which of three existing-shape strings is
 * shown: nothing recorded yet on an open day ("Record attendance"),
 * some but not all recorded ("Continue attendance"), or fully recorded
 * / the day itself is closed-like (read-only -- "View attendance"). */
function attendanceLabelKey(
  attendance: AttendanceSummaryDto,
  dayClosedLike: boolean,
): "recordAttendance" | "continueAttendance" | "viewAttendance" {
  if (dayClosedLike || attendance.complete) return "viewAttendance";
  return attendance.recorded_count === 0 ? "recordAttendance" : "continueAttendance";
}

/** The supervisor's compact attendance action on a day card: a single
 * action link -- no status badge, count text or progress bar, matching
 * how the survey/report cards were already simplified (the link's own
 * label already communicates the state, see `attendanceLabelKey` above).
 * Unlike the survey/report action, attendance has no time window of its
 * own -- it is actionable for the whole time a day is `open` -- but a
 * parallel backend change now rejects attendance writes once a day is
 * `closed`/`postponed`/`cancelled` (mirroring the survey-window gate).
 * Unlike survey/report, there is no "missed deadline" disabled state
 * for attendance: a closed/postponed/cancelled day always offers a
 * real, enabled "View attendance" link (opening the attendance page in
 * read-only mode), whether attendance was fully, partially or never
 * recorded -- an attendance table, even all-blank, is real information
 * worth viewing, unlike a survey/report that was simply never
 * submitted.
 *
 * A `planned` (not yet `open`) day, however, now explicitly disables
 * the action -- confirmed directly by the project owner, mirroring the
 * same `planned` -> `open` boundary the backend's write-rejection
 * already enforces at the day's other edge (no separate
 * `attendance_open_at`/`close_at` field exists, or is needed, for
 * this). Same disabled-look + `Tooltip` pattern as the survey/report
 * actions, reusing the generic `hint.planned` copy ("Not available
 * yet"), since nothing attendance-specific needs saying. */
export function AttendanceStatusGroup({
  attendance,
  dayStatus,
  href,
  primary = false,
}: {
  attendance?: AttendanceSummaryDto;
  dayStatus: TrainingDayStatus;
  href: string;
  /** Force the filled/primary button style even on a "view" action (used
   * by the dashboard's "next session" card to pick which of attendance/
   * evaluation reads as the day's main remaining action). An entry
   * action (record/continue) is always filled regardless of this flag --
   * it only ever needs setting for a view-state action that should still
   * read as the page's primary CTA. */
  primary?: boolean;
}) {
  const t = useTranslations("Dashboard");
  if (!attendance) return null;

  if (dayStatus === "planned") {
    return (
      <div className="status-group" role="group" aria-label={t("sectionAttendance")}>
        <DisabledAction
          icon={<UsersIcon aria-hidden="true" />}
          label={t("recordAttendance")}
          hint={t("hint.planned")}
        />
      </div>
    );
  }

  const dayClosedLike = isDayClosedLike(dayStatus);
  const labelKey = attendanceLabelKey(attendance, dayClosedLike);
  // Entry actions (record/continue) are always the filled primary
  // button; only a "view" action can ever render outlined, and even
  // then stays filled when the caller explicitly marks it `primary`.
  const filled = primary || labelKey !== "viewAttendance";

  return (
    <div className="status-group" role="group" aria-label={t("sectionAttendance")}>
      <Link className={`button${filled ? "" : " button--secondary"}`} href={href}>
        <UsersIcon aria-hidden="true" />
        {t(labelKey)}
      </Link>
    </div>
  );
}
