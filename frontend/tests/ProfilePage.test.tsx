import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithIntl } from "./testUtils";
import ProfilePage from "@/app/[locale]/profile/page";
import { useAuth } from "@/lib/auth/AuthContext";
import { replace } from "./mocks/i18nNavigation";

vi.mock("@/i18n/navigation", () => import("./mocks/i18nNavigation"));
vi.mock("@/lib/auth/AuthContext", () => ({ useAuth: vi.fn() }));

describe("ProfilePage", () => {
  it("shows the authenticated user's name and role, available to any role (no specific role required)", () => {
    vi.mocked(useAuth).mockReturnValue({
      status: "authenticated",
      profile: { id: 1, partner_id: 1, name: "Dev Trainer", locale: "en_US", roles: ["trainer"], capabilities: [] },
      roles: ["trainer"],
      login: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
    });

    renderWithIntl(<ProfilePage />);

    expect(screen.getByText("Dev Trainer")).toBeInTheDocument();
    expect(screen.getByText("Trainer")).toBeInTheDocument();
  });

  it("shows one badge per role for a user holding multiple roles", () => {
    vi.mocked(useAuth).mockReturnValue({
      status: "authenticated",
      profile: { id: 1, partner_id: 1, name: "Dev Multi", locale: "en_US", roles: ["trainee", "supervisor"], capabilities: [] },
      roles: ["trainee", "supervisor"],
      login: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
    });

    renderWithIntl(<ProfilePage />);

    expect(screen.getByText("Trainee")).toBeInTheDocument();
    expect(screen.getByText("Supervisor")).toBeInTheDocument();
  });

  it("logs out and redirects to /login when the logout button is used", async () => {
    const logout = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useAuth).mockReturnValue({
      status: "authenticated",
      profile: { id: 1, partner_id: 1, name: "Dev Trainee", locale: "en_US", roles: ["trainee"], capabilities: [] },
      roles: ["trainee"],
      login: vi.fn(),
      logout,
      refresh: vi.fn(),
    });

    renderWithIntl(<ProfilePage />);
    fireEvent.click(screen.getByRole("button", { name: "Log out" }));

    await waitFor(() => expect(logout).toHaveBeenCalledOnce());
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
  });

  it("offers a link to switch to the other locale", () => {
    vi.mocked(useAuth).mockReturnValue({
      status: "authenticated",
      profile: { id: 1, partner_id: 1, name: "Dev Trainee", locale: "en_US", roles: ["trainee"], capabilities: [] },
      roles: ["trainee"],
      login: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
    });

    renderWithIntl(<ProfilePage />);
    const switchLink = screen.getByRole("link", { name: "Switch to العربية" });
    expect(switchLink).toHaveAttribute("data-locale", "ar");
  });
});
