"use client";

import { useEffect, useState } from "react";
import { CheckIcon } from "@/components/icons";

/** Polite inline success message (`role="status"`). The live region is
 * always mounted so assistive tech announces the text when it appears.
 * `stamp` identifies one success event (e.g. Date.now()); the message
 * clears itself after `clearAfterMs`. */
export function LiveStatus({
  message,
  stamp,
  clearAfterMs = 6000,
}: {
  message: string;
  stamp: number | null;
  clearAfterMs?: number;
}) {
  const [dismissed, setDismissed] = useState<number | null>(null);
  useEffect(() => {
    if (stamp === null) return;
    const timer = window.setTimeout(() => setDismissed(stamp), clearAfterMs);
    return () => window.clearTimeout(timer);
  }, [stamp, clearAfterMs]);
  const visible = stamp !== null && dismissed !== stamp;
  return (
    <div role="status" className="live-status">
      {visible ? (
        <p className="badge badge--success live-status__message">
          <CheckIcon aria-hidden="true" />
          {message}
        </p>
      ) : null}
    </div>
  );
}
