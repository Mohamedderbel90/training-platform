import { describe, it, expect, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithIntl } from "./testUtils";
import TraineeDashboardPage from "@/app/[locale]/trainee/days/page";
import { useAuth } from "@/lib/auth/AuthContext";
import { dashboardApi } from "@/lib/api/endpoints";
import { ApiError } from "@/lib/api/client";
import type { DashboardEntryDto, DashboardResponseDto } from "@/lib/api/types";

vi.mock("@/i18n/navigation", () => import("./mocks/i18nNavigation"));
vi.mock("@/lib/auth/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("@/lib/api/endpoints", () => ({ dashboardApi: { get: vi.fn() } }));

function mockAuthenticated() {
  vi.mocked(useAuth).mockReturnValue({
    status: "authenticated",
    profile: { id: 1, partner_id: 1, name: "Dev Trainee", locale: "en_US", roles: ["trainee"], capabilities: [] },
    roles: ["trainee"],
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
  });
}

const entry: DashboardEntryDto = {
  training_day_id: 1,
  course_id: 1,
  program_id: 1,
  date: "2026-09-15",
  course_name: "Demo Course",
  program_name: "Demo Program",
  start_datetime: null,
  end_datetime: null,
  state: "open",
  survey_open_at: null,
  survey_close_at: null,
  survey: { configured: true, response: null, can_submit: true, reason: null },
};

function makeSummary(days: DashboardEntryDto[]): DashboardResponseDto {
  return { days, program: null, stats: null, next_session: null };
}

describe("Trainee dashboard", () => {
  it("shows a loading state, then renders training day cards on success", async () => {
    mockAuthenticated();
    vi.mocked(dashboardApi.get).mockResolvedValue(makeSummary([entry]));

    renderWithIntl(<TraineeDashboardPage />);
    expect(screen.getByText("Loading your training days...")).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText("Demo Course")).toBeInTheDocument());
    expect(screen.getByText("Demo Program")).toBeInTheDocument();
    expect(screen.getByText("Open survey")).toBeInTheDocument();
  });

  it("shows the empty-dashboard state when there are no training days", async () => {
    mockAuthenticated();
    vi.mocked(dashboardApi.get).mockResolvedValue(makeSummary([]));

    renderWithIntl(<TraineeDashboardPage />);

    await waitFor(() => expect(screen.getByText("No training days yet")).toBeInTheDocument());
  });

  it("shows an error state with a retry action instead of silently swallowing the failure", async () => {
    mockAuthenticated();
    vi.mocked(dashboardApi.get).mockRejectedValueOnce(
      new ApiError({ code: "INTERNAL_ERROR", message: "An unexpected error occurred.", fields: null }, 500, "req_1"),
    );
    renderWithIntl(<TraineeDashboardPage />);

    await waitFor(() => expect(screen.getByText("An unexpected error occurred.")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
