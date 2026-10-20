import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithIntl } from "./testUtils";
import { ApiErrorView } from "@/components/ApiErrorView";
import { ApiError } from "@/lib/api/client";

vi.mock("@/i18n/navigation", () => import("./mocks/i18nNavigation"));

const mk = (code: string, status: number, message = "raw backend text", id: string | null = "req_7") =>
  new ApiError({ code, message, fields: null }, status, id);

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
    expect(screen.queryByText("req_123")).not.toBeInTheDocument();
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
    const error = new ApiError({ code: "INTERNAL_ERROR", message: "x", fields: null }, 500, "req_1");
    renderWithIntl(<ApiErrorView error={error} onRetry={onRetry} />);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("NOT_FOUND offers no retry (it can only fail again)", () => {
    const error = new ApiError({ code: "NOT_FOUND", message: "Record not found.", fields: null }, 404, "req_1");
    renderWithIntl(<ApiErrorView error={error} onRetry={vi.fn()} />);
    expect(screen.getByText("Not found")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  it("renders its title as the page h1 when asked", () => {
    renderWithIntl(<ApiErrorView error={mk("NOT_FOUND", 404)} headingLevel={1} />);
    expect(screen.getByRole("heading", { level: 1, name: "Not found" })).toBeInTheDocument();
  });

  it("401: session-expired message with a sign-in link instead of retry", () => {
    renderWithIntl(<ApiErrorView error={mk("UNAUTHENTICATED", 401)} onRetry={() => {}} />);
    expect(screen.getByText("Session expired")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in again" })).toHaveAttribute("href", "/login");
    expect(screen.queryByText("raw backend text")).toBeNull();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  it("401 on the form variant shows a neutral sign-in-failed title, not session expired", () => {
    renderWithIntl(
      <ApiErrorView error={mk("UNAUTHENTICATED", 401, "Invalid login or password.")} variant="form" />,
    );
    expect(screen.getByText("Sign-in failed")).toBeInTheDocument();
    expect(screen.getByText("Invalid login or password.")).toBeInTheDocument();
    expect(screen.queryByText("Session expired")).toBeNull();
    expect(screen.queryByRole("link", { name: "Sign in again" })).toBeNull();
  });

  it("403 shows access denied; 404 shows not found; validation stays friendly", () => {
    const { unmount } = renderWithIntl(<ApiErrorView error={mk("FORBIDDEN", 403, "Not yours")} />);
    expect(screen.getByText("Access denied")).toBeInTheDocument();
    unmount();
    const r2 = renderWithIntl(<ApiErrorView error={mk("NOT_FOUND", 404, "Gone")} />);
    expect(screen.getByText("Not found")).toBeInTheDocument();
    r2.unmount();
    renderWithIntl(<ApiErrorView error={mk("VALIDATION_ERROR", 422, "Date is required")} />);
    expect(screen.getByText("Some information is missing or invalid")).toBeInTheDocument();
    expect(screen.getByText("Date is required")).toBeInTheDocument();
  });

  it("5xx never shows raw backend text, offers retry and never shows a reference", () => {
    const onRetry = vi.fn();
    renderWithIntl(
      <ApiErrorView error={mk("INTERNAL_ERROR", 500, "Traceback (most recent call last)")} onRetry={onRetry} />,
    );
    expect(screen.queryByText(/Traceback/)).toBeNull();
    expect(screen.getByText("Something went wrong on our side. Please try again in a moment.")).toBeInTheDocument();
    expect(screen.queryByText(/Reference/)).not.toBeInTheDocument();
    expect(screen.queryByText("req_7")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("unknown 5xx code falls back to the friendly message", () => {
    renderWithIntl(<ApiErrorView error={mk("WEIRD", 502, "upstream stack")} />);
    expect(screen.queryByText("upstream stack")).toBeNull();
  });

  it("keeps the request id in the console log for debugging", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    renderWithIntl(<ApiErrorView error={mk("INTERNAL_ERROR", 500)} />);
    expect(spy).toHaveBeenCalledWith("[api-error]", { code: "INTERNAL_ERROR", status: 500, requestId: "req_7" });
    spy.mockRestore();
  });
});
