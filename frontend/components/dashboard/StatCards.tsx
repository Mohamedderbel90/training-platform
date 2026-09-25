import { useTranslations } from "next-intl";
import { BookIcon, ClockIcon, TrendingUpIcon, UsersIcon } from "@/components/icons";
import type { DashboardStatsDto } from "@/lib/api/types";

/** The four top stat tiles (M5 point 5C). Every value comes straight
 * from the backend-computed `stats` block (training.day.
 * get_dashboard_summary()) -- no hard-coded sample numbers, and a
 * `null` `stats`/`progress_percent` renders an honest "not available"
 * state instead of a misleading zero. Tint/tone pairing and icon-start
 * row layout match the approved reference. */
export function StatCards({ stats }: { stats: DashboardStatsDto | null }) {
  const t = useTranslations("Dashboard");

  if (!stats) {
    return <p className="dashboard-note">{t("statsUnavailable")}</p>;
  }

  const progress = stats.progress_percent;
  const hours = Number.isInteger(stats.training_hours)
    ? String(stats.training_hours)
    : stats.training_hours.toFixed(1);
  const items = [
    {
      icon: ClockIcon,
      tone: "primary" as const,
      value: hours,
      label: t("statHours"),
    },
    {
      icon: UsersIcon,
      tone: "accent" as const,
      value: String(stats.training_days_count),
      label: t("statDays"),
    },
    {
      icon: BookIcon,
      tone: "accent" as const,
      value: String(stats.courses_count),
      label: t("statCourses"),
    },
  ];

  return (
    <div className="stat-grid">
      {items.map((item) => (
        <article className={`stat-card stat-card--tint-${item.tone}`} key={item.label}>
          <span className={`stat-card__icon stat-card__icon--${item.tone}`}>
            <item.icon />
          </span>
          <span className="stat-card__text">
            <span className="stat-card__value">{item.value}</span>
            <span className="stat-card__label">{item.label}</span>
          </span>
        </article>
      ))}
      <article className="stat-card stat-card--progress">
        <span className="stat-card__icon stat-card__icon--primary">
          <TrendingUpIcon />
        </span>
        <span className="stat-card__text">
          <span className="stat-card__value">
            {progress == null ? t("statProgressUnavailable") : `${progress}%`}
          </span>
          <span className="stat-card__label">{t("statProgress")}</span>
        </span>
        {progress != null ? (
          <span
            className="stat-card__ring"
            style={{ ["--stat-ring-value" as string]: `${progress}%` }}
            aria-hidden="true"
          />
        ) : null}
      </article>
    </div>
  );
}
