import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithIntl } from "./testUtils";
import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";
import { useAuth } from "@/lib/auth/AuthContext";
import { replace, __setMockPathname } from "./mocks/i18nNavigation";

vi.mock("@/i18n/navigation", () => import("./mocks/i18nNavigation"));
vi.mock("@/lib/auth/AuthContext", () => ({ useAuth: vi.fn() }));

describe("ProtectedRoute", () => {
  beforeEach(() => {
    __setMockPathname("/supervisor/1/attendance");
  });

  it("sends a visitor who arrives logged out to /login with the requested page as returnTo", async () => {
    vi.mocked(useAuth).mockReturnValue({
      status: "unauthenticated",
      profile: null,
      roles: [],
      login: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
    });

    renderWithIntl(
      <ProtectedRoute role="supervisor">
        <div>secret content</div>
      </ProtectedRoute>,
    );

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/login?returnTo=%2Fsupervisor%2F1%2Fattendance"),
    );
    expect(screen.queryByText("secret content")).not.toBeInTheDocument();
  });

  it("goes to a plain /login when the session ends while the page is open (logout/expiry)", async () => {
    const base = { profile: null, login: vi.fn(), logout: vi.fn(), refresh: vi.fn() };
    vi.mocked(useAuth).mockReturnValue({
      ...base,
      status: "authenticated",
      profile: { id: 1, partner_id: 1, name: "X", locale: "en_US", roles: ["supervisor"], capabilities: [] },
      roles: ["supervisor"],
    });
    const view = renderWithIntl(
      <ProtectedRoute role="supervisor">
        <div>secret content</div>
      </ProtectedRoute>,
    );
    vi.mocked(useAuth).mockReturnValue({ ...base, status: "unauthenticated", roles: [] });
    view.rerender(
      <ProtectedRoute role="supervisor">
        <div>secret content</div>
      </ProtectedRoute>,
    );

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
    expect(replace).not.toHaveBeenCalledWith(expect.stringContaining("returnTo"));
  });

  it("shows a forbidden state (not the page content) when the role doesn't match", () => {
    vi.mocked(useAuth).mockReturnValue({
      status: "authenticated",
      profile: { id: 1, partner_id: 1, name: "X", locale: "en_US", roles: ["trainee"], capabilities: [] },
      roles: ["trainee"],
      login: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
    });

    renderWithIntl(
      <ProtectedRoute role="supervisor">
        <div>secret content</div>
      </ProtectedRoute>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "You don't have access to this page" })).toBeInTheDocument();
    expect(screen.queryByText("secret content")).not.toBeInTheDocument();
  });

  it("renders the protected content once authenticated with the required role", () => {
    vi.mocked(useAuth).mockReturnValue({
      status: "authenticated",
      profile: { id: 1, partner_id: 1, name: "X", locale: "en_US", roles: ["supervisor"], capabilities: [] },
      roles: ["supervisor"],
      login: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
    });

    renderWithIntl(
      <ProtectedRoute role="supervisor">
        <div>secret content</div>
      </ProtectedRoute>,
    );

    expect(screen.getByText("secret content")).toBeInTheDocument();
  });
});
