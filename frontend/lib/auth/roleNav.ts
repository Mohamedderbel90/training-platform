import type { OperationalRole } from "@/lib/api/types";
import { ROLE_HOME } from "@/lib/auth/roleHome";

/**
 * Per-role sidebar navigation config (plan conflict resolution 12):
 * the approved sidebar's visual design stays exactly as it is and only
 * its item list comes from here.
 *
 * Every role gets exactly two items: Dashboard, Training Days. The
 * earlier per-role third item (Training Program / Attendance &
 * Evaluation / My Reports) is gone -- each page's unique functionality
 * was folded into Training Days' own unified toolbar (the 3-way
 * actionability filter subsumes the old grouped "pending/done" and
 * "to complete/submitted" lists) and the old routes now redirect there
 * (see next.config.ts), the same precedent set when "My Surveys" was
 * retired the same way.
 *
 * - Trainee: Dashboard, Training Days
 * - Supervisor: Dashboard, Training Days
 * - Trainer: Dashboard, Training Days
 * - Everyone: Profile (ACCOUNT_NAV), then Logout; Help / Terms / Privacy live in the footer (FOOTER_NAV) (rendered by AppShell)
 *
 * Help (which carries the contact address), Terms and Privacy follow
 * Profile; their texts and the contact were approved on 2026-10-03
 * (DEC-50, DEC-51).
 *
 * This is presentation only: every destination route enforces its own
 * role through ProtectedRoute, and the Operational API enforces the
 * real permissions server-side.
 */
export type RoleNavKey = "dashboard" | "trainingDays" | "profile" | "help" | "terms" | "privacy";

export interface RoleNavItem {
  key: RoleNavKey;
  href: string;
  /** Only the exact href counts as active (used for a role's home, which
   * would otherwise prefix-match every page under it). */
  exact?: boolean;
  /** Extra nested routes that belong under this item even though they
   * don't share its href prefix, e.g. the trainee survey form
   * `/trainee/12` sits under "Training Days". */
  alsoActiveOn?: RegExp[];
}

export const ROLE_NAV: Record<OperationalRole, RoleNavItem[]> = {
  trainee: [
    { key: "dashboard", href: ROLE_HOME.trainee, exact: true },
    {
      key: "trainingDays",
      href: `${ROLE_HOME.trainee}/days`,
      alsoActiveOn: [/^\/trainee\/\d+\/?$/],
    },
  ],
  supervisor: [
    { key: "dashboard", href: ROLE_HOME.supervisor, exact: true },
    {
      key: "trainingDays",
      href: `${ROLE_HOME.supervisor}/days`,
      alsoActiveOn: [/^\/supervisor\/\d+(\/.*)?$/],
    },
  ],
  trainer: [
    { key: "dashboard", href: ROLE_HOME.trainer, exact: true },
    {
      key: "trainingDays",
      href: `${ROLE_HOME.trainer}/days`,
      alsoActiveOn: [/^\/trainer\/\d+\/?$/],
    },
  ],
};

/** Shared account items shown once, below the role groups, for every
 * authenticated user regardless of role. */
export const ACCOUNT_NAV: RoleNavItem[] = [{ key: "profile", href: "/profile" }];

/** Information pages shown in the page footer (not the sidebar) for every
 * authenticated user. */
export const FOOTER_NAV: RoleNavItem[] = [
  { key: "help", href: "/help" },
  { key: "terms", href: "/terms" },
  { key: "privacy", href: "/privacy" },
];

/** Whether `item` should carry aria-current="page" for the current
 * (locale-agnostic) pathname -- its own route, any route nested under
 * it, or one of its explicitly listed related routes. */
export function isNavItemActive(item: RoleNavItem, pathname: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (path === item.href) return true;
  if (!item.exact && path.startsWith(`${item.href}/`)) return true;
  return item.alsoActiveOn?.some((pattern) => pattern.test(path)) ?? false;
}
