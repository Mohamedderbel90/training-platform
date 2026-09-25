import { describe, it, expect, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithIntl } from "./testUtils";
import Page from "@/app/[locale]/trainer/reports/page";
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
    profile: { id: 1, partner_id: 1, name: "Dev", locale: "en_US", roles: ["trainer"], capabilities: [] },
    roles: ["trainer"],
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
  await waitFor(() => expect(screen.getByText("An unexpected error occurred.")).toBeInTheDocument());
  expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
}

describe("Trainer reports page", () => {
  it("groups days by report status and links to the report", async () => {
    mockAuthenticated();
    vi.mocked(dashboardApi.get).mockResolvedValue(summary([
      { ...base, training_day_id: 1, course_name: "Todo Course", trainer_report: { configured: true, response: null, can_submit: true, reason: null } },
      { ...base, training_day_id: 2, course_name: "Sent Course", trainer_report: { configured: true, response: { response_id: 1, state: "submitted", submitted_at: null, editable: false }, can_submit: false, reason: null } },
    ]));
    renderWithIntl(<Page />);
    await waitFor(() => expect(screen.getByText("Todo Course")).toBeInTheDocument());
    expect(screen.getByRole("heading", { level: 1, name: "My Reports" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open report" })).toHaveAttribute("href", "/trainer/1");
    expect(screen.getByRole("link", { name: "View report" })).toHaveAttribute("href", "/trainer/2");
  });
  it("shows the empty state", async () => {
    mockAuthenticated();
    vi.mocked(dashboardApi.get).mockResolvedValue(summary([]));
    renderWithIntl(<Page />);
    await waitFor(() => expect(screen.getByText("No training days yet")).toBeInTheDocument());
  });
  it("shows an error state with retry", async () => {
    await expectErrorState();
  });
});
