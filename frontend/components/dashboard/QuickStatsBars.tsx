import { useId } from "react";
import { useTranslations } from "next-intl";
import { TrendingUpIcon } from "@/components/icons";
import { ProgressBar } from "@/components/ProgressBar";
import type { Ratio } from "@/lib/dashboard/derive";

/** "Quick statistics" progress rows (M5 point 5F). Each ratio is a plain
 * done/total count already derivable from the `days` array the
 * dashboard endpoint returns -- see lib/dashboard/derive.ts. A ratio
 * with nothing to measure (total 0) shows a calm "—" and no bar rather
 * than an empty 0/0 track. */
export function QuickStatsBars({ items }: { items: { labelKey: string; ratio: Ratio }[] }) {
  const t = useTranslations("Dashboard");
  const headingId = useId();

  return (
    <section className="card quick-stats" aria-labelledby={headingId}>
      <h2 className="card__title card__title--with-icon" id={headingId}>
        <TrendingUpIcon aria-hidden="true" /> {t("quickStatsTitle")}
      </h2>
      <ul className="quick-stats__list">
        {items.map((item) => {
          const { done, total } = item.ratio;
          const label = t(item.labelKey);
          return (
            <li className="quick-stats__item" key={item.labelKey}>
              <div className="quick-stats__head">
                <span className="quick-stats__label">{label}</span>
                <span className="quick-stats__value">
                  {total > 0 ? t("statRatioValue", { done, total }) : t("statUnavailableValue")}
                </span>
              </div>
              {total > 0 ? (
                <ProgressBar
                  done={done}
                  total={total}
                  label={label}
                  valueText={t("statRatioValue", { done, total })}
                />
              ) : (
                <p className="quick-stats__empty">{t("quickStatEmpty")}</p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
