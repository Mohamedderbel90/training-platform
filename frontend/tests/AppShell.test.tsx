import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithIntl } from "./testUtils";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth/AuthContext";
import { replace } from "./mocks/i18nNavigation";

vi.mock("@/i18n/navigation", () => import("./mocks/i18nNavigation"));
vi.mock("@/lib/auth/AuthContext", () => ({ useAuth: vi.fn() }));

describe("AppShell", () => {
  it("shows only the nav item(s) matching the authenticated user's role (role-based routing)", () => {
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
    expect(screen.getByRole("link", { name: "Supervisor" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "My Dashboard" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Trainer" })).not.toBeInTheDocument();
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

  it("renders both locale options with the current one marked via aria-current", () => {
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
    expect(screen.getByRole("link", { name: "English" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("link", { name: "العربية" })).toHaveAttribute("aria-current", "false");
  });

  it("logs out and redirects to /login when the user menu's logout button is used", async () => {
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
