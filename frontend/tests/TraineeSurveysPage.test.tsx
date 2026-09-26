import { describe, it, expect, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithIntl } from "./testUtils";
import Page from "@/app/[locale]/trainee/surveys/page";
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

const avail = { configured: true, response: null, can_submit: true, reason: null };
const done = { configured: true, response: { response_id: 1, state: "submitted" as const, submitted_at: null, editable: false }, can_submit: false, reason: null };
const closed = { configured: true, response: null, can_submit: false, reason: "closed" };

describe("Trainee surveys page", () => {
  it("groups days by survey status and links to the survey form", async () => {
    mockAuthenticated();
    vi.mocked(dashboardApi.get).mockResolvedValue(summary([
      { ...base, training_day_id: 1, course_name: "Open Course", survey: avail },
      { ...base, training_day_id: 2, course_name: "Done Course", survey: done },
      { ...base, training_day_id: 3, course_name: "Closed Course", survey: closed },
    ]));
    renderWithIntl(<Page />);
    await waitFor(() => expect(screen.getByText("Open Course")).toBeInTheDocument());
    expect(screen.getByRole("heading", { level: 1, name: "My Surveys" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: /Available to complete/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: /Submitted/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: /Not available/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open survey" })).toHaveAttribute("href", "/trainee/1");
    expect(screen.getByRole("link", { name: "View survey" })).toHaveAttribute("href", "/trainee/2");
    expect(screen.getAllByRole("link", { name: /survey/i })).toHaveLength(2);
  });
  it("shows the empty state", async () => {
    mockAuthenticated();
    vi.mocked(dashboardApi.get).mockResolvedValue(summary([]));
    renderWithIntl(<Page />);
    await waitFor(() => expect(screen.getByText("No training days yet")).toBeInTheDocument());
  });
  it("shows loading then an error state with retry", async () => {
    mockAuthenticated();
    vi.mocked(dashboardApi.get).mockReturnValueOnce(new Promise(() => {}));
    const { unmount } = renderWithIntl(<Page />);
    expect(screen.getByText("Loading your training days...")).toBeInTheDocument();
    unmount();
    await expectErrorState();
  });
});
