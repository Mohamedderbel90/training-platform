import { useId, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { DayStatus } from "@/components/DayCard";
import { EmptyState } from "@/components/StateViews";
import { ClockIcon, PersonIcon } from "@/components/icons";
import { formatSessionDateParts, formatTimeRange } from "@/lib/dashboard/format";
import { useAuth } from "@/lib/auth/AuthContext";
import type { DashboardEntryDto } from "@/lib/api/types";

/** Purely decorative arch/book thumbnail above the date block, matching
 * the approved reference's composition. No matching illustration asset
 * exists among the approved uploads (only the Hero Banner photo,
 * sidebar decor and logo are present) -- this is an inline-SVG
 * recreation, not a crop of an unrelated asset. */
function UpcomingSessionThumb() {
  return (
    <svg
      className="upcoming-session__thumb"
      viewBox="0 0 236 92"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <pattern id="upcomingSessionLattice" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M0 0 20 20M20 0 0 20" stroke="#3f7565" strokeWidth="0.6" opacity="0.55" fill="none" />
        </pattern>
      </defs>
      <rect width="236" height="92" fill="#e9dfc7" />
      <rect x="0" width="84" height="92" fill="url(#upcomingSessionLattice)" />
      <rect x="152" width="84" height="92" fill="url(#upcomingSessionLattice)" />
      <rect x="84" width="6" height="92" fill="#c9a86a" opacity="0.4" />
      <rect x="146" width="6" height="92" fill="#c9a86a" opacity="0.4" />
      <path
        d="M91 92V58C91 45 98 34 107 29 112 26 115 24 118 19 121 24 124 26 129 29 138 34 145 45 145 58V92Z"
        fill="#f3ead4"
        stroke="#b3924f"
        strokeWidth="1.6"
      />
      <path d="M118 27v-6" stroke="#b3924f" strokeWidth="1.6" strokeLinecap="round" />
      <path
        d="M114 21 118 15l4 6"
        fill="none"
        stroke="#b3924f"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <g transform="translate(118 70)">
        <path
          d="M-15 -6C-10.2 -9.4 -4.8 -9.4 0 -5.7c4.8 -3.7 10.2 -3.7 15 -0.3V9.5C10.2 5.8 4.8 5.8 0 9.2c-4.8 -3.4 -10.2 -3.4 -15 0.3Z"
          fill="#ffffff"
          stroke="#4a3c22"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path d="M0 -5.7v14.9" stroke="#4a3c22" strokeWidth="1.4" />
        <path d="M-11 -3.4 -3 -1.8M-11 0.4 -3 2M-11 4.2 -3 5.8" stroke="#c9a86a" strokeWidth="0.6" opacity="0.8" />
        <path d="M11 -3.4 3 -1.8M11 0.4 3 2M11 4.2 3 5.8" stroke="#c9a86a" strokeWidth="0.6" opacity="0.8" />
      </g>
      <path d="M107 92v-8c0-4 5-6 11-6s11 2 11 6v8Z" fill="#3d3120" opacity="0.85" />
    </svg>
  );
}

/** The "next training day" card (M5 point 5D). Only fields the API
 * actually returns are shown -- no location/room, since training.day
 * has no such field anywhere in the schema (reported as a limitation
 * rather than invented). */
export function UpcomingSessionCard({
  entry,
  surveyGroup,
  action,
  hasDays = true,
}: {
  entry: DashboardEntryDto | null;
  /** Status/action groups (Survey, Attendance, Report), each rendered
   * as its own labelled panel under the session facts. */
  surveyGroup?: ReactNode;
  action?: ReactNode;
  /** false = the user has no training days at all yet (distinct from
   * "none upcoming"). */
  hasDays?: boolean;
}) {
  const t = useTranslations("Dashboard");
  const locale = useLocale();
  const { profile } = useAuth();
  const headingId = useId();

  if (!entry) {
    return (
      <section className="card upcoming-session" aria-labelledby={headingId}>
        <h2 className="card__title" id={headingId}>
          {t("upcomingSessionTitle")}
        </h2>
        <EmptyState
          title={hasDays ? t("noUpcomingSessionTitle") : t("tasksNoDaysTitle")}
          message={hasDays ? t("noUpcomingSessionMessage") : t("noDaysSessionMessage")}
        />
      </section>
    );
  }

  const dateParts = formatSessionDateParts(entry.date, locale);
  const timeRange = formatTimeRange(
    entry.start_datetime,
    entry.end_datetime,
    locale,
    profile?.tz,
    t,
  );
  const trainerNames = entry.trainers?.map((trainer) => trainer.name).join(t("listSeparator"));

  return (
    <section className="card upcoming-session" aria-labelledby={headingId}>
      <div className="upcoming-session__title-row">
        <h2 className="card__title" id={headingId}>
          {t("upcomingSessionTitle")}
        </h2>
        <DayStatus status={entry.state} />
      </div>
      <div className="upcoming-session__body">
        {dateParts ? (
          <div className="upcoming-session__left">
            <UpcomingSessionThumb />
            <div className="upcoming-session__date">
              <span className="upcoming-session__weekday">{dateParts.weekday}</span>
              <span className="upcoming-session__day">{dateParts.day}</span>
              <span className="upcoming-session__month">{dateParts.monthYear}</span>
            </div>
          </div>
        ) : null}
        <div className="upcoming-session__info">
          <p className="upcoming-session__course" title={entry.course_name}>
            {entry.course_name}
          </p>
          <p className="card__meta">{entry.program_name}</p>
          <p className="card__meta card__meta--inline">
            {timeRange ? (
              <span className="upcoming-session__fact">
                <ClockIcon /> {timeRange}
              </span>
            ) : null}
            {trainerNames ? (
              <span className="upcoming-session__fact">
                <PersonIcon /> {trainerNames}
              </span>
            ) : null}
          </p>
        </div>
      </div>
      {surveyGroup || action ? (
        <div className="upcoming-session__actions">
          {surveyGroup}
          {action ? <div className="button-row button-row--tight">{action}</div> : null}
        </div>
      ) : null}
    </section>
  );
}
