import { useLocale, useTranslations } from "next-intl";
import { BookIcon, ChevronDownIcon } from "@/components/icons";
import { formatProgramRange } from "@/lib/dashboard/format";
import type { DashboardProgramDto } from "@/lib/api/types";

/** Header "current program" box (M5 point 3 HEADER). Informational
 * only, deliberately: the Operational API has no "switch active
 * program" endpoint, so the chevron below is purely decorative (matching
 * the approved header's look) and never opens anything -- there is
 * nothing to switch to (M5 point 5B explicitly forbids a non-functional
 * selector that suggests otherwise). `topbar` selects the approved
 * header's own variant (chevron, no icon tile); the plain variant
 * (icon tile, no chevron) is kept for any future non-header reuse. */
export function ProgramInfoBox({
  program,
  topbar,
}: {
  program: DashboardProgramDto | null;
  topbar?: boolean;
}) {
  const t = useTranslations("Dashboard");
  const locale = useLocale();

  if (!program) return null;

  return (
    <div className={`program-info-box${topbar ? " program-info-box--topbar" : ""}`}>
      {topbar ? null : (
        <span className="program-info-box__icon">
          <BookIcon />
        </span>
      )}
      <span className="program-info-box__text">
        <span className="program-info-box__label">{t("programCurrentLabel")}</span>
        <span className="program-info-box__name">{program.name}</span>
        <span className="program-info-box__dates">
          {formatProgramRange(program.start_date, program.end_date, locale)}
        </span>
      </span>
      {topbar ? (
        <ChevronDownIcon className="program-info-box__chevron" aria-hidden="true" />
      ) : null}
    </div>
  );
}
