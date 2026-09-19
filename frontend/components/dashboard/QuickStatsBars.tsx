import { useTranslations } from "next-intl";
import { TrendingUpIcon } from "@/components/icons";
import type { Ratio } from "@/lib/dashboard/derive";

/** "Quick statistics" mini bar-comparisons (M5 point 5F). Each ratio is
 * a plain done/total count already derivable from the `days` array the
 * dashboard endpoint returns -- see lib/dashboard/derive.ts. */
export function QuickStatsBars({ items }: { items: { labelKey: string; ratio: Ratio }[] }) {
  const t = useTranslations("Dashboard");

  return (
    <section className="card quick-stats">
      <h2 className="card__title">
        <TrendingUpIcon /> {t("quickStatsTitle")}
      </h2>
      <div className="quick-stats__grid">
        {items.map((item) => {
          const percent = item.ratio.total ? (item.ratio.done / item.ratio.total) * 100 : 0;
          return (
            <div className="quick-stats__item" key={item.labelKey}>
              <div className="quick-stats__bar-track">
                <div className="quick-stats__bar-fill" style={{ height: `${percent}%` }} />
              </div>
              <p className="quick-stats__label">{t(item.labelKey)}</p>
              <p className="quick-stats__value">
                {item.ratio.done} / {item.ratio.total}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
