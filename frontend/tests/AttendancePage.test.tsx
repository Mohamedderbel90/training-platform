import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithIntl, chooseOption } from "./testUtils";
import { AttendanceContent } from "@/app/[locale]/supervisor/[dayId]/attendance/page";
import { useAuth } from "@/lib/auth/AuthContext";
import { supervisorApi, dashboardApi } from "@/lib/api/endpoints";
import { ApiError } from "@/lib/api/client";
import { Link } from "@/i18n/navigation";
import type { DashboardEntryDto, TrainingDayStatus } from "@/lib/api/types";

vi.mock("@/i18n/navigation", () => import("./mocks/i18nNavigation"));
vi.mock("@/lib/auth/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("@/lib/api/endpoints", () => ({
  supervisorApi: { getAttendance: vi.fn(), putAttendance: vi.fn(), getSurvey: vi.fn(), submitSurvey: vi.fn() },
  dashboardApi: { get: vi.fn(), getDay: vi.fn() },
}));

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

/** Mocks the per-day lookup `AttendanceContent` uses to decide
 * read-only vs editable, for training day id 1 (every test in this file
 * uses `dayId={1}`). Tests that exercise the editable path rely on the
 * `beforeEach` default of "open" below; the read-only tests override it. */
function mockDayState(state: TrainingDayStatus) {
  const entry: DashboardEntryDto = {
    training_day_id: 1,
    course_id: 1,
    program_id: 1,
    date: "2026-01-05",
    course_name: "Course A",
    program_name: "Program A",
    start_datetime: null,
    end_datetime: null,
    state,
    survey_open_at: null,
    survey_close_at: null,
  };
  vi.mocked(dashboardApi.getDay).mockResolvedValue(entry);
}

beforeEach(() => {
  mockDayState("open");
});

