/** Shared mock for "next/navigation" -- only `useSearchParams` is used
 * anywhere in this app (the login page's `returnTo` query param, and the
 * list pages' URL-backed search/filter state). Subscribers are notified
 * when the params change so components re-render like they would after a
 * real `router.replace`. */
import { useSyncExternalStore } from "react";

let params = new URLSearchParams();
const listeners = new Set<() => void>();

export function __setMockSearchParams(next: Record<string, string> | URLSearchParams) {
  params = new URLSearchParams(next);
  listeners.forEach((l) => l());
}

export function __getMockSearchParams() {
  return params;
}

export function useSearchParams() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => params,
    () => params,
  );
}
