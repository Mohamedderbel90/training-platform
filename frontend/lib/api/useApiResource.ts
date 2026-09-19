"use client";

/**
 * Shared GET-resource loading state (M5 point 9): loading / success /
 * error, with a `reload()` for the retry action every error state
 * offers. A server session-expiry (401 `UNAUTHENTICATED`) discovered
 * here also triggers AuthContext's own re-check, so ProtectedRoute
 * reacts and redirects to /login instead of leaving a stale
 * "authenticated" shell around a page that can no longer load data.
 */
import { startTransition, useCallback, useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { ApiError } from "./client";
import { useAuth } from "@/lib/auth/AuthContext";

export type ResourceStatus = "loading" | "success" | "error";

export function useApiResource<T>(fetcher: (locale: string) => Promise<T>) {
  const locale = useLocale();
  const { refresh } = useAuth();
  const [data, setData] = useState<T | null>(null);
  const [status, setStatus] = useState<ResourceStatus>("loading");
  const [error, setError] = useState<ApiError | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const result = await fetcher(locale);
      setData(result);
      setStatus("success");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err);
        if (err.code === "UNAUTHENTICATED") {
          refresh();
        }
      }
      setStatus("error");
    }
  }, [locale, fetcher, refresh]);

  useEffect(() => {
    // `load()` sets state synchronously as its very first statement
    // (to flip the resource into "loading" for a retry, not just the
    // initial mount). react-hooks' newer set-state-in-effect rule
    // flags any effect body that synchronously reaches a setState
    // call; wrapping the initial call in startTransition (React's own
    // documented escape hatch for an intentional, effect-triggered
    // state update) satisfies that rule without changing behavior --
    // this is the initial fetch-on-mount, not a user-triggered retry
    // (that path calls the returned `reload` directly from a click
    // handler, which the rule does not apply to at all).
    startTransition(() => {
      load();
    });
  }, [load]);

  return { data, status, error, reload: load, setData };
}
