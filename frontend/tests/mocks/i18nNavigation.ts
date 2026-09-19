/** Shared mock for "@/i18n/navigation" (the next-intl locale-aware
 * navigation wrappers), used by any component test that renders a
 * `Link`, calls `useRouter()`, or reads `usePathname()`. Real routing
 * behavior is exercised by the M5 report's live manual verification
 * (see docs/adr/ADR-006); these unit/component tests verify that
 * components CALL these APIs correctly (e.g. "redirect to /login on
 * 401"), not Next.js's own router implementation. */
import React from "react";
import { vi } from "vitest";

export const push = vi.fn();
export const replace = vi.fn();

let currentPathname = "/trainee";

export function __setMockPathname(path: string) {
  currentPathname = path;
}

export function useRouter() {
  return { push, replace };
}

export function usePathname() {
  return currentPathname;
}

export function getPathname() {
  return currentPathname;
}

export function Link({
  href,
  locale,
  children,
  ...rest
}: {
  href: string;
  locale?: string;
  children?: React.ReactNode;
  [key: string]: unknown;
}) {
  return React.createElement("a", { href, "data-locale": locale, ...rest }, children);
}
