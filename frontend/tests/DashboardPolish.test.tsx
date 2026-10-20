import { describe, it, expect, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { renderWithIntl } from "./testUtils";
import { StatCards } from "@/components/dashboard/StatCards";
import { TaskList } from "@/components/dashboard/TaskList";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { ProgressBar } from "@/components/ProgressBar";
import { AttendanceStatusGroup } from "@/components/DayCard";
import TraineeDashboardPage from "@/app/[locale]/trainee/page";
import { useAuth } from "@/lib/auth/AuthContext";
import { dashboardApi } from "@/lib/api/endpoints";
import type { DashboardTask } from "@/lib/dashboard/derive";
import type { DashboardEntryDto } from "@/lib/api/types";

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

describe("StatCards", () => {
  it("shows a calm dash with a reason (never 0) when stats are unavailable", () => {
    renderWithIntl(<StatCards stats={null} />);
    expect(screen.getAllByText("—")).toHaveLength(4);
    expect(screen.queryByText("0")).not.toBeInTheDocument();
    expect(screen.getByText("Not enough data about the current program yet.")).toBeInTheDocument();
  });

  it("shows a dash and reason for a null completion rate but keeps real counts", () => {
    renderWithIntl(
      <StatCards stats={{ courses_count: 2, training_days_count: 0, training_hours: 0, progress_percent: null }} />,
    );
    expect(screen.getAllByText("—")).toHaveLength(1);
    expect(screen.getByText("No training days yet, so there is nothing to measure.")).toBeInTheDocument();
  });

  it("renders the primary completion card with a supporting ratio and labelled progress bars", () => {
    renderWithIntl(
      <StatCards
        stats={{ courses_count: 3, training_days_count: 10, training_hours: 24.5, progress_percent: 40 }}
        daysRatio={{ done: 4, total: 10 }}
        coursesRatio={{ done: 1, total: 3 }}
      />,
    );
    expect(screen.getByText("40%")).toBeInTheDocument();
    expect(screen.getByText("24.5")).toBeInTheDocument();
    expect(screen.getByText("4 of 10 training days completed")).toBeInTheDocument();
    const bar = screen.getByRole("progressbar", { name: "Completed training days" });
    expect(bar).toHaveAttribute("aria-valuenow", "4");
    expect(bar).toHaveAttribute("aria-valuemax", "10");
  });

  it("renders Arabic labels", () => {
    renderWithIntl(<StatCards stats={null} />, { locale: "ar" });
    expect(screen.getAllByText("غير متاح بعد")).toHaveLength(4);
  });
});

describe("ProgressBar", () => {
  it("exposes progressbar semantics with min/max/now and a text alternative", () => {
    renderWithIntl(<ProgressBar done={3} total={12} label="Surveys" valueText="3 of 12" />);
    const bar = screen.getByRole("progressbar", { name: "Surveys" });
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "12");
    expect(bar).toHaveAttribute("aria-valuenow", "3");
    expect(bar).toHaveAttribute("aria-valuetext", "3 of 12");
  });

  it("clamps an out-of-range value", () => {
    renderWithIntl(<ProgressBar done={9} total={4} label="x" valueText="x" />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "4");
  });
});

