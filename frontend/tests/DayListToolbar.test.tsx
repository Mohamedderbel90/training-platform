import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithIntl } from "./testUtils";
import { DayListToolbar } from "@/components/DayListToolbar";
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

beforeEach(() => {
  __setMockPathname("/supervisor/days");
  __setMockSearchParams({});
  __installUrlSync();
});

describe("DayListToolbar", () => {
  it("renders the labelled controls; Attendance only when requested", () => {
    const { unmount } = renderWithIntl(<Harness />);
    for (const label of ["Day Status", "Survey Status", "Course", "From", "To", "Sort by"]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
    expect(screen.queryByLabelText("Attendance")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Program")).not.toBeInTheDocument();
    unmount();
    renderWithIntl(<Harness attendance />);
    expect(screen.getByLabelText("Attendance")).toBeInTheDocument();
  });

  it("cross-limits the date inputs (UX only) and shows removable chips with text", async () => {
    const user = userEvent.setup();
    renderWithIntl(<Harness attendance />);
    await user.type(screen.getByLabelText("From"), "2026-09-10");
    expect(screen.getByLabelText("To")).toHaveAttribute("min", "2026-09-10");
    await user.type(screen.getByLabelText("To"), "2026-09-20");
    expect(screen.getByLabelText("From")).toHaveAttribute("max", "2026-09-20");

    await user.selectOptions(screen.getByLabelText("Attendance"), "pending");
    expect(await screen.findByRole("button", { name: "Remove filter: Attendance: Needs action" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Remove filter: From:/ })).toBeInTheDocument();
    expect(screen.getByText(/of 10 training days/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remove filter: Attendance: Needs action" }));
    expect(__getMockSearchParams().get("attendance")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(__getMockSearchParams().toString()).toBe("");
    expect(screen.queryByRole("button", { name: "Clear filters" })).not.toBeInTheDocument();
  });
});
