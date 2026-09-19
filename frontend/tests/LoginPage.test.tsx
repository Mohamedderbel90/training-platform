import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithIntl } from "./testUtils";
import LoginPage from "@/app/[locale]/login/page";
import { useAuth } from "@/lib/auth/AuthContext";
import { ApiError } from "@/lib/api/client";
import { replace } from "./mocks/i18nNavigation";
import { __setMockSearchParams } from "./mocks/nextNavigation";

vi.mock("@/i18n/navigation", () => import("./mocks/i18nNavigation"));
vi.mock("next/navigation", () => import("./mocks/nextNavigation"));
vi.mock("@/lib/auth/AuthContext", () => ({ useAuth: vi.fn() }));

function mockAuth(overrides: Partial<ReturnType<typeof useAuth>>) {
  vi.mocked(useAuth).mockReturnValue({
    status: "unauthenticated",
    profile: null,
    roles: [],
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
    ...overrides,
  });
}

describe("LoginPage", () => {
  beforeEach(() => {
    __setMockSearchParams({});
  });

  it("renders username and password fields", () => {
    mockAuth({});
    renderWithIntl(<LoginPage />);
    expect(screen.getByLabelText("Username")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("logs in and redirects to the role's dashboard on success", async () => {
    const login = vi.fn().mockResolvedValue({
      id: 1,
      partner_id: 1,
      name: "Dev Trainee",
      locale: "en_US",
      roles: ["trainee"],
      capabilities: [],
    });
    mockAuth({ login });
    renderWithIntl(<LoginPage />);

    await userEvent.type(screen.getByLabelText("Username"), "dev_trainee");
    await userEvent.type(screen.getByLabelText("Password"), "Dev12345!");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(login).toHaveBeenCalledWith("dev_trainee", "Dev12345!"));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/trainee"));
  });

  it("redirects to a safe returnTo path instead of the default dashboard when present", async () => {
    __setMockSearchParams({ returnTo: "/trainee/42" });
    const login = vi.fn().mockResolvedValue({
      id: 1,
      partner_id: 1,
      name: "Dev Trainee",
      locale: "en_US",
      roles: ["trainee"],
      capabilities: [],
    });
    mockAuth({ login });
    renderWithIntl(<LoginPage />);

    await userEvent.type(screen.getByLabelText("Username"), "dev_trainee");
    await userEvent.type(screen.getByLabelText("Password"), "Dev12345!");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/trainee/42"));
  });

  it("shows the server's error message on invalid credentials (401) and does not redirect", async () => {
    const login = vi
      .fn()
      .mockRejectedValue(
        new ApiError({ code: "UNAUTHENTICATED", message: "Invalid login or password.", fields: null }, 401, "req_1"),
      );
    mockAuth({ login });
    renderWithIntl(<LoginPage />);

    await userEvent.type(screen.getByLabelText("Username"), "dev_trainee");
    await userEvent.type(screen.getByLabelText("Password"), "wrong");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Invalid login or password.")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("shows field-level validation errors (422) next to the offending fields", async () => {
    const login = vi.fn().mockRejectedValue(
      new ApiError(
        {
          code: "VALIDATION_ERROR",
          message: "login and password are required.",
          fields: { login: ["This field is required."] },
        },
        422,
        "req_1",
      ),
    );
    mockAuth({ login });
    renderWithIntl(<LoginPage />);

    await userEvent.type(screen.getByLabelText("Password"), "somepassword");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("This field is required.")).toBeInTheDocument();
  });

  it("redirects immediately without showing the form when already authenticated", () => {
    mockAuth({ status: "authenticated", roles: ["supervisor"] });
    renderWithIntl(<LoginPage />);
    expect(replace).toHaveBeenCalledWith("/supervisor");
    expect(screen.queryByLabelText("Username")).not.toBeInTheDocument();
  });
});
