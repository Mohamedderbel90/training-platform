import { describe, it, expect } from "vitest";
import { loginHrefFor, safeReturnTo } from "@/lib/auth/returnTo";

describe("safeReturnTo", () => {
  it("accepts same-app paths, with a query string", () => {
    expect(safeReturnTo("/supervisor/93/attendance")).toBe("/supervisor/93/attendance");
    expect(safeReturnTo("/trainee/days?view=calendar")).toBe("/trainee/days?view=calendar");
  });

  it.each([null, undefined, "", "evil", "//evil.example", "https://evil.example", "/\\evil.example", "/login", "/login?x=1", "/forgot-password", "/reset-password?token=t"])(
    "rejects %s",
    (value) => {
      expect(safeReturnTo(value)).toBeNull();
    },
  );
});

describe("loginHrefFor", () => {
  it("encodes the requested path", () => {
    expect(loginHrefFor("/supervisor/93/attendance")).toBe("/login?returnTo=%2Fsupervisor%2F93%2Fattendance");
  });

  it("falls back to a plain /login for an unusable path", () => {
    expect(loginHrefFor("/login")).toBe("/login");
  });
});
