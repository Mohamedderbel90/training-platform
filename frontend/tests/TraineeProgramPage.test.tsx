import { describe, it, expect, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithIntl } from "./testUtils";
import Page from "@/app/[locale]/trainee/program/page";
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
    profile: { id: 1, partner_id: 1, name: "Dev", locale: "en_US", roles: ["trainee"], capabilities: [] },
    roles: ["trainee"],
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
  });
}

const base: DashboardEntryDto = {
  training_day_id: 1,
  course_id: 1,
  program_id: 1,
  date: "2026-09-15",
  course_name: "Course A",
  program_name: "Demo Program",
  start_datetime: null,
  end_datetime: null,
  state: "open",
  survey_open_at: null,
  survey_close_at: null,
};

function summary(days: DashboardEntryDto[]): DashboardResponseDto {
  return { days, program: null, stats: null, next_session: null };
}

async function expectErrorState() {
  mockAuthenticated();
  vi.mocked(dashboardApi.get).mockRejectedValueOnce(
    new ApiError({ code: "INTERNAL_ERROR", message: "An unexpected error occurred.", fields: null }, 500, "req_1"),
  );
  renderWithIntl(<Page />);
  await waitFor(() => expect(screen.getByText("Something went wrong on our side. Please try again in a moment.")).toBeInTheDocument());
  expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
}

describe("Trainee program page", () => {
  it("renders the program and its courses breakdown", async () => {
    mockAuthenticated();
    vi.mocked(dashboardApi.get).mockResolvedValue({
      ...summary([base]),
      program: {
        id: 1, name: "Leadership Program", start_date: "2026-09-01", end_date: "2026-12-01", state: "active",
        courses: [
          { id: 2, name: "Second", sequence: 20, training_days_count: 2, closed_days_count: 0, training_hours: 6 },
          { id: 1, name: "First", sequence: 10, training_days_count: 3, closed_days_count: 1, training_hours: 7.5 },
        ],
      },
      stats: { courses_count: 2, training_days_count: 5, training_hours: 13.5, progress_percent: 20 },
    });
    renderWithIntl(<Page />);
    await waitFor(() => expect(screen.getByText("Leadership Program")).toBeInTheDocument());
    expect(screen.getByText("Active")).toBeInTheDocument();
    const items = screen.getAllByRole("listitem").filter((li) => li.className.includes("card"));
    expect(items[0]).toHaveTextContent("First");
    expect(items[0]).toHaveTextContent("Completed days: 1");
    expect(items[0]).toHaveTextContent("Hours: 7.5");
  });
  it("shows an empty state without a program", async () => {
    mockAuthenticated();
    vi.mocked(dashboardApi.get).mockResolvedValue(summary([]));
    renderWithIntl(<Page />);
    await waitFor(() => expect(screen.getByText("No program yet")).toBeInTheDocument());
  });
  it("shows an error state with retry", async () => {
    await expectErrorState();
  });
});
