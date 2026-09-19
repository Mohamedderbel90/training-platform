import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ClockIcon, PersonIcon } from "@/components/icons";
import { formatSessionDateParts, formatTimeRange } from "@/lib/dashboard/format";
import type { DashboardEntryDto } from "@/lib/api/types";

/** The "next training day" card (M5 point 5D). Only fields the API
 * actually returns are shown -- no location/room, since training.day
 * has no such field anywhere in the schema (reported as a limitation
 * rather than invented). */
export function UpcomingSessionCard({
  entry,
  statusBadge,
  action,
}: {
  entry: DashboardEntryDto | null;
  statusBadge?: ReactNode;
  action?: ReactNode;
}) {
  const t = useTranslations("Dashboard");
  const locale = useLocale();

  if (!entry) {
    return (
      <section className="card upcoming-session">
        <h2 className="card__title">{t("upcomingSessionTitle")}</h2>
        <p className="card__meta">{t("noUpcomingSessionMessage")}</p>
      </section>
    );
  }

  const dateParts = formatSessionDateParts(entry.date, locale);
  const timeRange = formatTimeRange(entry.start_datetime, entry.end_datetime, locale);
  const trainerNames = entry.trainers?.map((trainer) => trainer.name).join(t("listSeparator"));

  return (
    <section className="card upcoming-session">
      <div className="upcoming-session__title-row">
        <h2 className="card__title">{t("upcomingSessionTitle")}</h2>
        {statusBadge}
      </div>
      <div className="upcoming-session__body">
        {dateParts ? (
          <div className="upcoming-session__date">
            <span className="upcoming-session__weekday">{dateParts.weekday}</span>
            <span className="upcoming-session__day">{dateParts.day}</span>
            <span className="upcoming-session__month">{dateParts.monthYear}</span>
          </div>
        ) : null}
        <div className="upcoming-session__info">
          <p className="card__title">{entry.course_name}</p>
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
          {action ? <div className="button-row button-row--tight">{action}</div> : null}
        </div>
      </div>
    </section>
  );
}
