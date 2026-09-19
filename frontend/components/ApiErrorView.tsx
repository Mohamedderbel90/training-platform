"use client";

import { useTranslations } from "next-intl";
import type { ApiError } from "@/lib/api/client";
import {
  clientOnlyMessageKey,
  errorTitleKey,
  isClientOnlyError,
} from "@/lib/api/errorMessages";
import { ErrorState } from "./StateViews";

/** Renders any ApiError consistently across the app (M5 point 9): a
 * translated title by error code, the server's own already-localized
 * message (or a client-side translation for the two codes that never
 * reach the server), the request ID for support/diagnostics, and an
 * optional retry action. Never silently swallows an error. */
export function ApiErrorView({
  error,
  onRetry,
}: {
  error: ApiError;
  onRetry?: () => void;
}) {
  const t = useTranslations("Errors");
  const tc = useTranslations("Common");
  const title = t(errorTitleKey(error));
  const message = isClientOnlyError(error)
    ? t(clientOnlyMessageKey(error))
    : error.message;

  return (
    <ErrorState
      title={title}
      message={message}
      requestId={error.requestId}
      actionLabel={onRetry ? tc("retry") : undefined}
      onAction={onRetry}
    />
  );
}
