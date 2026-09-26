"use client";

import { useEffect, useState } from "react";

/** Returns `value` after it has stayed unchanged for `delayMs`.
 * A delay of 0 (or less) returns the value as-is, without a timer. */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    if (delayMs <= 0) return;
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return delayMs <= 0 ? value : debounced;
}
