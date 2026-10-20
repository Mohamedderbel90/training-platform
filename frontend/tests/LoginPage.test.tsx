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

  async function signIn(returnTo: string | undefined) {
    __setMockSearchParams(returnTo === undefined ? {} : { returnTo });
    const login = vi.fn().mockResolvedValue({
      id: 1,
      partner_id: 1,
      name: "Dev Supervisor",
      locale: "en_US",
      roles: ["supervisor"],
      capabilities: [],
    });
    mockAuth({ login });
    renderWithIntl(<LoginPage />);
    await userEvent.type(screen.getByLabelText("Username"), "dev_supervisor");
    await userEvent.type(screen.getByLabelText("Password"), "Dev12345!");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(login).toHaveBeenCalled());
  }

  it("returns to the originally requested page after login when returnTo is a same-app path", async () => {
    await signIn("/supervisor/93/attendance");
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/supervisor/93/attendance"));
    expect(replace).not.toHaveBeenCalledWith("/supervisor");
  });

  it.each(["//evil.example/x", "https://evil.example", "/\\evil.example", "/login", "evil"])(
    "ignores the unsafe returnTo %s and lands on the role dashboard",
    async (value) => {
      await signIn(value);
      await waitFor(() => expect(replace).toHaveBeenCalledWith("/supervisor"));
      expect(replace).toHaveBeenCalledTimes(1);
    },
  );

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
    expect(screen.getByText("Sign-in failed")).toBeInTheDocument();
    expect(screen.queryByText("Session expired")).not.toBeInTheDocument();
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

    await userEvent.type(screen.getByLabelText("Username"), "x");
    await userEvent.type(screen.getByLabelText("Password"), "somepassword");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("This field is required.")).toBeInTheDocument();
    expect(screen.getByLabelText("Username")).toHaveAttribute("aria-invalid", "true");
  });

  it("validates required fields on submit without calling the server, and focuses the first invalid field", async () => {
    const login = vi.fn();
    mockAuth({ login });
    renderWithIntl(<LoginPage />);

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(login).not.toHaveBeenCalled();
    expect(screen.getAllByText("This field is required.")).toHaveLength(2);
    expect(screen.getByLabelText("Username")).toHaveFocus();
    expect(screen.getByLabelText("Username")).toHaveAccessibleDescription("This field is required.");
  });

  it("shows a field error on blur, and clears it once the field is filled", async () => {
    mockAuth({});
    renderWithIntl(<LoginPage />);
    await userEvent.click(screen.getByLabelText("Password"));
    await userEvent.tab();
    await userEvent.tab();
    expect(screen.getByText("This field is required.")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Password"), "a");
    expect(screen.queryByText("This field is required.")).not.toBeInTheDocument();
  });

  it("shows a busy submitting state while signing in", async () => {
    let resolve!: (v: unknown) => void;
    const login = vi.fn().mockReturnValue(new Promise((r) => (resolve = r)));
    mockAuth({ login });
    renderWithIntl(<LoginPage />);
    await userEvent.type(screen.getByLabelText("Username"), "u");
    await userEvent.type(screen.getByLabelText("Password"), "p");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    const busy = await screen.findByRole("button", { name: "Signing in..." });
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute("aria-busy", "true");
    resolve({ roles: [] });
  });

  it("never shows the request id with a server error", async () => {
    const login = vi
      .fn()
      .mockRejectedValue(new ApiError({ code: "UNAUTHENTICATED", message: "Invalid login or password.", fields: null }, 401, "req_77"));
    mockAuth({ login });
    renderWithIntl(<LoginPage />);
    await userEvent.type(screen.getByLabelText("Username"), "u");
    await userEvent.type(screen.getByLabelText("Password"), "p");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await screen.findByRole("alert");
    expect(screen.queryByText("req_77")).not.toBeInTheDocument();
  });

  it("has credential-friendly input attributes and a show/hide password toggle", async () => {
    mockAuth({});
    renderWithIntl(<LoginPage />);
    expect(screen.getByLabelText("Username")).toHaveAttribute("autocomplete", "username");
    const password = screen.getByLabelText("Password");
    expect(password).toHaveAttribute("autocomplete", "current-password");
    await userEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(password).toHaveAttribute("type", "text");
  });

  it("redirects immediately without showing the form when already authenticated", () => {
    mockAuth({ status: "authenticated", roles: ["supervisor"] });
    renderWithIntl(<LoginPage />);
    expect(replace).toHaveBeenCalledWith("/supervisor");
    expect(screen.queryByLabelText("Username")).not.toBeInTheDocument();
  });
});

describe("LoginPage credentials handling", () => {
  beforeEach(() => {
    __setMockSearchParams({});
  });

  it("trims the username but sends the password exactly as typed", async () => {
    const login = vi.fn().mockResolvedValue({
      id: 1, partner_id: 1, name: "X", locale: "en_US", roles: ["trainee"], capabilities: [],
    });
    mockAuth({ login });
    renderWithIntl(<LoginPage />);
    await userEvent.type(screen.getByLabelText("Username"), "  dev_trainee  ");
    await userEvent.type(screen.getByLabelText("Password"), " pa ss ");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(login).toHaveBeenCalledWith("dev_trainee", " pa ss "));
  });

  it("clears the password and keeps the username after a failed sign-in", async () => {
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

    await screen.findByText("Invalid login or password.");
    expect(screen.getByLabelText("Password")).toHaveValue("");
    expect(screen.getByLabelText("Username")).toHaveValue("dev_trainee");
  });
});
