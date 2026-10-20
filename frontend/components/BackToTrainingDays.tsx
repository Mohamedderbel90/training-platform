"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ChevronIcon } from "@/components/icons";

/** Only ever return into this same app, never to an absolute/external
 * URL (the value ultimately comes from a query string the browser
 * controls) -- same hardening as ProtectedRoute's own returnTo check. */
function isSafeReturnPath(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//");
}

/**
 * "Back to Training Days" link shown on every per-day action subpage
 * (trainee survey, supervisor attendance/survey, trainer report --
 * section 4 of the Training Days unification). Training Days list
 * links into these pages with the list's own current URL (filters +
 * card/calendar view mode, all in the query string already thanks to
 * `useListControls`) appended as `?from=...`; reading it back here and
 * using it as the destination is what "restores the exact filters and
 * view mode" means in practice, with no extra client state needed. A
 * direct/bookmarked visit with no `from` falls back to the role's own
 * Training Days page.
 */
export function BackToTrainingDays({ fallbackHref }: { fallbackHref: string }) {
  const t = useTranslations("Common");
  const searchParams = useSearchParams();
  const from = searchParams?.get("from") ?? null;
  const href = from && isSafeReturnPath(from) ? from : fallbackHref;
  return (
    <Link href={href} className="back-link">
      <ChevronIcon className="back-link__icon" aria-hidden="true" />
      {t("backToTrainingDays")}
    </Link>
  );
}
