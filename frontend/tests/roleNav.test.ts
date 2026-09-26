import { describe, it, expect } from "vitest";
import { ROLE_NAV, isNavItemActive } from "@/lib/auth/roleNav";

describe("ROLE_NAV destinations", () => {
  it("links each role's extra items to the implemented routes", () => {
    expect(ROLE_NAV.trainee.map((i) => i.href)).toEqual([
      "/trainee",
      "/trainee/days",
      "/trainee/program",
    ]);
    expect(ROLE_NAV.supervisor.map((i) => i.href)).toContain("/supervisor/evaluations");
    expect(ROLE_NAV.trainer.map((i) => i.href)).toContain("/trainer/reports");
  });

  it("marks nested and related routes active", () => {
    const days = ROLE_NAV.trainee[1];
    expect(isNavItemActive(days, "/trainee/days")).toBe(true);
    expect(isNavItemActive(days, "/trainee/12")).toBe(true);
    expect(ROLE_NAV.trainee.some((i) => i.href === "/trainee/surveys")).toBe(false);
    expect(isNavItemActive(ROLE_NAV.trainee[0], "/trainee/program")).toBe(false);
  });
});
