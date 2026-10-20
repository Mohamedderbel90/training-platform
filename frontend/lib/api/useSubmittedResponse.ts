"use client";

/**
 * Loads the trainee's own submitted response (definition + answers) once
 * `enabled`, with the same retry/401 behaviour as `useSurveyDefinition`.
 * Read-only: used by the trainee day page once the survey is submitted.
 */
import { useCallback, useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { ApiError } from "./client";
import { useAuth } from "@/lib/auth/AuthContext";
import type { TraineeSubmittedResponseDto } from "./types";

export function useSubmittedResponse(
  fetcher: (locale: string) => Promise<TraineeSubmittedResponseDto>,
  enabled: boolean,
) {
  const locale = useLocale();
  const { refresh } = useAuth();
  const [response, setResponse] = useState<TraineeSubmittedResponseDto | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    fetcher(locale)
      .then((data) => {
        if (!cancelled) setResponse(data);
      })
      .catch((err) => {
        if (cancelled || !(err instanceof ApiError)) return;
        setError(err);
        if (err.code === "UNAUTHENTICATED") refresh();
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, fetcher, locale, attempt, refresh]);

  const retry = useCallback(() => {
    setError(null);
    setAttempt((n) => n + 1);
  }, []);

  return { response, error, retry };
}
