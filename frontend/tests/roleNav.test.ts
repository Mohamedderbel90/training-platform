import { describe, it, expect } from "vitest";
import { ROLE_NAV, isNavItemActive } from "@/lib/auth/roleNav";

describe("ROLE_NAV destinations", () => {
  it("gives every role exactly Dashboard + Training Days -- the old per-role third item is gone", () => {
    expect(ROLE_NAV.trainee.map((i) => i.href)).toEqual(["/trainee", "/trainee/days"]);
    expect(ROLE_NAV.supervisor.map((i) => i.href)).toEqual(["/supervisor", "/supervisor/days"]);
    expect(ROLE_NAV.trainer.map((i) => i.href)).toEqual(["/trainer", "/trainer/days"]);
    expect(ROLE_NAV.trainee.map((i) => i.key)).toEqual(["dashboard", "trainingDays"]);
    expect(ROLE_NAV.supervisor.some((i) => i.href === "/supervisor/evaluations")).toBe(false);
    expect(ROLE_NAV.trainer.some((i) => i.href === "/trainer/reports")).toBe(false);
    expect(ROLE_NAV.trainee.some((i) => i.href === "/trainee/program")).toBe(false);
  });

  it("marks nested and related routes active", () => {
    const days = ROLE_NAV.trainee[1];
    expect(isNavItemActive(days, "/trainee/days")).toBe(true);
    expect(isNavItemActive(days, "/trainee/12")).toBe(true);
    expect(ROLE_NAV.trainee.some((i) => i.href === "/trainee/surveys")).toBe(false);
    expect(isNavItemActive(ROLE_NAV.trainee[0], "/trainee/program")).toBe(false);
  });

  it("marks supervisor/trainer day-action subroutes active under Training Days too", () => {
    const supervisorDays = ROLE_NAV.supervisor[1];
    expect(isNavItemActive(supervisorDays, "/supervisor/42/attendance")).toBe(true);
    expect(isNavItemActive(supervisorDays, "/supervisor/42/survey")).toBe(true);
    const trainerDays = ROLE_NAV.trainer[1];
    expect(isNavItemActive(trainerDays, "/trainer/42")).toBe(true);
  });
});
