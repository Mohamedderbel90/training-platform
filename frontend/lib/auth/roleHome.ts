import type { OperationalRole } from "@/lib/api/types";

/** Single source of truth for "where does this role land." A user
 * could in principle carry more than one operational role; the first
 * match in this fixed precedence order wins. */
export const ROLE_HOME: Record<OperationalRole, string> = {
  trainee: "/trainee",
  supervisor: "/supervisor",
  trainer: "/trainer",
};

export const ROLE_PRECEDENCE: OperationalRole[] = ["trainee", "supervisor", "trainer"];

/** First role in the fixed precedence order, or null with no
 * operational role at all -- the single place "which role's data do we
 * show when a page isn't role-specific" (e.g. the shared header's
 * current-program box) is decided. */
export function getPrimaryRole(roles: OperationalRole[]): OperationalRole | null {
  for (const role of ROLE_PRECEDENCE) {
    if (roles.includes(role)) {
      return role;
    }
  }
  return null;
}

export function getRoleHome(roles: OperationalRole[]): string {
  const role = getPrimaryRole(roles);
  return role ? ROLE_HOME[role] : "/login";
}
