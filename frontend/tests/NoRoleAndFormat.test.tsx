import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithIntl } from "./testUtils";
import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";
import { useAuth } from "@/lib/auth/AuthContext";
import { formatDate, formatDateTime } from "@/lib/dashboard/format";
import { DIRECTION_BY_LOCALE } from "@/i18n/direction";
import enMessages from "@/messages/en.json";
import arMessages from "@/messages/ar.json";

vi.mock("@/i18n/navigation", () => import("./mocks/i18nNavigation"));
vi.mock("@/lib/auth/AuthContext", () => ({ useAuth: vi.fn() }));

describe("role-less account", () => {
  it("ProtectedRoute offers sign-out instead of redirecting to a login loop", () => {
    vi.mocked(useAuth).mockReturnValue({
      status: "authenticated",
      profile: { id: 1, partner_id: 1, name: "Admin", locale: "en_US", roles: [], capabilities: [] },
      roles: [],
      login: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
    });
    renderWithIntl(
      <ProtectedRoute role="trainee">
        <div>secret</div>
      </ProtectedRoute>,
    );
    expect(screen.getByText("No training role on this account")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log out" })).toBeInTheDocument();
    expect(screen.queryByText("secret")).not.toBeInTheDocument();
  });
});

describe("locale formatting and direction", () => {
  it("maps ar to rtl and en to ltr", () => {
    expect(DIRECTION_BY_LOCALE.ar).toBe("rtl");
    expect(DIRECTION_BY_LOCALE.en).toBe("ltr");
  });

  it("formats server UTC datetimes in the profile timezone with Latin digits", () => {
    expect(formatDateTime("2026-09-15 10:00:00", "en", "Asia/Riyadh")).toMatch(/13:00/);
    expect(formatDateTime("2026-09-15 10:00:00", "ar", "Asia/Riyadh")).toMatch(/13:00/);
    expect(formatDateTime("2026-09-15 10:00:00", "ar", "Asia/Riyadh")).not.toMatch(/[٠-٩]/);
  });

  it("falls back safely for an invalid timezone or unparseable value", () => {
    expect(() => formatDateTime("2026-09-15 10:00:00", "en", "Not/AZone")).not.toThrow();
    expect(formatDateTime("garbage", "en")).toBe("garbage");
    expect(formatDate("2026-09-15", "ar")).not.toMatch(/[٠-٩]/);
  });

  it("keeps en and ar message keys in parity", () => {
    const flat = (o: Record<string, unknown>, p = ""): string[] =>
      Object.entries(o).flatMap(([k, v]) =>
        typeof v === "object" && v !== null ? flat(v as Record<string, unknown>, `${p}${k}.`) : [`${p}${k}`],
      );
    expect(flat(arMessages).sort()).toEqual(flat(enMessages).sort());
  });
});
