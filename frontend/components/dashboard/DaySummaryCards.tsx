import type { ComponentType, SVGProps } from "react";
import { useTranslations } from "next-intl";
import { CalendarIcon, CheckIcon, ClockIcon } from "@/components/icons";

interface SummaryCardModel {
  key: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  tone: "accent" | "primary" | "info";
  value: number;
  label: string;
  support: string;
}

/** The three Training Days summary tiles (Total / Completed / Upcoming),
 * matching the approved reference. Every count comes from the already
 * -fetched `days` array (see lib/dashboard/listControls.ts `dayGroupOf`)
 * -- no second API call, no duplicated backend formula. Visually reuses
 * the existing `.stat-card` family (components/dashboard/StatCards.tsx)
 * rather than a second card style; this page always needs exactly these
 * three counts, which don't fit `DashboardStatsDto`'s shape, so it is a
 * separate small component instead of a StatCards variant. */
export function DaySummaryCards({
  total,
  completed,
  upcoming,
}: {
  total: number;
  completed: number;
  upcoming: number;
}) {
  const t = useTranslations("Dashboard");

  const items: SummaryCardModel[] = [
    {
      key: "total",
      icon: CalendarIcon,
      tone: "accent",
      value: total,
      label: t("statTotalDays"),
      support: t("statTotalDaysSupport"),
    },
    {
      key: "completed",
      icon: CheckIcon,
      tone: "primary",
      value: completed,
      label: t("statCompletedDays"),
      support: t("statCompletedDaysSupport"),
    },
    {
      key: "upcoming",
      icon: ClockIcon,
      tone: "info",
      value: upcoming,
      label: t("statUpcomingDays"),
      support: t("statUpcomingDaysSupport"),
    },
  ];

  return (
    <section className="stats-section" aria-label={t("daysStatsRegionLabel")}>
      {/* Explicitly labelled as program-wide and separate from the
       * toolbar's filtered "X of Y" result count (point 12 of the
       * Training Days toolbar refinement): these three counts always come
       * from the full, unfiltered `days` array (see the caller), so they
       * never change as search/filters narrow the list below -- the
       * heading makes that fact visible instead of leaving it implicit. */}
      <h2 className="stats-section__heading visually-hidden">{t("programStatsHeading")}</h2>
      {/* `stat-card--compact` (globals.css): a denser 88-96px tile with a
       * 36px icon and no explanatory support line underneath the number
       * -- label + number only, so the first training-day card below sits
       * closer to the top of the page. */}
      <div className="stat-grid stat-grid--three">
        {items.map((item) => (
          <article key={item.key} className={`stat-card stat-card--tint-${item.tone} stat-card--compact`}>
            <div className="stat-card__row">
              <span className={`stat-card__icon stat-card__icon--${item.tone}`}>
                <item.icon />
              </span>
              <span className="stat-card__text">
                <span className="stat-card__value">{item.value}</span>
                <span className="stat-card__label">{item.label}</span>
                <span className="stat-card__support">{item.support}</span>
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
