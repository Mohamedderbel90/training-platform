import type { OperationalRole } from "@/lib/api/types";
import { ROLE_HOME } from "@/lib/auth/roleHome";

/**
 * Per-role sidebar navigation config (plan conflict resolution 12):
 * the approved sidebar's visual design stays exactly as it is and only
 * its item list comes from here.
 *
 * - Trainee: Dashboard, Training Days, My Surveys, Training Program
 * - Supervisor: Dashboard, Training Days, Attendance & Evaluation
 * - Trainer: Dashboard, Training Days, My Reports
 * - Everyone: Profile (ACCOUNT_NAV), then Logout (rendered by AppShell)
 *
 * Help / Contact / Terms / Privacy are intentionally absent until their
 * content and channels are approved (plan blocker B3).
 *
 * This is presentation only: every destination route enforces its own
 * role through ProtectedRoute, and the Operational API enforces the
 * real permissions server-side.
 */
export type RoleNavKey =
  | "dashboard"
  | "trainingDays"
  | "mySurveys"
  | "program"
  | "attendanceEvaluation"
  | "myReports"
  | "profile";

export interface RoleNavItem {
  key: RoleNavKey;
  href: string;
  /** Only the exact href counts as active (used for a role's home, which
   * would otherwise prefix-match every page under it). */
  exact?: boolean;
  /** Extra nested routes that belong under this item even though they
   * don't share its href prefix, e.g. the trainee survey form
   * `/trainee/12` sits under "My Surveys". */
  alsoActiveOn?: RegExp[];
}

export const ROLE_NAV: Record<OperationalRole, RoleNavItem[]> = {
  trainee: [
    { key: "dashboard", href: ROLE_HOME.trainee, exact: true },
    { key: "trainingDays", href: `${ROLE_HOME.trainee}/days` },
    {
      key: "mySurveys",
      href: `${ROLE_HOME.trainee}/surveys`,
      alsoActiveOn: [/^\/trainee\/\d+\/?$/],
    },
    { key: "program", href: `${ROLE_HOME.trainee}/program` },
  ],
  supervisor: [
    { key: "dashboard", href: ROLE_HOME.supervisor, exact: true },
    { key: "trainingDays", href: `${ROLE_HOME.supervisor}/days` },
    {
      key: "attendanceEvaluation",
      href: `${ROLE_HOME.supervisor}/evaluations`,
      alsoActiveOn: [/^\/supervisor\/\d+(\/.*)?$/],
    },
  ],
  trainer: [
    { key: "dashboard", href: ROLE_HOME.trainer, exact: true },
    { key: "trainingDays", href: `${ROLE_HOME.trainer}/days` },
    {
      key: "myReports",
      href: `${ROLE_HOME.trainer}/reports`,
      alsoActiveOn: [/^\/trainer\/\d+\/?$/],
    },
  ],
};

/** Shared account items shown once, below the role groups, for every
 * authenticated user regardless of role. */
export const ACCOUNT_NAV: RoleNavItem[] = [{ key: "profile", href: "/profile" }];

/** Whether `item` should carry aria-current="page" for the current
 * (locale-agnostic) pathname -- its own route, any route nested under
 * it, or one of its explicitly listed related routes. */
export function isNavItemActive(item: RoleNavItem, pathname: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (path === item.href) return true;
  if (!item.exact && path.startsWith(`${item.href}/`)) return true;
  return item.alsoActiveOn?.some((pattern) => pattern.test(path)) ?? false;
}
