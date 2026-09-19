import { useLocale, useTranslations } from "next-intl";
import { BookIcon } from "@/components/icons";
import { formatProgramRange } from "@/lib/dashboard/format";
import type { DashboardProgramDto } from "@/lib/api/types";

/** Header "current program" box (M5 point 3 HEADER). Informational
 * only, deliberately: the Operational API has no "switch active
 * program" endpoint, so this never renders a selector/chevron that
 * would suggest a switching action that does not exist (M5 point 5B
 * explicitly forbids a non-functional selector). */
export function ProgramInfoBox({ program }: { program: DashboardProgramDto | null }) {
  const t = useTranslations("Dashboard");
  const locale = useLocale();

  if (!program) return null;

  return (
    <div className="program-info-box">
      <span className="program-info-box__icon">
        <BookIcon />
      </span>
      <span className="program-info-box__text">
        <span className="program-info-box__label">{t("programCurrentLabel")}</span>
        <span className="program-info-box__name">{program.name}</span>
        <span className="program-info-box__dates">
          {formatProgramRange(program.start_date, program.end_date, locale)}
        </span>
      </span>
    </div>
  );
}
