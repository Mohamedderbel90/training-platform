"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import type { ApiError } from "@/lib/api/client";
import {
  errorTitleKey,
  friendlyMessageKey,
} from "@/lib/api/errorMessages";
import { Link } from "@/i18n/navigation";
import { ErrorState } from "./StateViews";

/** Renders any ApiError consistently across the app (M5 point 9): a
 * translated title by error code, the server's own already-localized
 * message (or a client-side translation for the two codes that never
 * reach the server), and an
 * optional retry action. Never silently swallows an error. */
export function ApiErrorView({
  error,
  onRetry,
  variant = "page",
  headingLevel,
}: {
  error: ApiError;
  onRetry?: () => void;
  /** `form` is for credential/form surfaces (login, password reset,
   * survey submit) where a 401 or 4xx carries a deliberate, localized
   * server message and "session expired" would be wrong. */
  variant?: "page" | "form";
  /** Pass 1 where the error replaces the whole page content and no
   * other h1 is rendered. */
  headingLevel?: 1 | 2 | 3 | 4;
}) {
  const t = useTranslations("Errors");
  const tc = useTranslations("Common");
  const title = t(errorTitleKey(error, variant));
  const friendlyKey = friendlyMessageKey(error, variant);
  const message = friendlyKey ? t(friendlyKey) : error.message || t("genericMessage");
  // The request ID is a diagnostic, not user copy: it is never shown, but
  // stays in the console (and in the server logs via X-Request-ID) so a
  // support report can still be matched to a request.
  useEffect(() => {
    console.error("[api-error]", { code: error.code, status: error.status, requestId: error.requestId });
  }, [error]);
  const expired = variant === "page" && error.code === "UNAUTHENTICATED";
  // Retrying a missing record can only fail again; the page's own
  // "Back to Training Days" link is the way out.
  const retryable = error.code !== "NOT_FOUND";

  return (
    <ErrorState
      headingLevel={headingLevel}
      title={title}
      message={message}
      actionLabel={onRetry && !expired && retryable ? tc("retry") : undefined}
      onAction={onRetry}
      action={
        expired ? (
          <Link className="button" href="/login">
            {t("signIn")}
          </Link>
        ) : undefined
      }
    />
  );
}
