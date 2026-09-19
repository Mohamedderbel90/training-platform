import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import { renderWithIntl } from "./testUtils";
import { AuthProvider, useAuth } from "@/lib/auth/AuthContext";
import { ApiError } from "@/lib/api/client";
import { authApi } from "@/lib/api/endpoints";

vi.mock("@/lib/api/endpoints", () => ({
  authApi: {
    me: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
  },
}));

const profile = {
  id: 1,
  partner_id: 2,
  name: "Dev Trainee",
  locale: "en_US",
  roles: ["trainee" as const],
  capabilities: ["dashboard.trainee"],
};

function Probe() {
  const { status, roles, profile: p } = useAuth();
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="roles">{roles.join(",")}</span>
      <span data-testid="name">{p?.name ?? ""}</span>
    </div>
  );
}

describe("AuthProvider session bootstrap", () => {
  beforeEach(() => {
    vi.mocked(authApi.me).mockReset();
    vi.mocked(authApi.login).mockReset();
    vi.mocked(authApi.logout).mockReset();
  });

  it("becomes authenticated with the profile's roles when /auth/me succeeds", async () => {
    vi.mocked(authApi.me).mockResolvedValue(profile);
    renderWithIntl(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));
    expect(screen.getByTestId("roles")).toHaveTextContent("trainee");
    expect(screen.getByTestId("name")).toHaveTextContent("Dev Trainee");
  });

  it("becomes unauthenticated (401 handling) when /auth/me fails with UNAUTHENTICATED", async () => {
    vi.mocked(authApi.me).mockRejectedValue(
      new ApiError({ code: "UNAUTHENTICATED", message: "Your session has expired.", fields: null }, 401, "req_1"),
    );
    renderWithIntl(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"));
    expect(screen.getByTestId("roles")).toHaveTextContent("");
  });

  it("login() updates status/profile on success", async () => {
    vi.mocked(authApi.me).mockRejectedValue(
      new ApiError({ code: "UNAUTHENTICATED", message: "x", fields: null }, 401, "req_1"),
    );
    vi.mocked(authApi.login).mockResolvedValue(profile);

    function LoginButton() {
      const { login } = useAuth();
      return (
        <button type="button" onClick={() => login("dev_trainee", "Dev12345!")}>
          do-login
        </button>
      );
    }
    renderWithIntl(
      <AuthProvider>
        <LoginButton />
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"));

    fireEvent.click(screen.getByRole("button", { name: "do-login" }));

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));
    expect(screen.getByTestId("name")).toHaveTextContent("Dev Trainee");
  });

  it("logout() clears profile and flips to unauthenticated", async () => {
    vi.mocked(authApi.me).mockResolvedValue(profile);
    vi.mocked(authApi.logout).mockResolvedValue({ logged_out: true });

    function LogoutButton() {
      const { logout } = useAuth();
      return (
        <button type="button" onClick={() => logout()}>
          do-logout
        </button>
      );
    }
    renderWithIntl(
      <AuthProvider>
        <LogoutButton />
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));

    fireEvent.click(screen.getByRole("button", { name: "do-logout" }));

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"));
    expect(screen.getByTestId("name")).toHaveTextContent("");
  });
});
