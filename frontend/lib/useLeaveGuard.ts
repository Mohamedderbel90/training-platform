"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Warns before the user leaves a page that holds unsaved edits. UX only --
 * nothing is sent to the server.
 *
 * - Closing/reloading the tab uses the browser's own `beforeunload` prompt.
 * - Clicking an in-app link is intercepted (the App Router has no
 *   route-change blocking API) and handed to the caller as `pendingHref`
 *   so it can show its own confirmation; `confirmLeave` then performs the
 *   navigation, `stay` cancels it.
 */
export function useLeaveGuard(active: boolean) {
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const leaving = useRef(false);

  useEffect(() => {
    if (!active) return;
    const warn = (event: BeforeUnloadEvent) => {
      if (leaving.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const onClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || (anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      event.preventDefault();
      event.stopPropagation();
      setPendingHref(url.pathname + url.search + url.hash);
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", onClick, true);
    };
  }, [active]);

  const confirmLeave = useCallback(() => {
    if (!pendingHref) return;
    leaving.current = true;
    window.location.assign(pendingHref);
  }, [pendingHref]);

  const stay = useCallback(() => setPendingHref(null), []);

  return { pendingHref, confirmLeave, stay };
}
