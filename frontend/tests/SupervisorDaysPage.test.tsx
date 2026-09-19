import { describe, it, expect, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithIntl } from "./testUtils";
import SupervisorDashboardPage from "@/app/[locale]/supervisor/days/page";
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
    profile: { id: 1, partner_id: 1, name: "Dev Supervisor", locale: "en_US", roles: ["supervisor"], capabilities: [] },
    roles: ["supervisor"],
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
  });
}

function makeEntry(overrides: Partial<DashboardEntryDto> = {}): DashboardEntryDto {
  return {
    training_day_id: 1,
    course_id: 1,
    program_id: 1,
    date: "2026-09-16",
    course_name: "Demo Course",
    program_name: "Demo Program",
    start_datetime: null,
    end_datetime: null,
    state: "open",
    survey_open_at: null,
    survey_close_at: null,
    attendance: { recorded_count: 0, total_enrolled: 3, complete: false },
    survey: { configured: true, response: null, can_submit: true, reason: null },
    ...overrides,
  };
}

function makeSummary(days: DashboardEntryDto[]): DashboardResponseDto {
  return { days, program: null, stats: null, next_session: null };
}

describe("Supervisor dashboard", () => {
  it("shows a loading state, then renders assigned training days with attendance progress", async () => {
    mockAuthenticated();
    vi.mocked(dashboardApi.get).mockResolvedValue(makeSummary([makeEntry()]));

    renderWithIntl(<SupervisorDashboardPage />);
    expect(screen.getByText("Loading your training days...")).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText("Demo Course")).toBeInTheDocument());
    expect(screen.getByText("Demo Program")).toBeInTheDocument();
    expect(dashboardApi.get).toHaveBeenCalledWith("supervisor", "en");
    expect(screen.getByText("Attendance recorded: 0/3")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Manage attendance" }),
    ).toHaveAttribute("href", "/supervisor/1/attendance");
    expect(screen.getByRole("link", { name: "Open survey" })).toHaveAttribute(
      "href",
      "/supervisor/1/survey",
    );
  });

  it("shows the Complete badge once attendance recording is finished", async () => {
    mockAuthenticated();
    vi.mocked(dashboardApi.get).mockResolvedValue(
      makeSummary([
        makeEntry({
          attendance: { recorded_count: 3, total_enrolled: 3, complete: true },
        }),
      ]),
    );

    renderWithIntl(<SupervisorDashboardPage />);

    await waitFor(() => expect(screen.getByText("Attendance recorded: 3/3")).toBeInTheDocument());
    expect(screen.getByText("Complete")).toBeInTheDocument();
  });

  it("shows a View survey link once the supervisor's own evaluation is final", async () => {
    mockAuthenticated();
    vi.mocked(dashboardApi.get).mockResolvedValue(
      makeSummary([
        makeEntry({
          survey: {
            configured: true,
            response: { response_id: 9, state: "submitted", submitted_at: "2026-09-16 10:00:00", editable: false },
            can_submit: false,
            reason: "already_submitted",
          },
        }),
      ]),
    );

    renderWithIntl(<SupervisorDashboardPage />);

    await waitFor(() => expect(screen.getByRole("link", { name: "View survey" })).toBeInTheDocument());
  });

  it("shows the empty-dashboard state when there are no assigned training days", async () => {
    mockAuthenticated();
    vi.mocked(dashboardApi.get).mockResolvedValue(makeSummary([]));

    renderWithIntl(<SupervisorDashboardPage />);

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
    renderWithIntl(<SupervisorDashboardPage />);

    await waitFor(() => expect(screen.getByText("An unexpected error occurred.")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
