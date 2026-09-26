"use client";

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
 * reach the server), the request ID for support/diagnostics, and an
 * optional retry action. Never silently swallows an error. */
export function ApiErrorView({
  error,
  onRetry,
  variant = "page",
}: {
  error: ApiError;
  onRetry?: () => void;
  /** `form` is for credential/form surfaces (login, password reset,
   * survey submit) where a 401 or 4xx carries a deliberate, localized
   * server message and "session expired" would be wrong. */
  variant?: "page" | "form";
}) {
  const t = useTranslations("Errors");
  const tc = useTranslations("Common");
  const title = t(errorTitleKey(error));
  const friendlyKey = friendlyMessageKey(error, variant);
  const message = friendlyKey ? t(friendlyKey) : error.message || t("genericMessage");
  const expired = variant === "page" && error.code === "UNAUTHENTICATED";

  return (
    <ErrorState
      title={title}
      message={message}
      requestId={error.requestId}
      actionLabel={onRetry && !expired ? tc("retry") : undefined}
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
