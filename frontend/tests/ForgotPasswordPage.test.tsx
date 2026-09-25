import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithIntl } from "./testUtils";
import ForgotPasswordPage from "@/app/[locale]/forgot-password/page";
import { authApi } from "@/lib/api/endpoints";
import { ApiError } from "@/lib/api/client";

vi.mock("@/i18n/navigation", () => import("./mocks/i18nNavigation"));
vi.mock("@/lib/api/endpoints", () => ({
  authApi: { forgotPassword: vi.fn() },
}));

describe("ForgotPasswordPage", () => {
  it("renders the username field", () => {
    renderWithIntl(<ForgotPasswordPage />);
    expect(screen.getByLabelText("Username")).toBeInTheDocument();
  });

  it("submits the login and shows the server's own generic success message", async () => {
    vi.mocked(authApi.forgotPassword).mockResolvedValue({
      message: "If an account exists for this login, a password reset email has been sent.",
    });
    renderWithIntl(<ForgotPasswordPage />);

    await userEvent.type(screen.getByLabelText("Username"), "dev_trainee");
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    await waitFor(() =>
      expect(authApi.forgotPassword).toHaveBeenCalledWith("dev_trainee", "en"),
    );
    expect(
      await screen.findByText(
        "If an account exists for this login, a password reset email has been sent.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to sign in" })).toHaveAttribute(
      "href",
      "/login",
    );
  });

  it("shows a server error instead of the success state on failure", async () => {
    vi.mocked(authApi.forgotPassword).mockRejectedValue(
      new ApiError(
        { code: "INTERNAL_ERROR", message: "An unexpected error occurred.", fields: null },
        500,
        "req_1",
      ),
    );
    renderWithIntl(<ForgotPasswordPage />);

    await userEvent.type(screen.getByLabelText("Username"), "dev_trainee");
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(await screen.findByText("An unexpected error occurred.")).toBeInTheDocument();
  });
});