describe("Supervisor attendance page", () => {
  it("renders one row per enrolled trainee with status controls", async () => {
    mockAuthenticated();
    vi.mocked(supervisorApi.getAttendance).mockResolvedValue({
      items: [{ trainee_id: 10, name: "Dev Trainee", status: null, late_minutes: null }],
    });
    renderWithIntl(<AttendanceContent dayId={1} />);

    await waitFor(() => expect(screen.getByText("Dev Trainee")).toBeInTheDocument());
    expect(screen.getByLabelText("Present")).toBeInTheDocument();
    expect(screen.getByLabelText("Absent")).toBeInTheDocument();
    expect(screen.getByLabelText("Late")).toBeInTheDocument();
  });

  it("only shows the late-minutes input once Late is selected", async () => {
    mockAuthenticated();
    vi.mocked(supervisorApi.getAttendance).mockResolvedValue({
      items: [{ trainee_id: 10, name: "Dev Trainee", status: "present", late_minutes: null }],
    });
    renderWithIntl(<AttendanceContent dayId={1} />);
    await waitFor(() => expect(screen.getByText("Dev Trainee")).toBeInTheDocument());

    expect(screen.queryByLabelText("Late minutes")).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Late"));
    expect(screen.getByLabelText("Late minutes")).toBeInTheDocument();
  });

  it("saves the bulk upsert payload with late_minutes only for late entries", async () => {
    mockAuthenticated();
    vi.mocked(supervisorApi.getAttendance).mockResolvedValue({
      items: [{ trainee_id: 10, name: "Dev Trainee", status: "present", late_minutes: null }],
    });
    vi.mocked(supervisorApi.putAttendance).mockResolvedValue({
      items: [{ trainee_id: 10, name: "Dev Trainee", status: "late", late_minutes: 15 }],
    });
    renderWithIntl(<AttendanceContent dayId={1} />);
    await waitFor(() => expect(screen.getByText("Dev Trainee")).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText("Late"));
    fireEvent.change(screen.getByLabelText("Late minutes"), { target: { value: "15" } });
    fireEvent.click(screen.getByRole("button", { name: "Save attendance" }));

    await waitFor(() =>
      expect(supervisorApi.putAttendance).toHaveBeenCalledWith(
        1,
        [{ trainee_id: 10, status: "late", late_minutes: 15 }],
        "en",
      ),
    );
    expect(await screen.findByText("Attendance saved")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Attendance saved");
    // Saved: no unsaved-changes indicator remains.
    expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument();
  });

  it("asks before following an in-app link while there are unsaved changes (FB-1)", async () => {
    mockAuthenticated();
    vi.mocked(supervisorApi.getAttendance).mockResolvedValue({
      items: [{ trainee_id: 10, name: "Dev Trainee", status: null, late_minutes: null }],
    });
    renderWithIntl(
      <div>
        <Link href="/elsewhere">Dashboard link</Link>
        <AttendanceContent dayId={1} />
      </div>,
    );
    await waitFor(() => expect(screen.getByText("Dev Trainee")).toBeInTheDocument());

    // Bubble-phase probe: it only sees clicks the guard let through.
    const reached = vi.fn((event: Event) => event.preventDefault());
    document.addEventListener("click", reached);
    const link = screen.getByText("Dashboard link");

    // Nothing edited yet: no warning, the click goes through untouched.
    fireEvent.click(link);
    expect(reached).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Present"));
    reached.mockClear();
    fireEvent.click(link);
    expect(reached).not.toHaveBeenCalled(); // the guard stopped it
    const dialog = await screen.findByRole("dialog", { name: "Leave without saving?" });
    expect(dialog).toBeInTheDocument();

    // "Stay on page" closes it and keeps the edits.
    document.removeEventListener("click", reached);
    fireEvent.click(screen.getByRole("button", { name: "Stay on page" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByLabelText("Present")).toBeChecked();
  });

  it("does not warn after the attendance has been saved (FB-1)", async () => {
    mockAuthenticated();
    vi.mocked(supervisorApi.getAttendance).mockResolvedValue({
      items: [{ trainee_id: 10, name: "Dev Trainee", status: null, late_minutes: null }],
    });
    vi.mocked(supervisorApi.putAttendance).mockResolvedValue({
      items: [{ trainee_id: 10, name: "Dev Trainee", status: "present", late_minutes: null }],
    });
    renderWithIntl(
      <div>
        <Link href="/elsewhere">Dashboard link</Link>
        <AttendanceContent dayId={1} />
      </div>,
    );
    await waitFor(() => expect(screen.getByText("Dev Trainee")).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText("Present"));
    fireEvent.click(screen.getByRole("button", { name: "Save attendance" }));
    await screen.findByText("Attendance saved");
    // Let the passive effect that removes the guard flush before clicking.
    await waitFor(() => expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument());
    await new Promise((resolve) => setTimeout(resolve, 0));

    const reached = vi.fn((event: Event) => event.preventDefault());
    document.addEventListener("click", reached);
    fireEvent.click(screen.getByText("Dashboard link"));
    document.removeEventListener("click", reached);
    expect(reached).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows an unsaved-changes indicator after an edit and a busy save button while saving", async () => {
    mockAuthenticated();
    vi.mocked(supervisorApi.getAttendance).mockResolvedValue({
      items: [{ trainee_id: 10, name: "Dev Trainee", status: "present", late_minutes: null }],
    });
    let resolve!: (v: unknown) => void;
    vi.mocked(supervisorApi.putAttendance).mockReturnValue(new Promise((r) => (resolve = r)) as never);
    renderWithIntl(<AttendanceContent dayId={1} />);
    await waitFor(() => expect(screen.getByText("Dev Trainee")).toBeInTheDocument());
    expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Absent"));
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save attendance" }));
    const busy = await screen.findByRole("button", { name: "Saving..." });
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute("aria-busy", "true");
    expect(supervisorApi.putAttendance).toHaveBeenLastCalledWith(
      1,
      [{ trainee_id: 10, status: "absent" }],
      "en",
    );
    resolve({ items: [{ trainee_id: 10, name: "Dev Trainee", status: "absent", late_minutes: null }] });
    expect(await screen.findByText("Attendance saved")).toBeInTheDocument();
  });

  it("warns before unload only while there are unsaved edits", async () => {
    mockAuthenticated();
    vi.mocked(supervisorApi.getAttendance).mockResolvedValue({
      items: [{ trainee_id: 10, name: "Dev Trainee", status: "present", late_minutes: null }],
    });
    renderWithIntl(<AttendanceContent dayId={1} />);
    await waitFor(() => expect(screen.getByText("Dev Trainee")).toBeInTheDocument());
    const clean = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);
    fireEvent.click(screen.getByLabelText("Absent"));
    const dirty = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(dirty);
    expect(dirty.defaultPrevented).toBe(true);
  });

  it("surfaces a server validation error instead of silently failing the save", async () => {
    mockAuthenticated();
    vi.mocked(supervisorApi.getAttendance).mockResolvedValue({
      items: [{ trainee_id: 10, name: "Dev Trainee", status: "present", late_minutes: null }],
    });
    vi.mocked(supervisorApi.putAttendance).mockRejectedValue(
      new ApiError(
        { code: "VALIDATION_ERROR", message: "Trainee 10 is not an active enrollment in this training day's program.", fields: null },
        422,
        "req_1",
      ),
    );
    renderWithIntl(<AttendanceContent dayId={1} />);
    await waitFor(() => expect(screen.getByText("Dev Trainee")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Save attendance" }));

    expect(
      await screen.findByText("Trainee 10 is not an active enrollment in this training day's program."),
    ).toBeInTheDocument();
  });

  describe("search and status filter (display only)", () => {
    const names = ["أحمد", "Beth", "Carla", "Dina", "Emma", "Fatima", "Gina", "Hana"];
    const items = names.map((name, i) => ({
      trainee_id: 100 + i,
      name,
      status: (i === 0 ? null : i % 3 === 0 ? "absent" : i % 3 === 1 ? "present" : "late") as "present" | "absent" | "late" | null,
      late_minutes: i % 3 === 2 ? 5 : null,
    }));

    it("filters displayed rows by Arabic-normalised name and by status, with a live summary", async () => {
      const user = userEvent.setup();
      mockAuthenticated();
      vi.mocked(supervisorApi.getAttendance).mockResolvedValue({ items });
      renderWithIntl(<AttendanceContent dayId={1} />);
      await screen.findByText("Beth");

      const summary = screen.getByRole("list", { name: "Attendance summary" });
      // "Not yet saved" is separate; present/absent/late describe the current
      // selection of all rows (the unsaved trainee has no status selected, DEC-05).
      expect(within(summary).getByText("Not yet saved: 1")).toBeInTheDocument();
      expect(within(summary).getByText("Present: 3")).toBeInTheDocument();
      expect(within(summary).getByText("Absent: 2")).toBeInTheDocument();
      expect(within(summary).getByText("Late: 2")).toBeInTheDocument();
      expect(screen.getByText(/Nothing is pre-selected/)).toBeInTheDocument();

      await user.type(screen.getByRole("searchbox", { name: "Search trainees" }), "احمد");
      await waitFor(() => expect(screen.queryByText("Beth")).not.toBeInTheDocument());
      expect(screen.getByText("أحمد")).toBeInTheDocument();
      expect(screen.getByText("Showing 1 of 8 trainees")).toBeInTheDocument();

      await user.clear(screen.getByRole("searchbox", { name: "Search trainees" }));
      await screen.findByText("Beth");
      await chooseOption(user, "Status", "Late");
      await waitFor(() => expect(screen.queryByText("Beth")).not.toBeInTheDocument());
      expect(screen.getByText("Carla")).toBeInTheDocument();

      await user.type(screen.getByRole("searchbox", { name: "Search trainees" }), "zzz");
      expect(await screen.findByText("No results for “zzz”")).toBeInTheDocument();
      await user.click(screen.getAllByRole("button", { name: "Clear filters" })[0]);
      expect(await screen.findByText("Beth")).toBeInTheDocument();
      expect(supervisorApi.getAttendance).toHaveBeenCalledTimes(1);
    });

    it("never drops hidden rows from the saved payload", async () => {
      const user = userEvent.setup();
      mockAuthenticated();
      vi.mocked(supervisorApi.getAttendance).mockResolvedValue({ items });
      vi.mocked(supervisorApi.putAttendance).mockResolvedValue({ items });
      renderWithIntl(<AttendanceContent dayId={1} />);
      await screen.findByText("Beth");

      await chooseOption(user, "Status", "Absent");
      await waitFor(() => expect(screen.queryByText("Beth")).not.toBeInTheDocument());
      expect(screen.getAllByRole("radiogroup")).toHaveLength(2);

      await user.click(screen.getByRole("button", { name: "Save attendance" }));
      await waitFor(() => expect(supervisorApi.putAttendance).toHaveBeenCalledTimes(1));
      expect(supervisorApi.putAttendance).toHaveBeenCalledWith(
        1,
        [
          { trainee_id: 101, status: "present" },
          { trainee_id: 102, status: "late", late_minutes: 5 },
          { trainee_id: 103, status: "absent" },
          { trainee_id: 104, status: "present" },
          { trainee_id: 105, status: "late", late_minutes: 5 },
          { trainee_id: 106, status: "absent" },
          { trainee_id: 107, status: "present" },
        ],
        "en",
      );
    });

    it("keeps an edited row visible under an active status filter while summary counts follow the edit", async () => {
      const user = userEvent.setup();
      mockAuthenticated();
      vi.mocked(supervisorApi.getAttendance).mockResolvedValue({ items });
      vi.mocked(supervisorApi.putAttendance).mockResolvedValue({ items });
      renderWithIntl(<AttendanceContent dayId={1} />);
      await screen.findByText("Beth");
      await chooseOption(user, "Status", "Absent");
      await waitFor(() => expect(screen.queryByText("Beth")).not.toBeInTheDocument());
      const dina = screen.getByRole("radiogroup", { name: "Status for Dina" });
      const summary = screen.getByRole("list", { name: "Attendance summary" });
      expect(within(summary).getByText("Absent: 2")).toBeInTheDocument();

      await user.click(within(dina).getByLabelText("Present"));
      // Row stays put (filter uses the baseline), counts are live.
      expect(screen.getByRole("radiogroup", { name: "Status for Dina" })).toBeInTheDocument();
      expect(within(summary).getByText("Absent: 1")).toBeInTheDocument();
      expect(within(summary).getByText("Present: 4")).toBeInTheDocument();

      // Changing the filter re-evaluates against the new selection.
      await chooseOption(user, "Status", "All");
      await chooseOption(user, "Status", "Absent");
      await waitFor(() => expect(screen.queryByRole("radiogroup", { name: "Status for Dina" })).not.toBeInTheDocument());

      // Payload: every row with a chosen status; the unrecorded trainee
      // (100) is never sent (DEC-05).
      await user.click(screen.getByRole("button", { name: "Save attendance" }));
      await waitFor(() => expect(supervisorApi.putAttendance).toHaveBeenCalledTimes(1));
      expect(supervisorApi.putAttendance).toHaveBeenCalledWith(
        1,
        [
          { trainee_id: 101, status: "present" },
          { trainee_id: 102, status: "late", late_minutes: 5 },
          { trainee_id: 103, status: "present" },
          { trainee_id: 104, status: "present" },
          { trainee_id: 105, status: "late", late_minutes: 5 },
          { trainee_id: 106, status: "absent" },
          { trainee_id: 107, status: "present" },
        ],
        "en",
      );
    });

    it("keeps edits made to a row that is later hidden by a filter", async () => {
      const user = userEvent.setup();
      mockAuthenticated();
      vi.mocked(supervisorApi.getAttendance).mockResolvedValue({ items });
      vi.mocked(supervisorApi.putAttendance).mockResolvedValue({ items });
      renderWithIntl(<AttendanceContent dayId={1} />);
      await screen.findByText("Beth");
      const bethGroup = screen.getByRole("radiogroup", { name: "Status for Beth" });
      await user.click(within(bethGroup).getByLabelText("Absent"));
      await user.type(screen.getByRole("searchbox", { name: "Search trainees" }), "carla");
      await waitFor(() => expect(screen.queryByText("Beth")).not.toBeInTheDocument());
      await user.click(screen.getByRole("button", { name: "Save attendance" }));
      await waitFor(() => expect(supervisorApi.putAttendance).toHaveBeenCalled());
      const payload = vi.mocked(supervisorApi.putAttendance).mock.calls[0][1];
      expect(payload).toHaveLength(7);
      expect(payload.find((r) => r.trainee_id === 101)).toEqual({ trainee_id: 101, status: "absent" });
    });

    it("does not pre-select unrecorded trainees; 'Mark remaining as Present' is an explicit action (DEC-05)", async () => {
      const user = userEvent.setup();
      mockAuthenticated();
      vi.mocked(supervisorApi.getAttendance).mockResolvedValue({ items });
      vi.mocked(supervisorApi.putAttendance).mockResolvedValue({ items });
      renderWithIntl(<AttendanceContent dayId={1} />);
      await screen.findByText("Beth");
      const first = screen.getByRole("radiogroup", { name: "Status for أحمد" });
      for (const label of ["Present", "Absent", "Late"]) {
        expect(within(first).getByLabelText(label)).not.toBeChecked();
      }
      await user.click(screen.getByRole("button", { name: "Mark remaining as Present" }));
      expect(within(first).getByLabelText("Present")).toBeChecked();
      await user.click(screen.getByRole("button", { name: "Save attendance" }));
      await waitFor(() => expect(supervisorApi.putAttendance).toHaveBeenCalledTimes(1));
      expect(vi.mocked(supervisorApi.putAttendance).mock.calls[0][1]).toHaveLength(8);
    });

    it("disables Save while no trainee has a status chosen", async () => {
      mockAuthenticated();
      vi.mocked(supervisorApi.getAttendance).mockResolvedValue({
        items: [{ trainee_id: 10, name: "Dev Trainee", status: null, late_minutes: null }],
      });
      renderWithIntl(<AttendanceContent dayId={1} />);
      await screen.findByText("Dev Trainee");
      expect(screen.getByRole("button", { name: "Save attendance" })).toBeDisabled();
    });

    it("renders rows in the stacked-capable markup (labelled cells, no wide-only layout)", async () => {
      mockAuthenticated();
      vi.mocked(supervisorApi.getAttendance).mockResolvedValue({ items });
      const { container } = renderWithIntl(<AttendanceContent dayId={1} />);
      await screen.findByText("Beth");
      expect(container.querySelector(".table-scroll--stacked table.data-table--stacked")).toBeInTheDocument();
      const row = screen.getByText("Beth").closest("tr") as HTMLElement;
      expect(row.querySelector("td.attendance-name")).toHaveAttribute("data-label", "Name");
      expect(row.querySelector('td[data-label="Status"] [role="radiogroup"]')).toBeInTheDocument();
      expect(row.querySelector('td[data-label="Late minutes"]')).toBeInTheDocument();
      // Not-late rows mark the N/A cell so narrow screens can hide it.
      expect(row.querySelector("td.attendance-late--na")).toBeInTheDocument();
    });

    it("keeps table semantics explicit (roles) for the display:block stacked layout", async () => {
      mockAuthenticated();
      vi.mocked(supervisorApi.getAttendance).mockResolvedValue({ items });
      renderWithIntl(<AttendanceContent dayId={1} />);
      await screen.findByText("Beth");
      expect(screen.getByRole("table")).toBeInTheDocument();
      expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
        "Name",
        "Status",
        "Late minutes",
      ]);
      // header row + one row per trainee
      expect(screen.getAllByRole("row")).toHaveLength(items.length + 1);
      expect(screen.getAllByRole("cell").length).toBe(items.length * 3);
    });

    it("hides search and filter on short lists but keeps the summary", async () => {
      mockAuthenticated();
      vi.mocked(supervisorApi.getAttendance).mockResolvedValue({ items: items.slice(0, 3) });
      renderWithIntl(<AttendanceContent dayId={1} />);
      await screen.findByText("Beth");
      expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
      expect(screen.getByRole("list", { name: "Attendance summary" })).toBeInTheDocument();
    });

    it("shows a skeleton while loading", () => {
      mockAuthenticated();
      vi.mocked(supervisorApi.getAttendance).mockReturnValue(new Promise(() => {}));
      const { container } = renderWithIntl(<AttendanceContent dayId={1} />);
      expect(screen.getByText("Loading attendance...")).toBeInTheDocument();
      expect(container.querySelector(".skeleton-rows")).toBeInTheDocument();
    });

    it("keeps showing the skeleton while the day's own state is still loading, even once attendance has arrived", async () => {
      mockAuthenticated();
      vi.mocked(supervisorApi.getAttendance).mockResolvedValue({ items: items.slice(0, 2) });
      vi.mocked(dashboardApi.getDay).mockReturnValue(new Promise(() => {}));
      const { container } = renderWithIntl(<AttendanceContent dayId={1} />);
      // Give the attendance fetch a tick to resolve; the page must still
      // not render editable controls while day-state resolution is
      // pending, so it never flashes editable then flips to read-only.
      await new Promise((r) => setTimeout(r, 0));
      expect(container.querySelector(".skeleton-rows")).toBeInTheDocument();
      expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    });
  });

  it("locks a day of another program too, because the day is fetched by id", async () => {
    mockAuthenticated();
    mockDayState("closed");
    // the selected program's dashboard list does not contain this day
    vi.mocked(dashboardApi.get).mockResolvedValue({ days: [], program: null, stats: null, next_session: null });
    vi.mocked(supervisorApi.getAttendance).mockResolvedValue({
      items: [{ trainee_id: 10, name: "Dev Trainee", status: "present" as const, late_minutes: null }],
    });
    renderWithIntl(<AttendanceContent dayId={1} />);

    await screen.findByText("Dev Trainee");
    expect(screen.getByText(/This training day is closed/)).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });

  describe("planned day: not open yet", () => {
    it("is read-only with its own notice, so nothing can be filled in before the day is opened", async () => {
      mockAuthenticated();
      mockDayState("planned");
      vi.mocked(supervisorApi.getAttendance).mockResolvedValue({
        items: [{ trainee_id: 10, name: "Dev Trainee", status: null, late_minutes: null }],
      });
      renderWithIntl(<AttendanceContent dayId={1} />);

      await screen.findByText("Dev Trainee");
      expect(screen.getByText(/has not been opened yet/)).toBeInTheDocument();
      expect(screen.queryByText(/This training day is closed/)).not.toBeInTheDocument();
      expect(screen.queryByRole("radio")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Save attendance" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Mark remaining as Present" })).not.toBeInTheDocument();
    });
  });

  describe("closed day: read-only", () => {
    const closedItems = [
      { trainee_id: 10, name: "Dev Trainee", status: "present" as const, late_minutes: null },
      { trainee_id: 11, name: "Second Trainee", status: null, late_minutes: null },
      { trainee_id: 12, name: "Third Trainee", status: "late" as const, late_minutes: 7 },
    ];

    it("renders no editable controls, shows the real recorded status per row, and a genuine 'not recorded' row (no fabricated default)", async () => {
      mockAuthenticated();
      mockDayState("closed");
      vi.mocked(supervisorApi.getAttendance).mockResolvedValue({ items: closedItems });
      renderWithIntl(<AttendanceContent dayId={1} />);

      await screen.findByText("Dev Trainee");
      // Read-only notice shown instead of the save form's error/status slots.
      expect(screen.getByText(/This training day is closed/)).toBeInTheDocument();

      // No editing surface anywhere.
      expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
      expect(screen.queryByRole("radio")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("Late minutes")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Save attendance" })).not.toBeInTheDocument();
      expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument();

      // Plain, real values per row.
      expect(screen.getByText("Present")).toBeInTheDocument();
      expect(screen.getByText("7")).toBeInTheDocument();
      // Never recorded: a genuine "Not recorded" indicator, not a
      // fabricated "Present" default (that fabrication is editable-mode
      // only UX, not real data).
      const secondRow = screen.getByText("Second Trainee").closest("tr") as HTMLElement;
      expect(within(secondRow).getByText("Not recorded")).toBeInTheDocument();

      // Summary counts reflect only what was actually recorded.
      const summary = screen.getByRole("list", { name: "Attendance summary" });
      expect(within(summary).getByText("Present: 1")).toBeInTheDocument();
      expect(within(summary).getByText("Late: 1")).toBeInTheDocument();
      expect(within(summary).getByText("Absent: 0")).toBeInTheDocument();
      expect(within(summary).getByText("Not recorded: 1")).toBeInTheDocument();
    });

    it.each(["postponed", "cancelled"] as const)(
      "also renders read-only for a %s day",
      async (state) => {
        mockAuthenticated();
        mockDayState(state);
        vi.mocked(supervisorApi.getAttendance).mockResolvedValue({ items: closedItems });
        renderWithIntl(<AttendanceContent dayId={1} />);
        await screen.findByText("Dev Trainee");
        expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Save attendance" })).not.toBeInTheDocument();
      },
    );

    it("search still filters the read-only rows, but nothing implies editability", async () => {
      const user = userEvent.setup();
      mockAuthenticated();
      mockDayState("closed");
      // The search/filter toolbar only shows above TOOLBAR_MIN_ENTRIES (6).
      const manyItems = [
        ...closedItems,
        { trainee_id: 13, name: "Fourth Trainee", status: "absent" as const, late_minutes: null },
        { trainee_id: 14, name: "Fifth Trainee", status: "present" as const, late_minutes: null },
        { trainee_id: 15, name: "Sixth Trainee", status: null, late_minutes: null },
      ];
      vi.mocked(supervisorApi.getAttendance).mockResolvedValue({ items: manyItems });
      renderWithIntl(<AttendanceContent dayId={1} />);
      await screen.findByText("Dev Trainee");

      await user.type(screen.getByRole("searchbox", { name: "Search trainees" }), "second");
      await waitFor(() => expect(screen.queryByText("Dev Trainee")).not.toBeInTheDocument());
      expect(screen.getByText("Second Trainee")).toBeInTheDocument();
      expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    });
  });
});
