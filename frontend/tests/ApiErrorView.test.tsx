import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithIntl } from "./testUtils";
import { ApiErrorView } from "@/components/ApiErrorView";
import { ApiError } from "@/lib/api/client";

describe("ApiErrorView", () => {
  it("shows the server's own already-localized message verbatim for a server-origin error", () => {
    const error = new ApiError(
      { code: "FORBIDDEN", message: "You are not enrolled in this training day's program.", fields: null },
      403,
      "req_123",
    );
    renderWithIntl(<ApiErrorView error={error} />);
    expect(screen.getByText("Access denied")).toBeInTheDocument();
    expect(
      screen.getByText("You are not enrolled in this training day's program."),
    ).toBeInTheDocument();
    expect(screen.getByText("req_123")).toBeInTheDocument();
  });

  it("overrides the message with a translated string for a client-only NETWORK_ERROR", () => {
    const error = new ApiError(
      { code: "NETWORK_ERROR", message: "Unable to reach the server. Check your connection and try again.", fields: null },
      0,
      null,
    );
    renderWithIntl(<ApiErrorView error={error} />);
    expect(screen.getByText("Connection problem")).toBeInTheDocument();
  });

  it("calls onRetry when the retry action is used", () => {
    const onRetry = vi.fn();
    const error = new ApiError({ code: "NOT_FOUND", message: "x", fields: null }, 404, "req_1");
    renderWithIntl(<ApiErrorView error={error} onRetry={onRetry} />);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
