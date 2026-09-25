import { describe, it, expect, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithIntl } from "./testUtils";
import SupervisorDashboardPage from "@/app/[locale]/supervisor/page";
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

const nextEntry: DashboardEntryDto = {
  training_day_id: 9,
  course_id: 1,
  program_id: 1,
  date: "2026-09-20",
  course_name: "Upcoming Course",
  program_name: "Demo Program",
  start_datetime: "2026-09-20 08:00:00",
  end_datetime: "2026-09-20 10:00:00",
  state: "planned",
  survey_open_at: null,
  survey_close_at: null,
  attendance: { recorded_count: 0, total_enrolled: 3, complete: false },
  survey: { configured: true, response: null, can_submit: true, reason: null },
};

const attendanceTaskEntry: DashboardEntryDto = {
  training_day_id: 7,
  course_id: 2,
  program_id: 1,
  date: "2026-09-05",
  course_name: "Attendance Course",
  program_name: "Demo Program",
  start_datetime: null,
  end_datetime: null,
  state: "open",
  survey_open_at: null,
  survey_close_at: null,
  attendance: { recorded_count: 1, total_enrolled: 3, complete: false },
  survey: { configured: false, response: null, can_submit: false, reason: null },
};

const surveyTaskEntry: DashboardEntryDto = {
  training_day_id: 8,
  course_id: 3,
  program_id: 1,
  date: "2026-09-06",
  course_name: "Survey Course",
  program_name: "Demo Program",
  start_datetime: null,
  end_datetime: null,
  state: "planned",
  survey_open_at: null,
  survey_close_at: null,
  survey: { configured: true, response: null, can_submit: true, reason: null },
};

function makeSummary(overrides: Partial<DashboardResponseDto> = {}): DashboardResponseDto {
  return { days: [], program: null, stats: null, next_session: null, ...overrides };
}

describe("Supervisor dashboard homepage", () => {
  it("shows a loading state, then renders the populated dashboard on success", async () => {
    mockAuthenticated();
    vi.mocked(dashboardApi.get).mockResolvedValue(
      makeSummary({
        days: [attendanceTaskEntry, surveyTaskEntry],
        program: { id: 1, name: "Demo Program", start_date: "2026-09-01", end_date: "2026-09-30" },
        stats: { courses_count: 3, training_days_count: 10, training_hours: 24, progress_percent: 40 },
        next_session: nextEntry,
      }),
    );

    renderWithIntl(<SupervisorDashboardPage />);
    expect(screen.getByText("Loading your training days...")).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText("Welcome back, Dev Supervisor")).toBeInTheDocument());
    expect(dashboardApi.get).toHaveBeenCalledWith("supervisor", "en");

    expect(screen.getByText("24")).toBeInTheDocument();
    expect(screen.getByText("40%")).toBeInTheDocument();

    expect(screen.getByText("Upcoming Course")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Manage attendance" })).toHaveAttribute(
      "href",
      "/supervisor/9/attendance",
    );
    expect(screen.getByRole("link", { name: "Open survey" })).toHaveAttribute(
      "href",
      "/supervisor/9/survey",
    );

    expect(screen.getByText("Attendance Course")).toBeInTheDocument();
    expect(screen.getByText("Record training day attendance")).toBeInTheDocument();
    expect(screen.getByText("Survey Course")).toBeInTheDocument();
    expect(screen.getByText("Complete the supervisor survey")).toBeInTheDocument();
    expect(screen.getByText("Quick statistics")).toBeInTheDocument();
  });

  it("shows the empty-dashboard state when there is no program data yet", async () => {
    mockAuthenticated();
    vi.mocked(dashboardApi.get).mockResolvedValue(makeSummary());

    renderWithIntl(<SupervisorDashboardPage />);

    await waitFor(() =>
      expect(screen.getByText("Welcome back, Dev Supervisor")).toBeInTheDocument(),
    );
    expect(
      screen.getByText("Not enough data about the current program yet."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("You have no upcoming training days right now."),
    ).toBeInTheDocument();
    expect(screen.getByText("No pending tasks right now.")).toBeInTheDocument();
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
