import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithIntl, chooseOption } from "./testUtils";
import { DayListToolbar, TrainingDaysViewActions, ViewModeToggle } from "@/components/DayListToolbar";
import { useListControls } from "@/lib/dashboard/useListControls";
import { __installUrlSync, __setMockPathname } from "./mocks/i18nNavigation";
import { __getMockSearchParams, __setMockSearchParams } from "./mocks/nextNavigation";
import { makeDays } from "./listFixtures";

vi.mock("@/i18n/navigation", () => import("./mocks/i18nNavigation"));
vi.mock("next/navigation", () => import("./mocks/nextNavigation"));

const days = makeDays(10, (i) => ({ attendance: { recorded_count: 0, total_enrolled: 1, complete: i % 2 === 0 } }));

function Harness({ attendance = false }: { attendance?: boolean }) {
  const controls = useListControls(days);
  return <DayListToolbar controls={controls} showAttendance={attendance} />;
}

function ViewActionsHarness() {
  const controls = useListControls(days);
  return <TrainingDaysViewActions controls={controls} />;
}

beforeEach(() => {
  __setMockPathname("/supervisor/days");
  __setMockSearchParams({});
  __installUrlSync();
});

describe("DayListToolbar", () => {
  it("renders the labelled controls; Attendance only when requested", () => {
    const { unmount } = renderWithIntl(<Harness />);
    for (const label of ["Day Status", "Evaluation Status", "Survey Status", "Course", "From", "To"]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
    expect(screen.queryByLabelText("Attendance")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Program")).not.toBeInTheDocument();
    unmount();
    renderWithIntl(<Harness attendance />);
    expect(screen.getByLabelText("Attendance")).toBeInTheDocument();
  });

  it("cross-limits the date pickers (UX only) and shows removable chips with text", async () => {
    const user = userEvent.setup();
    renderWithIntl(<Harness attendance />);
    await user.click(screen.getByRole("button", { name: "From" }));
    await user.click((await screen.findAllByRole("gridcell"))[9]);
    expect(__getMockSearchParams().get("from")).toMatch(/^\d{4}-\d{2}-10$/);
    const from = __getMockSearchParams().get("from")!;

    // The To picker disables every day before From.
    await user.click(screen.getByRole("button", { name: "To" }));
    const cells = await screen.findAllByRole("gridcell");
    expect(cells[0]).toHaveAttribute("aria-disabled", "true");
    expect(cells[8]).toHaveAttribute("aria-disabled", "true");
    await user.click(cells[19]);
    expect(__getMockSearchParams().get("to")).toBe(`${from.slice(0, 8)}20`);

    await chooseOption(user, "Attendance", "Needs action");
    expect(await screen.findByRole("button", { name: "Remove filter: Attendance: Needs action" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Remove filter: From:/ })).toBeInTheDocument();
    expect(screen.getByText(/of 10 days/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remove filter: Attendance: Needs action" }));
    expect(__getMockSearchParams().get("attendance")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(__getMockSearchParams().toString()).toBe("");
    expect(screen.queryByRole("button", { name: "Clear filters" })).not.toBeInTheDocument();
  });

  it("keeps Course in the always-visible primary row and the other filters in the collapsed panel", () => {
    const { container } = renderWithIntl(<Harness attendance />);
    const panel = container.querySelector(".filter-bar__panel")!;
    // Course moved out of the panel into the compact row (point 1); it is
    // always visible, not gated behind "Filters".
    expect(panel).not.toContainElement(screen.getByLabelText("Course"));
    for (const label of ["Day Status", "Evaluation Status", "Survey Status", "Attendance", "From", "To"]) {
      expect(panel).toContainElement(screen.getByLabelText(label));
    }
    expect(screen.getByRole("button", { name: /Filters/ })).toHaveAttribute("aria-expanded", "false");
  });

  it("groups Day/Evaluation/Survey/Attendance status in one row above a labelled date-range section", () => {
    const { container } = renderWithIntl(<Harness attendance />);
    const statusRow = container.querySelector(".filter-bar__status-row")!;
    expect(statusRow).toBeInTheDocument();
    for (const label of ["Day Status", "Evaluation Status", "Survey Status", "Attendance"]) {
      expect(statusRow).toContainElement(screen.getByLabelText(label));
    }
    const dateSection = container.querySelector(".filter-bar__date-section")!;
    expect(dateSection).toHaveTextContent("Date range");
    expect(dateSection).toContainElement(screen.getByLabelText("From"));
    expect(dateSection).toContainElement(screen.getByLabelText("To"));
  });

  it("shows a working 'Choose date' empty state for From/To that clears once a date is picked", async () => {
    const user = userEvent.setup();
    renderWithIntl(<Harness />);
    expect(screen.getAllByText("Choose date")).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "From" }));
    await user.click((await screen.findAllByRole("gridcell"))[9]);
    expect(screen.getAllByText("Choose date")).toHaveLength(1);
  });

  it("opens the panel initially when a filter is already active via the URL", () => {
    __setMockSearchParams({ status: "open", q: "x" });
    renderWithIntl(<Harness />);
    const toggle = screen.getByRole("button", { name: /Filters/ });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });

  it("hides the From/To date range entirely in calendar view but keeps the other filters", () => {
    const { unmount } = renderWithIntl(<Harness />);
    expect(screen.getByLabelText("From")).toBeInTheDocument();
    unmount();

    __setMockSearchParams({ view: "calendar" });
    renderWithIntl(<Harness />);
    expect(screen.queryByLabelText("From")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("To")).not.toBeInTheDocument();
    expect(screen.queryByText("Date range")).not.toBeInTheDocument();
    // Search, Course and the status filters keep narrowing the calendar too.
    expect(screen.getByLabelText("Day Status")).toBeInTheDocument();
    expect(screen.getByLabelText("Course")).toBeInTheDocument();
  });

  it("shows 'Sort by' next to the results count in card view (the default) and hides it in calendar view", () => {
    const { unmount } = renderWithIntl(<Harness />);
    expect(screen.getByLabelText("Sort by")).toBeInTheDocument();
    unmount();

    __setMockSearchParams({ view: "calendar" });
    renderWithIntl(<Harness />);
    expect(screen.queryByLabelText("Sort by")).not.toBeInTheDocument();
  });

  it("keeps a previously-set date range out of the active-filter count/chips while in calendar view", async () => {
    const user = userEvent.setup();
    const { unmount } = renderWithIntl(<Harness />);
    await user.click(screen.getByRole("button", { name: "From" }));
    await user.click((await screen.findAllByRole("gridcell"))[9]);
    expect(screen.getByRole("button", { name: /Remove filter: From:/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Filters/ })).toHaveTextContent("1");
    unmount();

    __setMockSearchParams({ from: "2026-09-10", view: "calendar" });
    renderWithIntl(<Harness />);
    // The value is still set (see useListControls.test.tsx) but it no
    // longer reads as an active filter while it's inert.
    expect(screen.queryByRole("button", { name: /Remove filter: From:/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Filters/ })).not.toHaveTextContent("1");
  });
});

describe("TrainingDaysViewActions", () => {
  // Sort-by used to render here, beside the view toggle; it now lives in
  // DayListToolbar's own results row instead (see the "Sort by" test
  // under "DayListToolbar" above), matching the approved reference where
  // the toggle sits alone, above the title.
  it("renders only the Cards/Calendar view toggle", () => {
    const { unmount } = renderWithIntl(<ViewActionsHarness />);
    expect(screen.getByRole("button", { name: "Cards" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Calendar" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Sort by")).not.toBeInTheDocument();
    unmount();

    __setMockSearchParams({ view: "calendar" });
    renderWithIntl(<ViewActionsHarness />);
    expect(screen.getByRole("button", { name: "Calendar" })).toBeInTheDocument();
  });
});

describe("ViewModeToggle", () => {
  it("renders two real, labelled buttons and marks the active one with aria-pressed (not colour alone)", () => {
    const onChange = vi.fn();
    renderWithIntl(<ViewModeToggle value="card" onChange={onChange} />);
    const cardBtn = screen.getByRole("button", { name: "Cards" });
    const calendarBtn = screen.getByRole("button", { name: "Calendar" });
    expect(cardBtn).toHaveAttribute("aria-pressed", "true");
    expect(calendarBtn).toHaveAttribute("aria-pressed", "false");
  });

  it("calls onChange with the clicked mode", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithIntl(<ViewModeToggle value="card" onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Calendar" }));
    expect(onChange).toHaveBeenCalledWith("calendar");
  });

  it("reflects calendar as active when value is calendar", () => {
    renderWithIntl(<ViewModeToggle value="calendar" onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Calendar" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Cards" })).toHaveAttribute("aria-pressed", "false");
  });
});
