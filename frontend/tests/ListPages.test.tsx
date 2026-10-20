import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithIntl, chooseOption } from "./testUtils";
import SupervisorDaysPage from "@/app/[locale]/supervisor/days/page";
import TrainerDaysPage from "@/app/[locale]/trainer/days/page";
import { useAuth } from "@/lib/auth/AuthContext";
import { dashboardApi } from "@/lib/api/endpoints";
import { __installUrlSync, __setMockPathname } from "./mocks/i18nNavigation";
import { __getMockSearchParams, __setMockSearchParams } from "./mocks/nextNavigation";
import type { DashboardEntryDto, DashboardResponseDto } from "@/lib/api/types";
import { makeDays, notStarted } from "./listFixtures";

vi.mock("@/i18n/navigation", () => import("./mocks/i18nNavigation"));
vi.mock("next/navigation", () => import("./mocks/nextNavigation"));
vi.mock("@/lib/auth/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("@/lib/api/endpoints", () => ({ dashboardApi: { get: vi.fn() } }));

function mockAuth(role: "supervisor" | "trainee" | "trainer") {
  vi.mocked(useAuth).mockReturnValue({
    status: "authenticated",
    profile: { id: 1, partner_id: 1, name: "Dev", locale: "en_US", roles: [role], capabilities: [] },
    roles: [role],
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
  });
}

// Both the trainer/supervisor Training Days pages now carry the same
// summary-cards row (total/completed/upcoming) the trainee page already
// had -- those tiles are `<article>` elements too (see
// components/dashboard/DaySummaryCards.tsx), so a plain
// `getAllByRole("article")` picks up 3 extra, non-day-card articles
// ahead of the real list. Scope to `.day-card` so these assertions keep
// counting/reading only the actual Training Days cards.
const dayCardArticles = () => screen.queryAllByRole("article").filter((a) => a.classList.contains("day-card"));

// `.card__title` is now the computed "Day N [— topic]" ordinal, not the
// course name (section 4 of the day-card title rework) -- course name
// moved to the first `.card__meta` line under the title, so that's what
// these filter/search assertions (which care about *which course* is
// shown) now read.
const cardCourseNames = () => dayCardArticles().map((a) => a.querySelector(".card__meta")?.textContent ?? "");

function summary(days: DashboardEntryDto[]): DashboardResponseDto {
  return { days, program: null, stats: null, next_session: null };
}

const supervisorDays = makeDays(30, (i) => ({
  attendance: { recorded_count: i % 2, total_enrolled: 1, complete: i % 2 === 1 },
}));

beforeEach(() => {
  __setMockSearchParams({});
  __installUrlSync();
});

describe("flat list page (supervisor days)", () => {
  beforeEach(() => {
    __setMockPathname("/supervisor/days");
    mockAuth("supervisor");
    vi.mocked(dashboardApi.get).mockResolvedValue(summary(supervisorDays));
  });

  it("searches client-side, shows the count and empty-search state, and clears — without extra API calls", async () => {
    const user = userEvent.setup();
    renderWithIntl(<SupervisorDaysPage />);
    await screen.findAllByRole("article");
    expect(screen.getByText("30 training days")).toBeInTheDocument();

    await user.type(screen.getByRole("searchbox", { name: "Search training days" }), "beta");
    await waitFor(() => expect(screen.getByText("Showing 15 of 30 days")).toBeInTheDocument());
    expect(cardCourseNames().some((t) => t.startsWith("Alpha"))).toBe(false);
    expect(screen.getByRole("button", { name: /Remove filter: Search: “beta”/ })).toBeInTheDocument();

    await user.clear(screen.getByRole("searchbox", { name: "Search training days" }));
    await user.type(screen.getByRole("searchbox", { name: "Search training days" }), "zzz");
    expect(await screen.findByText("No results for “zzz”")).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Clear filters" })[0]);
    await screen.findAllByRole("article");
    expect(screen.getByText("30 training days")).toBeInTheDocument();
    expect(dashboardApi.get).toHaveBeenCalledTimes(1);
  });

  it("shows the filtered empty state when filters match nothing, with a clear action", async () => {
    const user = userEvent.setup();
    renderWithIntl(<SupervisorDaysPage />);
    await screen.findAllByRole("article");
    await chooseOption(user, "Day Status", "Cancelled");
    expect(await screen.findByText("No items match the selected filters")).toBeInTheDocument();
    expect(__getMockSearchParams().get("status")).toBe("cancelled");
    await user.click(screen.getAllByRole("button", { name: "Clear filters" })[0]);
    await screen.findAllByRole("article");
  });

  it("filters by survey status, attendance and date range and sorts", async () => {
    const user = userEvent.setup();
    renderWithIntl(<SupervisorDaysPage />);
    await screen.findAllByRole("article");
    await chooseOption(user, "Attendance", "Complete");
    expect(await screen.findByText("Showing 15 of 30 days")).toBeInTheDocument();
    await chooseOption(user, "Survey Status", "Submitted");
    expect(await screen.findByText("No items match the selected filters")).toBeInTheDocument();
    await chooseOption(user, "Survey Status", "All");
    await chooseOption(user, "Sort by", "Course name (A-Z)");
    const titles = cardCourseNames();
    // Attendance "complete" keeps the Beta days; numeric collation orders them 2, 4, 6...
    expect(titles.slice(0, 3)).toEqual(["Beta Course 2", "Beta Course 4", "Beta Course 6"]);
    expect(dashboardApi.get).toHaveBeenCalledTimes(1);
  });

  it("paginates client-side and keeps the filter across page changes and size changes", async () => {
    const user = userEvent.setup();
    renderWithIntl(<SupervisorDaysPage />);
    await screen.findAllByRole("article");
    expect(dayCardArticles()).toHaveLength(12);
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();

    await user.type(screen.getByRole("searchbox", { name: "Search training days" }), "alpha");
    await screen.findByText("Page 1 of 2");
    expect(dayCardArticles()).toHaveLength(12);

    await user.click(screen.getByRole("button", { name: "Next page" }));
    await screen.findByText("Page 2 of 2");
    expect(dayCardArticles()).toHaveLength(3);
    expect(cardCourseNames().some((t) => t.startsWith("Beta"))).toBe(false);
    expect(__getMockSearchParams().get("q")).toBe("alpha");
    expect(__getMockSearchParams().get("page")).toBe("2");

    await chooseOption(user, "Items per page", "24");
    await screen.findByText("Page 1 of 1");
    expect(dayCardArticles()).toHaveLength(15);
    expect(__getMockSearchParams().get("size")).toBe("24");
    expect(dashboardApi.get).toHaveBeenCalledTimes(1);
  });

  it("does not render pagination when results fit one page", async () => {
    vi.mocked(dashboardApi.get).mockResolvedValue(summary(makeDays(8)));
    renderWithIntl(<SupervisorDaysPage />);
    await screen.findAllByRole("article");
    expect(screen.queryByRole("navigation", { name: "Pagination" })).not.toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search training days" })).toBeInTheDocument();
  });

  it("hides the toolbar below the threshold and when there is no data", async () => {
    vi.mocked(dashboardApi.get).mockResolvedValue(summary(makeDays(5)));
    const { unmount } = renderWithIntl(<SupervisorDaysPage />);
    await screen.findAllByRole("article");
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    unmount();

    vi.mocked(dashboardApi.get).mockResolvedValue(summary([]));
    renderWithIntl(<SupervisorDaysPage />);
    await screen.findByText("No training days yet");
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear filters" })).not.toBeInTheDocument();
  });

  it("shows the skeleton loading state", () => {
    vi.mocked(dashboardApi.get).mockReturnValue(new Promise(() => {}));
    const { container } = renderWithIntl(<SupervisorDaysPage />);
    expect(screen.getByText("Loading your training days...")).toBeInTheDocument();
    expect(container.querySelector(".skeleton-card")).toBeInTheDocument();
  });

  it("offers a Program filter only when there is more than one program", async () => {
    const user = userEvent.setup();
    const { unmount } = renderWithIntl(<SupervisorDaysPage />);
    await screen.findAllByRole("article");
    expect(screen.queryByLabelText("Program")).not.toBeInTheDocument();
    unmount();

    vi.mocked(dashboardApi.get).mockResolvedValue(
      summary(makeDays(8, (i) => ({ program_id: i % 2 ? 2 : 1, program_name: i % 2 ? "Program Two" : "Program One" }))),
    );
    renderWithIntl(<SupervisorDaysPage />);
    await screen.findAllByRole("article");
    await chooseOption(user, "Program", "Program Two");
    expect(await screen.findByText("Showing 4 of 8 days")).toBeInTheDocument();
  });
});

describe("trainer days uses the Report Status label", () => {
  it("labels the response filter as Report Status", async () => {
    mockAuth("trainer");
    __setMockPathname("/trainer/days");
    vi.mocked(dashboardApi.get).mockResolvedValue(
      summary(makeDays(7, () => ({ survey: undefined, trainer_report: notStarted }))),
    );
    renderWithIntl(<TrainerDaysPage />);
    await screen.findAllByRole("article");
    expect(screen.getByLabelText("Report Status")).toBeInTheDocument();
    expect(screen.queryByLabelText("Survey Status")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Attendance" })).not.toBeInTheDocument();
  });
});
