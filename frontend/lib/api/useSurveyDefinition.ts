"use client";

/**
 * Loads a survey definition once `enabled`, exposing a real `retry()`
 * (re-runs the request; the previous error is cleared only when the
 * new request starts, so a failed definition load can never leave the
 * page on an endless spinner). A 401 also triggers the AuthContext
 * re-check so ProtectedRoute redirects to login.
 */
import { useCallback, useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { ApiError } from "./client";
import { useAuth } from "@/lib/auth/AuthContext";
import type { SurveyDefinitionDto } from "./types";

export function useSurveyDefinition(
  fetcher: (locale: string) => Promise<SurveyDefinitionDto>,
  enabled: boolean,
) {
  const locale = useLocale();
  const { refresh } = useAuth();
  const [definition, setDefinition] = useState<SurveyDefinitionDto | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    fetcher(locale)
      .then((def) => {
        if (!cancelled) setDefinition(def);
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

  return { definition, error, retry };
}
