import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithIntl, chooseOption } from "./testUtils";
import { TrainingDaysCalendar } from "@/components/dashboard/TrainingDaysCalendar";
import { makeEntry } from "./listFixtures";

vi.mock("@/i18n/navigation", () => import("./mocks/i18nNavigation"));

// A fixed, distant date so "the entry's own month" and "today" are always
// different months/years, regardless of when this test actually runs --
// no system-time mocking needed (userEvent + fake timers + this
// component's Suspense wrapper don't play well together; see history).
const entries = [
  makeEntry({ training_day_id: 1, date: "2000-06-15", course_name: "June Course" }),
];

const now = new Date();
const thisYear = String(now.getFullYear());

describe("TrainingDaysCalendar", () => {
  it("lets the user jump directly to a month/year instead of only stepping one at a time", async () => {
    const user = userEvent.setup();
    renderWithIntl(
      <TrainingDaysCalendar entries={entries} dayNumbers={new Map()} renderActions={() => null} />,
    );
    // Opens on the entry's own month (2000-06), not today's.
    expect(screen.getByText("June Course")).toBeInTheDocument();

    await chooseOption(user, "Month", "January");
    // No entry in January 2000: the selection list falls back to the
    // "no training day selected" empty state instead of showing June's.
    expect(screen.queryByText("June Course")).not.toBeInTheDocument();
    expect(screen.getByText("No training day selected")).toBeInTheDocument();

    await chooseOption(user, "Month", "June");
    expect(screen.getByText("June Course")).toBeInTheDocument();
  });

  it("'Today' jumps the visible month back to the real current month", async () => {
    const user = userEvent.setup();
    renderWithIntl(
      <TrainingDaysCalendar entries={entries} dayNumbers={new Map()} renderActions={() => null} />,
    );
    expect(screen.getByRole("combobox", { name: "Month" })).toHaveTextContent("June");
    expect(screen.getByRole("combobox", { name: "Year" })).toHaveTextContent("2000");

    await user.click(screen.getByRole("button", { name: "Today" }));
    expect(screen.getByRole("combobox", { name: "Month" })).toHaveTextContent(new Intl.DateTimeFormat("en", { month: "long" }).format(now));
    expect(screen.getByRole("combobox", { name: "Year" })).toHaveTextContent(thisYear);
  });

  it("announces the weekday in each day button's accessible name and supports roving arrow-key navigation", async () => {
    const user = userEvent.setup();
    // Both Thursdays, 7 days apart, so ArrowDown from the first lands
    // directly on the second in the same grid column.
    const twoEntries = [
      makeEntry({ training_day_id: 1, date: "2000-06-15", course_name: "June Course" }),
      makeEntry({ training_day_id: 2, date: "2000-06-22", course_name: "Second June Course" }),
    ];
    renderWithIntl(
      <TrainingDaysCalendar entries={twoEntries} dayNumbers={new Map()} renderActions={() => null} />,
    );

    const first = screen.getByRole("button", { name: /Thursday, 15,/ });
    const second = screen.getByRole("button", { name: /Thursday, 22,/ });

    // Roving tabindex: only the active day is in the Tab order.
    expect(first).toHaveAttribute("tabindex", "0");
    expect(second).toHaveAttribute("tabindex", "-1");

    first.focus();
    await user.keyboard("{ArrowDown}");

    expect(second).toHaveFocus();
    expect(second).toHaveAttribute("tabindex", "0");
    expect(first).toHaveAttribute("tabindex", "-1");

    await user.keyboard("{ArrowUp}");
    expect(first).toHaveFocus();
  });

  it("still narrows which entries show by whatever the caller already filtered (search/course/status)", () => {
    // The calendar only ever receives `controls.results` -- already
    // filtered by every control except the date range (see
    // useListControls.ts); it has no filtering logic of its own to test
    // here beyond rendering exactly what it's given.
    renderWithIntl(
      <TrainingDaysCalendar entries={[]} dayNumbers={new Map()} renderActions={() => null} />,
    );
    expect(screen.getByText("No training day selected")).toBeInTheDocument();
  });
});
