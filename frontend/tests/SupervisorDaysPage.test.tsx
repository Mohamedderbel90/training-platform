import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithIntl } from "./testUtils";
import SupervisorDashboardPage from "@/app/[locale]/supervisor/days/page";
import { useAuth } from "@/lib/auth/AuthContext";
import { dashboardApi } from "@/lib/api/endpoints";
import { ApiError } from "@/lib/api/client";
import { __setMockPathname } from "./mocks/i18nNavigation";
import type { DashboardEntryDto, DashboardResponseDto } from "@/lib/api/types";

vi.mock("@/i18n/navigation", () => import("./mocks/i18nNavigation"));
vi.mock("@/lib/auth/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("@/lib/api/endpoints", () => ({ dashboardApi: { get: vi.fn() } }));

beforeEach(() => {
  __setMockPathname("/supervisor/days");
});

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
    // The program name is shown once at the page level (current-program
    // box), not repeated on every card.
    expect(screen.queryByText("Demo Program")).not.toBeInTheDocument();
    expect(dashboardApi.get).toHaveBeenCalledWith("supervisor", "en", null);
    // No count text or progress bar on the card -- only the status badge
    // and the action link (matches the simplified survey/report cards).
    expect(screen.queryByText("0 of 3 recorded")).not.toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    // Each action link carries the current Training Days URL as `?from=`
    // so "Back to Training Days" on the destination page can restore it
    // (see components/BackToTrainingDays.tsx).
    expect(
      screen.getByRole("link", { name: "Record attendance" }),
    ).toHaveAttribute("href", "/supervisor/1/attendance?from=%2Fsupervisor%2Fdays");
    // The supervisor's own evaluation action is relabeled "Fill out
    // supervisory evaluation" everywhere -- distinct from the trainee's
    // generic "Fill out survey" wording, even though it is the same
    // SurveyStatusGroup component under the hood.
    expect(screen.getByRole("link", { name: "Fill out supervisory evaluation" })).toHaveAttribute(
      "href",
      "/supervisor/1/survey?from=%2Fsupervisor%2Fdays",
    );
  });

  it("switches the attendance action to View attendance once recording is finished (no status badge)", async () => {
    mockAuthenticated();
    vi.mocked(dashboardApi.get).mockResolvedValue(
      makeSummary([
        makeEntry({
          attendance: { recorded_count: 3, total_enrolled: 3, complete: true },
        }),
      ]),
    );

    renderWithIntl(<SupervisorDashboardPage />);

    await waitFor(() =>
      expect(screen.getByRole("link", { name: "View attendance" })).toBeInTheDocument(),
    );
    expect(screen.queryByText("Complete")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Record attendance" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Continue attendance" })).not.toBeInTheDocument();
  });

  it("shows a View supervisory evaluation link once the supervisor's own evaluation is final", async () => {
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

    await waitFor(() =>
      expect(screen.getByRole("link", { name: "View supervisory evaluation" })).toBeInTheDocument(),
    );
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

    await waitFor(() => expect(screen.getByText("Something went wrong on our side. Please try again in a moment.")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
