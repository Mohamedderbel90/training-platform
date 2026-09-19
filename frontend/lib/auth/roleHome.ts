import type { OperationalRole } from "@/lib/api/types";

/** Single source of truth for "where does this role land." A user
 * could in principle carry more than one operational role; the first
 * match in this fixed precedence order wins. */
export const ROLE_HOME: Record<OperationalRole, string> = {
  trainee: "/trainee",
  supervisor: "/supervisor",
  trainer: "/trainer",
};

const ROLE_PRECEDENCE: OperationalRole[] = ["trainee", "supervisor", "trainer"];

export function getRoleHome(roles: OperationalRole[]): string {
  for (const role of ROLE_PRECEDENCE) {
    if (roles.includes(role)) {
      return ROLE_HOME[role];
    }
  }
  return "/login";
}
