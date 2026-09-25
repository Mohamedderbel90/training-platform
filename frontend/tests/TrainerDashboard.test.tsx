import { describe, it, expect, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithIntl } from "./testUtils";
import TrainerDashboardPage from "@/app/[locale]/trainer/page";
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
    profile: { id: 1, partner_id: 1, name: "Dev Trainer", locale: "en_US", roles: ["trainer"], capabilities: [] },
    roles: ["trainer"],
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
  });
}

const nextEntry: DashboardEntryDto = {
  training_day_id: 5,
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
  trainer_report: { configured: true, response: null, can_submit: true, reason: null },
};

const taskEntry: DashboardEntryDto = {
  training_day_id: 6,
  course_id: 2,
  program_id: 1,
  date: "2026-09-10",
  course_name: "Task Course",
  program_name: "Demo Program",
  start_datetime: null,
  end_datetime: null,
  state: "planned",
  survey_open_at: null,
  survey_close_at: null,
  trainer_report: { configured: true, response: null, can_submit: true, reason: null },
};

function makeSummary(overrides: Partial<DashboardResponseDto> = {}): DashboardResponseDto {
  return { days: [], program: null, stats: null, next_session: null, ...overrides };
}

describe("Trainer dashboard homepage", () => {
  it("shows a loading state, then renders the populated dashboard on success", async () => {
    mockAuthenticated();
    vi.mocked(dashboardApi.get).mockResolvedValue(
      makeSummary({
        days: [taskEntry],
        program: { id: 1, name: "Demo Program", start_date: "2026-09-01", end_date: "2026-09-30" },
        stats: { courses_count: 3, training_days_count: 10, training_hours: 24, progress_percent: 40 },
        next_session: nextEntry,
      }),
    );

    renderWithIntl(<TrainerDashboardPage />);
    expect(screen.getByText("Loading your training days...")).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText("Welcome back, Dev Trainer")).toBeInTheDocument());
    expect(dashboardApi.get).toHaveBeenCalledWith("trainer", "en");

    expect(screen.getByText("24")).toBeInTheDocument();
    expect(screen.getByText("40%")).toBeInTheDocument();

    expect(screen.getByText("Upcoming Course")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open report" })).toHaveAttribute(
      "href",
      "/trainer/5",
    );

    expect(screen.getByText("Task Course")).toBeInTheDocument();
    expect(screen.getByText("Complete the training day report")).toBeInTheDocument();
    expect(screen.getByText("Quick statistics")).toBeInTheDocument();
  });

  it("shows the empty-dashboard state when there is no program data yet", async () => {
    mockAuthenticated();
    vi.mocked(dashboardApi.get).mockResolvedValue(makeSummary());

    renderWithIntl(<TrainerDashboardPage />);

    await waitFor(() => expect(screen.getByText("Welcome back, Dev Trainer")).toBeInTheDocument());
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
    renderWithIntl(<TrainerDashboardPage />);

    await waitFor(() => expect(screen.getByText("An unexpected error occurred.")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
