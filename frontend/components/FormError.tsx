"use client";

import { useEffect, useRef } from "react";
import type { ApiError } from "@/lib/api/client";
import { ApiErrorView } from "@/components/ApiErrorView";

/** A failed form submission's error (ApiErrorView, `form` variant, with
 * request id). Keyboard/screen-reader focus moves to it whenever a new
 * error object arrives, so the failure is never missed. Renders nothing
 * when there is no error. */
export function FormError({
  error,
  onRetry,
}: {
  error: ApiError | null;
  onRetry?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error) ref.current?.focus();
  }, [error]);
  if (!error) return null;
  return (
    <div className="form-error" tabIndex={-1} ref={ref}>
      <ApiErrorView error={error} onRetry={onRetry} variant="form" />
    </div>
  );
}
