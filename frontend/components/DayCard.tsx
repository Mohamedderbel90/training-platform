"use client";

import { useId, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { StatusBadge, type StatusTone } from "@/components/StatusBadge";
import { formatDate } from "@/lib/dashboard/format";
import type {
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

/** Labelled primary status of the Training Day lifecycle ("Day Status:
 * Open"). The text label keeps the meaning independent of colour. */
export function DayStatus({ status }: { status: TrainingDayStatus }) {
  const t = useTranslations("Dashboard");
  return (
    <dl className="status-line status-line--day" aria-label={t("sectionTrainingDay")}>
      <dt>{t("dayStatusLabel")}</dt>
      <dd>
        <StatusBadge tone={dayStatusTone(status)}>{t(`dayState.${status}`)}</StatusBadge>
      </dd>
    </dl>
  );
}

/** Shared training-day summary card frame used by all three
 * dashboards (M5 points 4/5/6) -- only the role-specific body content
 * (survey status, attendance summary, trainer report status, action
 * links) differs, passed in as `children`. */
export function DayCard({ entry, children }: { entry: DashboardEntryDto; children: ReactNode }) {
  const t = useTranslations("Dashboard");
  const locale = useLocale();
  return (
    <article className="card card--interactive">
      <div className="card__title-row">
        <div>
          <p className="card__title">{entry.course_name}</p>
          <p className="card__meta">{entry.program_name}</p>
          <p className="card__meta">{entry.date ? formatDate(entry.date, locale) : t("dateUnknown")}</p>
        </div>
        <DayStatus status={entry.state} />
      </div>
      <div className="card__body">{children}</div>
    </article>
  );
}

export type AvailabilityKind = "survey" | "report";

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

/** The secondary, personal-progress group of a day card: "Survey /
 * Survey Status: <status> / [action]" (or "Report ..." for the trainer).
 * Whether the action is offered is decided by the server-supplied
 * `can_submit`; the day status only picks the wording of the hint shown
 * instead of the action. */
export function SurveyStatusGroup({
  availability,
  dayStatus,
  href,
  kind = "survey",
}: {
  availability?: SurveyAvailabilityDto;
  dayStatus: TrainingDayStatus;
  href: string;
  kind?: AvailabilityKind;
}) {
  const t = useTranslations("Dashboard");
  const titleId = useId();
  if (!availability) return null;

  const responseStatus = availability.response?.state ?? "not_started";
  const submitted = availability.configured && responseStatus === "submitted";
  const canAct = availability.configured && availability.can_submit;
  const isReport = kind === "report";

  let action: ReactNode = null;
  let hint: string | null = null;
  if (submitted) {
    action = (
      <Link className="button button--secondary" href={href}>
        {t(isReport ? "viewReport" : "viewSurvey")}
      </Link>
    );
  } else if (canAct) {
    const inProgress = responseStatus === "in_progress";
    action = (
      <Link className="button" href={href}>
        {t(inProgress ? (isReport ? "continueReport" : "continueSurvey") : isReport ? "openReport" : "openSurvey")}
      </Link>
    );
  } else if (!availability.configured) {
    hint = t("hint.notConfigured");
  } else {
    hint = t(`hint.${dayStatus}`);
  }

  return (
    <div className="status-group" role="group" aria-labelledby={titleId}>
      <p className="status-group__title" id={titleId}>
        {t(isReport ? "sectionReport" : "sectionSurvey")}
      </p>
      <dl className="status-line">
        <dt>{t(isReport ? "reportStatusLabel" : "surveyStatusLabel")}</dt>
        <dd>
          <StatusBadge tone={availabilityTone(availability)} icon={submitted ? " ✓" : undefined}>
            {!availability.configured ? t("surveyState.notConfigured") : t(`surveyState.${responseStatus}`)}
          </StatusBadge>
        </dd>
      </dl>
      {action}
      {hint ? <p className="status-group__hint">{hint}</p> : null}
    </div>
  );
}
