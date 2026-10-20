"use client";

import { useLocale, useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth/AuthContext";
import { useDashboardSummary } from "@/lib/dashboard/useDashboardSummary";
import { formatSessionDateParts, formatTimeRange } from "@/lib/dashboard/format";
import { BackToTrainingDays } from "@/components/BackToTrainingDays";
import { CalendarIcon, ClockIcon, PersonIcon } from "@/components/icons";
import type { OperationalRole } from "@/lib/api/types";

/**
 * Day-identifying context (course, date/time, trainers) plus a "Back to
 * Training Days" link, shown above every per-day action page (trainee
 * survey, supervisor attendance/survey, trainer report -- section 4 of
 * the Training Days unification). None of those pages' own endpoints
 * return the day's course/date (only its survey/attendance status), so
 * this reuses the already-fetched dashboard summary -- the same data
 * Training Days itself lists -- to look the day up by id, rather than
 * inventing a new API response shape. A day no longer present there
 * (e.g. loaded before the dashboard responds) degrades to just the back
 * link and a generic "Training day" label, never a blank header. */
export function DayContextHeader({
  role,
  dayId,
  trainingDaysHref,
}: {
  role: OperationalRole;
  dayId: number;
  trainingDaysHref: string;
}) {
  const b = useTranslations("Breadcrumbs");
  const dash = useTranslations("Dashboard");
  const locale = useLocale();
  const { profile } = useAuth();
  const { data } = useDashboardSummary(role);
  const entry = data?.days.find((day) => day.training_day_id === dayId) ?? null;

  const dateParts = entry?.date ? formatSessionDateParts(entry.date, locale) : null;
  const timeRange = entry ? formatTimeRange(entry.start_datetime, entry.end_datetime, locale, profile?.tz, dash) : null;
  const trainerNames =
    entry?.trainers && entry.trainers.length > 0
      ? entry.trainers.map((trainer) => trainer.name).join(dash("listSeparator"))
      : null;

  return (
    <div className="day-context-header">
      <BackToTrainingDays fallbackHref={trainingDaysHref} />
      <p className="day-context-header__title">{entry?.course_name ?? b("dayFallback")}</p>
      {entry ? (
        <p className="card__meta card__meta--inline day-context-header__facts">
          {dateParts ? (
            <span className="card__fact">
              <CalendarIcon aria-hidden="true" />
              {dateParts.weekday}, {dateParts.day} {dateParts.monthYear}
            </span>
          ) : null}
          {timeRange ? (
            <span className="card__fact">
              <ClockIcon aria-hidden="true" />
              {timeRange}
            </span>
          ) : null}
          {trainerNames ? (
            <span className="card__fact">
              <PersonIcon aria-hidden="true" />
              {trainerNames}
            </span>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
