import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/StateViews";

/** Shown on a role dashboard when the API returns no program and no
 * training days at all: the user is simply not assigned yet. Distinct
 * from "program with no days yet" and from a load error. */
export function NoProgramState() {
  const t = useTranslations("Dashboard");
  return <EmptyState title={t("noProgramTitle")} message={t("noProgramMessage")} />;
}
