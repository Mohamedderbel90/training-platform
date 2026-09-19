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

  it("redirects to /login with a safe returnTo while the session is unauthenticated", async () => {
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
      expect(replace).toHaveBeenCalledWith(
        "/login?returnTo=%2Fsupervisor%2F1%2Fattendance",
      ),
    );
    expect(screen.queryByText("secret content")).not.toBeInTheDocument();
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

    expect(screen.getByText("You don't have access to this page")).toBeInTheDocument();
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
