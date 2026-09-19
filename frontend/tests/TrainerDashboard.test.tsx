import { describe, it, expect, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithIntl } from "./testUtils";
import TrainerDashboardPage from "@/app/[locale]/trainer/page";
import { useAuth } from "@/lib/auth/AuthContext";
import { dashboardApi } from "@/lib/api/endpoints";
import { ApiError } from "@/lib/api/client";
import type { DashboardEntryDto } from "@/lib/api/types";

vi.mock("@/i18n/navigation", () => import("./mocks/i18nNavigation"));
vi.mock("@/lib/auth/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("@/lib/api/endpoints", () => ({ dashboardApi: { get: vi.fn() } }));

function mockAuthenticated() {
  vi.mocked(useAuth).mockReturnValue({
    status: "authenticated",
    profile: { id: 1, partner_id: 1, name: "Dev Trainer", locale: "en_US", roles: ["trainer"], capabilities: [] },
    roles: ["trainer"],
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
  });
}

function makeEntry(overrides: Partial<DashboardEntryDto> = {}): DashboardEntryDto {
  return {
    training_day_id: 1,
    date: "2026-09-16",
    course_name: "Demo Course",
    program_name: "Demo Program",
    state: "open",
    survey_open_at: null,
    survey_close_at: null,
    trainer_report: { configured: true, response: null, can_submit: true, reason: null },
    ...overrides,
  };
}

describe("Trainer dashboard", () => {
  it("shows a loading state, then renders assigned training days with an Open report link", async () => {
    mockAuthenticated();
    vi.mocked(dashboardApi.get).mockResolvedValue({ days: [makeEntry()] });

    renderWithIntl(<TrainerDashboardPage />);
    expect(screen.getByText("Loading your training days...")).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText("Demo Course")).toBeInTheDocument());
    expect(screen.getByText("Demo Program")).toBeInTheDocument();
    expect(dashboardApi.get).toHaveBeenCalledWith("trainer", "en");
    expect(screen.getByRole("link", { name: "Open report" })).toHaveAttribute(
      "href",
      "/trainer/1",
    );
  });

  it("shows a View report link and the Submitted badge once the trainer's own report is final", async () => {
    mockAuthenticated();
    vi.mocked(dashboardApi.get).mockResolvedValue({
      days: [
        makeEntry({
          trainer_report: {
            configured: true,
            response: { response_id: 9, state: "submitted", submitted_at: "2026-09-16 10:00:00", editable: false },
            can_submit: false,
            reason: "already_submitted",
          },
        }),
      ],
    });

    renderWithIntl(<TrainerDashboardPage />);

    await waitFor(() => expect(screen.getByRole("link", { name: "View report" })).toBeInTheDocument());
    expect(screen.getByText("Submitted")).toBeInTheDocument();
  });

  it("shows the empty-dashboard state when there are no assigned training days", async () => {
    mockAuthenticated();
    vi.mocked(dashboardApi.get).mockResolvedValue({ days: [] });

    renderWithIntl(<TrainerDashboardPage />);

    await waitFor(() => expect(screen.getByText("No training days yet")).toBeInTheDocument());
    expect(
      screen.getByText("You have no assigned training days to show right now."),
    ).toBeInTheDocument();
  });

  it("shows an error state with a retry action instead of silently swallowing the failure", async () => {
    mockAuthenticated();
    vi.mocked(dashboardApi.get).mockRejectedValueOnce(
      new ApiError({ code: "INTERNAL_ERROR", message: "An unexpected error occurred.", fields: null }, 500, "req_1"),
    );
    renderWithIntl(<TrainerDashboardPage />);

    await waitFor(() => expect(screen.getByText("An unexpected error occurred.")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