describe("AttendanceStatusGroup", () => {
  it("shows only the continue action, with no status badge, count text or progress bar, once some attendance is recorded", () => {
    renderWithIntl(
      <AttendanceStatusGroup attendance={{ recorded_count: 12, total_enrolled: 30, complete: false }} dayStatus="open" href="/s/1/attendance" />,
    );
    const group = screen.getByRole("group", { name: "Attendance" });
    // The visible "Attendance Status" caption, and the status badge that
    // used to carry it as an accessible name, were both dropped: the
    // action button's own label already communicates the state.
    expect(within(group).queryByText("Attendance Status")).not.toBeInTheDocument();
    expect(within(group).queryByText("Partially recorded")).not.toBeInTheDocument();
    expect(within(group).queryByText("12 of 30 recorded")).not.toBeInTheDocument();
    expect(within(group).queryByRole("progressbar")).not.toBeInTheDocument();
    expect(within(group).getByRole("link", { name: "Continue attendance" })).toHaveAttribute("href", "/s/1/attendance");
  });

  it("still uses Complete-day wording on the action even though the badge is gone", () => {
    renderWithIntl(
      <AttendanceStatusGroup attendance={{ recorded_count: 30, total_enrolled: 30, complete: true }} dayStatus="open" href="/x" />,
    );
    expect(screen.queryByText("Complete")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View attendance" })).toBeInTheDocument();
  });

  it("offers Record attendance when nothing is recorded yet on an open day", () => {
    renderWithIntl(
      <AttendanceStatusGroup attendance={{ recorded_count: 0, total_enrolled: 5, complete: false }} dayStatus="open" href="/x" />,
    );
    expect(screen.queryByText("Not recorded")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Record attendance" })).toBeInTheDocument();
  });

  it("offers Record attendance (not a disabled state) when nobody is enrolled", () => {
    renderWithIntl(
      <AttendanceStatusGroup attendance={{ recorded_count: 0, total_enrolled: 0, complete: false }} dayStatus="open" href="/x" />,
    );
    expect(screen.queryByText("No trainees enrolled")).not.toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Record attendance" })).toBeInTheDocument();
  });

  it("renders the Arabic Continue-attendance label for a partially recorded open day, and renders nothing without attendance data", () => {
    const { container, unmount } = renderWithIntl(
      <AttendanceStatusGroup attendance={{ recorded_count: 1, total_enrolled: 4, complete: false }} dayStatus="open" href="/x" />,
      { locale: "ar" },
    );
    expect(screen.getByRole("link", { name: "استكمال الحضور" })).toBeInTheDocument();
    unmount();
    const empty = renderWithIntl(<AttendanceStatusGroup dayStatus="open" href="/x" />);
    expect(empty.container).toBeEmptyDOMElement();
    expect(container).toBeDefined();
  });

  it.each(["closed", "postponed", "cancelled"] as const)(
    "a %s day always offers a real, enabled 'View attendance' link -- never a disabled/missed state -- even when nothing was recorded",
    (dayStatus) => {
      renderWithIntl(
        <AttendanceStatusGroup
          attendance={{ recorded_count: 0, total_enrolled: 10, complete: false }}
          dayStatus={dayStatus}
          href="/s/1/attendance"
        />,
      );
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
      expect(screen.getByRole("link", { name: "View attendance" })).toHaveAttribute("href", "/s/1/attendance");
    },
  );

  it("a closed day with partially recorded attendance also links to View attendance, not Record/Continue attendance", () => {
    renderWithIntl(
      <AttendanceStatusGroup
        attendance={{ recorded_count: 4, total_enrolled: 10, complete: false }}
        dayStatus="closed"
        href="/x"
      />,
    );
    expect(screen.getByRole("link", { name: "View attendance" })).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("an open day with nothing recorded yet still offers the editable Record attendance action", () => {
    renderWithIntl(
      <AttendanceStatusGroup
        attendance={{ recorded_count: 0, total_enrolled: 10, complete: false }}
        dayStatus="open"
        href="/x"
      />,
    );
    expect(screen.getByRole("link", { name: "Record attendance" })).toBeInTheDocument();
  });

  it("an open day with some but not all attendance recorded offers Continue attendance, filled as the primary action", () => {
    renderWithIntl(
      <AttendanceStatusGroup
        attendance={{ recorded_count: 3, total_enrolled: 10, complete: false }}
        dayStatus="open"
        href="/x"
      />,
    );
    const link = screen.getByRole("link", { name: "Continue attendance" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveClass("button");
    expect(link).not.toHaveClass("button--secondary");
  });

  it("renders the view action outlined (button--secondary), not filled", () => {
    renderWithIntl(
      <AttendanceStatusGroup
        attendance={{ recorded_count: 10, total_enrolled: 10, complete: true }}
        dayStatus="open"
        href="/x"
      />,
    );
    const link = screen.getByRole("link", { name: "View attendance" });
    expect(link).toHaveClass("button", "button--secondary");
  });
});

const task = (over: Partial<DashboardTask> = {}): DashboardTask => ({
  id: "required-1",
  labelKey: "taskSurveyRequired",
  kind: "survey",
  courseName: "Course One",
  badge: "required",
  href: "/trainee/1",
  date: "2026-09-10",
  startDatetime: "2026-09-10 08:00:00",
  endDatetime: "2026-09-10 10:00:00",
  dayState: "open",
  ...over,
});

describe("TaskList", () => {
  it("renders each task with label, course, date/time, a text status and one action", () => {
    mockAuthenticated();
    renderWithIntl(
      <TaskList
        viewAllHref="/trainee/days"
        tasks={[task(), task({ id: "upcoming-2", badge: "upcoming", courseName: "Course Two", href: "/trainee/2" })]}
      />,
    );
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Complete the training day survey");
    expect(items[0]).toHaveTextContent("Course One");
    expect(items[0]).toHaveTextContent("Required");
    expect(items[0]).toHaveTextContent("Open survey");
    expect(items[0]).toHaveTextContent(/2026/);
    expect(within(items[0]).getAllByRole("link")).toHaveLength(1);
    expect(items[1]).toHaveTextContent("Upcoming");
    expect(items[1]).toHaveTextContent("View day");
  });

  it("shows a positive 'all caught up' state (not an error) when there are days but no tasks", () => {
    mockAuthenticated();
    renderWithIntl(<TaskList viewAllHref="/x" tasks={[]} />);
    expect(screen.getByText("You're all caught up")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows a neutral no-days state when nothing is scheduled at all", () => {
    mockAuthenticated();
    renderWithIntl(<TaskList viewAllHref="/x" tasks={[]} hasDays={false} />);
    expect(screen.getByText("No training days yet")).toBeInTheDocument();
    expect(screen.queryByText("You're all caught up")).not.toBeInTheDocument();
  });

  it("renders Arabic task copy", () => {
    mockAuthenticated();
    renderWithIntl(<TaskList viewAllHref="/x" tasks={[task()]} />, { locale: "ar" });
    expect(screen.getByText("فتح الاستبيان")).toBeInTheDocument();
  });
});

describe("DashboardSkeleton", () => {
  it("announces loading once and hides the placeholder shapes", () => {
    renderWithIntl(<DashboardSkeleton label="Loading your training days..." />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Loading your training days...")).toBeInTheDocument();
  });
});

const dayEntry: DashboardEntryDto = {
  training_day_id: 1,
  course_id: 1,
  program_id: 1,
  date: "2026-09-10",
  course_name: "Course One",
  program_name: "Demo Program",
  start_datetime: null,
  end_datetime: null,
  state: "closed",
  survey_open_at: null,
  survey_close_at: null,
  survey: {
    configured: true,
    response: { response_id: 1, state: "submitted", submitted_at: null, editable: false },
    can_submit: false,
    reason: "already_submitted",
  },
};

describe("Trainee dashboard states", () => {
  it("skeleton first, then content, with exactly one h1", async () => {
    mockAuthenticated();
    vi.mocked(dashboardApi.get).mockResolvedValue({
      days: [dayEntry],
      program: { id: 1, name: "Demo Program", start_date: "2026-09-01", end_date: "2026-09-30" },
      stats: { courses_count: 1, training_days_count: 1, training_hours: 4, progress_percent: 100 },
      next_session: null,
    });
    renderWithIntl(<TraineeDashboardPage />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    await waitFor(() => expect(screen.getByText("Welcome back, Dev Trainee")).toBeInTheDocument());
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("with a program and days but no tasks or upcoming day: 'all caught up' and 'no upcoming' (no error)", async () => {
    mockAuthenticated();
    vi.mocked(dashboardApi.get).mockResolvedValue({
      days: [dayEntry],
      program: { id: 1, name: "Demo Program", start_date: "2026-09-01", end_date: "2026-09-30" },
      stats: { courses_count: 1, training_days_count: 1, training_hours: 4, progress_percent: 100 },
      next_session: null,
    });
    renderWithIntl(<TraineeDashboardPage />);
    await waitFor(() => expect(screen.getByText("You're all caught up")).toBeInTheDocument());
    expect(screen.getByText("No upcoming training day")).toBeInTheDocument();
    expect(screen.queryByText("No program assigned")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("with a program but no days yet: 'no training days yet' rather than 'caught up' or 'not assigned'", async () => {
    mockAuthenticated();
    vi.mocked(dashboardApi.get).mockResolvedValue({
      days: [],
      program: { id: 1, name: "Demo Program", start_date: "2026-09-01", end_date: "2026-09-30" },
      stats: { courses_count: 0, training_days_count: 0, training_hours: 0, progress_percent: null },
      next_session: null,
    });
    renderWithIntl(<TraineeDashboardPage />);
    await waitFor(() => expect(screen.getAllByText("No training days yet").length).toBeGreaterThan(0));
    expect(screen.queryByText("You're all caught up")).not.toBeInTheDocument();
    expect(screen.queryByText("No program assigned")).not.toBeInTheDocument();
    expect(screen.getByText("No training days yet, so there is nothing to measure.")).toBeInTheDocument();
  });
});
