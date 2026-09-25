import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithIntl } from "./testUtils";
import ResetPasswordPage from "@/app/[locale]/reset-password/page";
import { authApi } from "@/lib/api/endpoints";
import { ApiError } from "@/lib/api/client";
import { __setMockSearchParams } from "./mocks/nextNavigation";

vi.mock("@/i18n/navigation", () => import("./mocks/i18nNavigation"));
vi.mock("next/navigation", () => import("./mocks/nextNavigation"));
vi.mock("@/lib/api/endpoints", () => ({
  authApi: { resetPassword: vi.fn() },
}));

describe("ResetPasswordPage", () => {
  beforeEach(() => {
    __setMockSearchParams({});
  });

  it("shows an invalid-link state and no form when the token is missing", () => {
    renderWithIntl(<ResetPasswordPage />);
    expect(screen.getByText("Invalid or expired link")).toBeInTheDocument();
    expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Request a new link" })).toHaveAttribute(
      "href",
      "/forgot-password",
    );
  });

  it("renders the password fields when a token is present", () => {
    __setMockSearchParams({ token: "tok_123" });
    renderWithIntl(<ResetPasswordPage />);
    expect(screen.getByLabelText("New password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm new password")).toBeInTheDocument();
  });

  it("blocks submission client-side when the two passwords don't match", async () => {
    __setMockSearchParams({ token: "tok_123" });
    renderWithIntl(<ResetPasswordPage />);

    await userEvent.type(screen.getByLabelText("New password"), "NewPass123!");
    await userEvent.type(screen.getByLabelText("Confirm new password"), "Different123!");
    fireEvent.click(screen.getByRole("button", { name: "Reset password" }));

    expect(await screen.findByText("Passwords do not match.")).toBeInTheDocument();
    expect(authApi.resetPassword).not.toHaveBeenCalled();
  });

  it("submits the token and new password, then shows a success state", async () => {
    __setMockSearchParams({ token: "tok_123" });
    vi.mocked(authApi.resetPassword).mockResolvedValue({ reset: true });
    renderWithIntl(<ResetPasswordPage />);

    await userEvent.type(screen.getByLabelText("New password"), "NewPass123!");
    await userEvent.type(screen.getByLabelText("Confirm new password"), "NewPass123!");
    fireEvent.click(screen.getByRole("button", { name: "Reset password" }));

    await waitFor(() =>
      expect(authApi.resetPassword).toHaveBeenCalledWith("tok_123", "NewPass123!", "en"),
    );
    expect(await screen.findByText("Password updated")).toBeInTheDocument();
  });

  it("shows the server's error when the token is invalid or expired", async () => {
    __setMockSearchParams({ token: "tok_bad" });
    vi.mocked(authApi.resetPassword).mockRejectedValue(
      new ApiError(
        {
          code: "VALIDATION_ERROR",
          message: "This password reset link is invalid or has expired.",
          fields: null,
        },
        422,
        "req_1",
      ),
    );
    renderWithIntl(<ResetPasswordPage />);

    await userEvent.type(screen.getByLabelText("New password"), "NewPass123!");
    await userEvent.type(screen.getByLabelText("Confirm new password"), "NewPass123!");
    fireEvent.click(screen.getByRole("button", { name: "Reset password" }));

    expect(
      await screen.findByText("This password reset link is invalid or has expired."),
    ).toBeInTheDocument();
  });
});
