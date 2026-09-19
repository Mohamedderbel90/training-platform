import { describe, it, expect } from "vitest";
import { getRoleHome } from "@/lib/auth/roleHome";

describe("getRoleHome", () => {
  it("routes a trainee to /trainee", () => {
    expect(getRoleHome(["trainee"])).toBe("/trainee");
  });
  it("routes a supervisor to /supervisor", () => {
    expect(getRoleHome(["supervisor"])).toBe("/supervisor");
  });
  it("routes a trainer to /trainer", () => {
    expect(getRoleHome(["trainer"])).toBe("/trainer");
  });
  it("prefers trainee precedence when a user carries multiple roles", () => {
    expect(getRoleHome(["trainer", "trainee"])).toBe("/trainee");
  });
  it("falls back to /login when there are no operational roles at all", () => {
    expect(getRoleHome([])).toBe("/login");
  });
});
