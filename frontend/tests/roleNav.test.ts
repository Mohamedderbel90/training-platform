import { describe, it, expect } from "vitest";
import { ROLE_NAV, isNavItemActive } from "@/lib/auth/roleNav";

describe("ROLE_NAV destinations", () => {
  it("links each role's extra items to the implemented routes", () => {
    expect(ROLE_NAV.trainee.map((i) => i.href)).toEqual([
      "/trainee",
      "/trainee/days",
      "/trainee/surveys",
      "/trainee/program",
    ]);
    expect(ROLE_NAV.supervisor.map((i) => i.href)).toContain("/supervisor/evaluations");
    expect(ROLE_NAV.trainer.map((i) => i.href)).toContain("/trainer/reports");
  });

  it("marks nested and related routes active", () => {
    const surveys = ROLE_NAV.trainee[2];
    expect(isNavItemActive(surveys, "/trainee/surveys")).toBe(true);
    expect(isNavItemActive(surveys, "/trainee/12")).toBe(true);
    expect(isNavItemActive(ROLE_NAV.trainee[0], "/trainee/program")).toBe(false);
  });
});
