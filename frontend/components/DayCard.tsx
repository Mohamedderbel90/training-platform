"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { DashboardEntryDto, SurveyAvailabilityDto } from "@/lib/api/types";

function dayStateBadgeClass(state: DashboardEntryDto["state"]): string {
  switch (state) {
    case "open":
      return "badge badge--success";
    case "postponed":
      return "badge badge--warning";
    case "cancelled":
      return "badge badge--danger";
    default:
      return "badge";
  }
}

/** Shared training-day summary card frame used by all three
 * dashboards (M5 points 4/5/6) -- only the role-specific body content
 * (survey status, attendance summary, trainer report status, action
 * links) differs, passed in as `children`. */
export function DayCard({ entry, children }: { entry: DashboardEntryDto; children: ReactNode }) {
  const t = useTranslations("Dashboard");
  return (
    <article className="card card--interactive">
      <div className="card__title-row">
        <div>
          <p className="card__title">{entry.course_name}</p>
          <p className="card__meta">{entry.program_name}</p>
          <p className="card__meta">{entry.date ?? t("dateUnknown")}</p>
        </div>
        <span className={dayStateBadgeClass(entry.state)}>{t(`dayState.${entry.state}`)}</span>
      </div>
      <div className="card__body">{children}</div>
    </article>
  );
}

function availabilityBadgeClass(availability?: SurveyAvailabilityDto): string {
  if (!availability?.configured) return "badge";
  const state = availability.response?.state;
  if (state === "submitted") return "badge badge--success";
  if (state === "in_progress") return "badge badge--warning";
  return "badge";
}

/** Status pill for a role's survey/report availability, shared across
 * dashboards. */
export function SurveyAvailabilityBadge({ availability }: { availability?: SurveyAvailabilityDto }) {
  const t = useTranslations("Dashboard");
  if (!availability) return null;
  const label = !availability.configured
    ? t("surveyState.notConfigured")
    : t(`surveyState.${availability.response?.state ?? "not_started"}`);
  return <span className={availabilityBadgeClass(availability)}>{label}</span>;
}
