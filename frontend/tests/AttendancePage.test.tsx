import { describe, it, expect, vi } from "vitest";
import { screen, waitFor, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithIntl } from "./testUtils";
import { AttendanceContent } from "@/app/[locale]/supervisor/[dayId]/attendance/page";
import { useAuth } from "@/lib/auth/AuthContext";
import { supervisorApi } from "@/lib/api/endpoints";
import { ApiError } from "@/lib/api/client";

vi.mock("@/i18n/navigation", () => import("./mocks/i18nNavigation"));
vi.mock("@/lib/auth/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("@/lib/api/endpoints", () => ({
  supervisorApi: { getAttendance: vi.fn(), putAttendance: vi.fn(), getSurvey: vi.fn(), submitSurvey: vi.fn() },
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
      expect(within(summary).getByText("Not recorded: 1")).toBeInTheDocument();
      // Unrecorded rows are preselected "present" locally, so 1 + 3 present.
      expect(within(summary).getByText("Present: 4")).toBeInTheDocument();

      await user.type(screen.getByRole("searchbox", { name: "Search trainees" }), "احمد");
      await waitFor(() => expect(screen.queryByText("Beth")).not.toBeInTheDocument());
      expect(screen.getByText("أحمد")).toBeInTheDocument();
      expect(screen.getByText("Showing 1 of 8 trainees")).toBeInTheDocument();

      await user.clear(screen.getByRole("searchbox", { name: "Search trainees" }));
      await screen.findByText("Beth");
      await user.selectOptions(screen.getByLabelText("Status"), "late");
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

      await user.selectOptions(screen.getByLabelText("Status"), "absent");
      await waitFor(() => expect(screen.queryByText("Beth")).not.toBeInTheDocument());
      expect(screen.getAllByRole("radiogroup")).toHaveLength(2);

      await user.click(screen.getByRole("button", { name: "Save attendance" }));
      await waitFor(() => expect(supervisorApi.putAttendance).toHaveBeenCalledTimes(1));
      expect(supervisorApi.putAttendance).toHaveBeenCalledWith(
        1,
        [
          { trainee_id: 100, status: "present" },
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
      expect(payload).toHaveLength(8);
      expect(payload.find((r) => r.trainee_id === 101)).toEqual({ trainee_id: 101, status: "absent" });
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
  });
});
