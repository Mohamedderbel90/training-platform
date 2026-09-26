"use client";

import { useLocale, useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth/AuthContext";
import { formatDateTime } from "@/lib/dashboard/format";
import { CheckIcon } from "@/components/icons";

/** Status-only confirmation shown after a final submit (AC-ALN-03 /
 * OPD-01: no answer content is ever rendered back). `submittedAt` is
 * the server's UTC datetime string; shown in the user's own zone. */
export function SubmittedState({
  submittedAt,
  headingLevel = 2,
}: {
  submittedAt?: string | null;
  /** 1 when this confirmation is the whole page (no PageHeader above it),
   * so the page still has an h1; 2 (default) when nested under one. */
  headingLevel?: 1 | 2;
}) {
  const t = useTranslations("Survey");
  const locale = useLocale();
  const { profile } = useAuth();
  const Heading = headingLevel === 1 ? "h1" : "h2";
  return (
    <div className="state-view state-view--success" role="status">
      <span className="state-view__icon">
        <CheckIcon />
      </span>
      <Heading className="state-view__title">{t("submittedTitle")}</Heading>
      <p className="state-view__message">{t("submittedMessage")}</p>
      {submittedAt ? (
        <p className="state-view__request-id">
          {t("submittedAt", { date: formatDateTime(submittedAt, locale, profile?.tz) })}
        </p>
      ) : null}
    </div>
  );
}
