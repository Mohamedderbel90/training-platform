"use client";

import { useLocale, useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth/AuthContext";
import { formatDateTime } from "@/lib/dashboard/format";
import { CheckIcon } from "@/components/icons";

/** Status-only confirmation shown after a final submit (AC-ALN-03 /
 * OPD-01: no answer content is ever rendered back). `submittedAt` is
 * the server's UTC datetime string; shown in the user's own zone. */
export function SubmittedState({ submittedAt }: { submittedAt?: string | null }) {
  const t = useTranslations("Survey");
  const locale = useLocale();
  const { profile } = useAuth();
  return (
    <div className="state-view state-view--success" role="status">
      <span className="state-view__icon">
        <CheckIcon />
      </span>
      <p className="state-view__title">{t("submittedTitle")}</p>
      <p className="state-view__message">{t("submittedMessage")}</p>
      {submittedAt ? (
        <p className="state-view__request-id">
          {t("submittedAt", { date: formatDateTime(submittedAt, locale, profile?.tz) })}
        </p>
      ) : null}
    </div>
  );
}
