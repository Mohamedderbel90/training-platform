import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithIntl } from "./testUtils";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth/AuthContext";
import { replace } from "./mocks/i18nNavigation";

vi.mock("@/i18n/navigation", () => import("./mocks/i18nNavigation"));
vi.mock("@/lib/auth/AuthContext", () => ({ useAuth: vi.fn() }));

describe("AppShell", () => {
  it("shows Dashboard/Training Days nav links scoped to the authenticated user's role", () => {
    vi.mocked(useAuth).mockReturnValue({
      status: "authenticated",
      profile: { id: 1, partner_id: 1, name: "Dev Supervisor", locale: "en_US", roles: ["supervisor"], capabilities: [] },
      roles: ["supervisor"],
      login: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
    });
    renderWithIntl(
      <AppShell>
        <div>page body</div>
      </AppShell>,
    );
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/supervisor");
    expect(screen.getByRole("link", { name: "Training Days" })).toHaveAttribute(
      "href",
      "/supervisor/days",
    );
  });

  it("shows one Dashboard/Training Days pair per role for a user holding multiple roles", () => {
    vi.mocked(useAuth).mockReturnValue({
      status: "authenticated",
      profile: { id: 1, partner_id: 1, name: "Dev Multi", locale: "en_US", roles: ["trainee", "trainer"], capabilities: [] },
      roles: ["trainee", "trainer"],
      login: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
    });
    renderWithIntl(
      <AppShell>
        <div>page body</div>
      </AppShell>,
    );
    expect(screen.getByRole("link", { name: /Dashboard · Trainee/ })).toHaveAttribute(
      "href",
      "/trainee",
    );
    expect(screen.getByRole("link", { name: /Dashboard · Trainer/ })).toHaveAttribute(
      "href",
      "/trainer",
    );
  });

  it("shows no role navigation while unauthenticated", () => {
    vi.mocked(useAuth).mockReturnValue({
      status: "unauthenticated",
      profile: null,
      roles: [],
      login: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
    });
    renderWithIntl(
      <AppShell>
        <div>page body</div>
      </AppShell>,
    );
    expect(screen.queryByRole("navigation", { name: "Primary navigation" })).not.toBeInTheDocument();
  });

  it("renders a single locale-switch link pointing at the other locale", () => {
    vi.mocked(useAuth).mockReturnValue({
      status: "unauthenticated",
      profile: null,
      roles: [],
      login: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
    });
    renderWithIntl(
      <AppShell>
        <div>page body</div>
      </AppShell>,
      { locale: "en" },
    );
    const localeLink = screen.getByRole("link", { name: "Switch to العربية" });
    expect(localeLink).toHaveAttribute("data-locale", "ar");
  });

  it("logs out and redirects to /login when the sidebar's logout action is used", async () => {
    const logout = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useAuth).mockReturnValue({
      status: "authenticated",
      profile: { id: 1, partner_id: 1, name: "Dev Trainee", locale: "en_US", roles: ["trainee"], capabilities: [] },
      roles: ["trainee"],
      login: vi.fn(),
      logout,
      refresh: vi.fn(),
    });
    renderWithIntl(
      <AppShell>
        <div>page body</div>
      </AppShell>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Log out" }));
    await waitFor(() => expect(logout).toHaveBeenCalledOnce());
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
  });
});
