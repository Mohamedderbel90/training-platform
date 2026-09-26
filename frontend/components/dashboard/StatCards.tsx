import type { ComponentType, SVGProps } from "react";
import { useTranslations } from "next-intl";
import { BookIcon, ClockIcon, TrendingUpIcon, UsersIcon } from "@/components/icons";
import { ProgressBar } from "@/components/ProgressBar";
import type { DashboardStatsDto } from "@/lib/api/types";
import type { Ratio } from "@/lib/dashboard/derive";

interface StatCardModel {
  key: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  tone: "primary" | "accent";
  label: string;
  /** null = unavailable: rendered as a calm dash, never as 0. */
  value: string | null;
  support: string;
  ratio?: Ratio | null;
  ratioLabel?: string;
  ring?: number | null;
  primary?: boolean;
}

function StatCard({ model, t }: { model: StatCardModel; t: ReturnType<typeof useTranslations> }) {
  const { ratio } = model;
  const showBar = ratio != null && ratio.total > 0;
  return (
    <article
      className={`stat-card stat-card--tint-${model.tone}${model.primary ? " stat-card--primary" : ""}${
        model.value == null ? " stat-card--unavailable" : ""
      }`}
    >
      <div className="stat-card__row">
        <span className={`stat-card__icon stat-card__icon--${model.tone}`}>
          <model.icon />
        </span>
        <span className="stat-card__text">
          <span className="stat-card__value">{model.value ?? t("statUnavailableValue")}</span>
          <span className="stat-card__label">{model.label}</span>
        </span>
        {model.ring != null ? (
          <span
            className="stat-card__ring"
            style={{ ["--stat-ring-value" as string]: `${model.ring}%` }}
            aria-hidden="true"
          />
        ) : null}
      </div>
      <p className="stat-card__support">{model.support}</p>
      {showBar ? (
        <ProgressBar
          done={ratio.done}
          total={ratio.total}
          label={model.ratioLabel ?? model.label}
          valueText={t("statRatioValue", { done: ratio.done, total: ratio.total })}
        />
      ) : null}
    </article>
  );
}

/** The four top stat tiles (M5 point 5C). Every value comes straight
 * from the backend-computed `stats` block (training.day.
 * get_dashboard_summary()) -- no hard-coded sample numbers. The
 * completion rate is the primary stat; hours/days/courses are secondary.
 * `daysRatio`/`coursesRatio` are optional done/total counts derived from
 * the same `days` payload (lib/dashboard/derive.ts) and add a labelled
 * progress bar only where a real ratio exists. A `null` `stats` /
 * `progress_percent` renders a calm "—" with a reason instead of a
 * misleading zero. */
export function StatCards({
  stats,
  daysRatio,
  coursesRatio,
}: {
  stats: DashboardStatsDto | null;
  daysRatio?: Ratio | null;
  coursesRatio?: Ratio | null;
}) {
  const t = useTranslations("Dashboard");

  const progress = stats?.progress_percent ?? null;
  const unavailable = t("statNotAvailableYet");
  const hours = stats
    ? Number.isInteger(stats.training_hours)
      ? String(stats.training_hours)
      : stats.training_hours.toFixed(1)
    : null;

  const ratioSupport = (ratio: Ratio | null | undefined, fallback: string) =>
    ratio && ratio.total > 0 ? t("statRatioSupport", { done: ratio.done, total: ratio.total }) : fallback;

  const items: StatCardModel[] = [
    {
      key: "progress",
      icon: TrendingUpIcon,
      tone: "primary",
      label: t("statProgress"),
      value: progress == null ? null : `${progress}%`,
      support: !stats
        ? unavailable
        : progress == null
          ? t("statProgressUnavailableReason")
          : daysRatio && daysRatio.total > 0
            ? t("statProgressRatio", { done: daysRatio.done, total: daysRatio.total })
            : t("statProgressSupport"),
      ring: progress,
      primary: true,
    },
    {
      key: "days",
      icon: UsersIcon,
      tone: "accent",
      label: t("statDays"),
      value: stats ? String(stats.training_days_count) : null,
      support: stats ? ratioSupport(daysRatio, t("statDaysSupport")) : unavailable,
      ratio: stats ? daysRatio : null,
      ratioLabel: t("statDaysBarLabel"),
    },
    {
      key: "courses",
      icon: BookIcon,
      tone: "accent",
      label: t("statCourses"),
      value: stats ? String(stats.courses_count) : null,
      support: stats ? ratioSupport(coursesRatio, t("statCoursesSupport")) : unavailable,
      ratio: stats ? coursesRatio : null,
      ratioLabel: t("statCoursesBarLabel"),
    },
    {
      key: "hours",
      icon: ClockIcon,
      tone: "primary",
      label: t("statHours"),
      value: hours,
      support: stats ? t("statHoursSupport") : unavailable,
    },
  ];

  return (
    <section className="stats-section" aria-label={t("statsRegionLabel")}>
      <div className="stat-grid">
        {items.map((model) => (
          <StatCard key={model.key} model={model} t={t} />
        ))}
      </div>
      {!stats ? <p className="dashboard-note">{t("statsUnavailable")}</p> : null}
    </section>
  );
}
