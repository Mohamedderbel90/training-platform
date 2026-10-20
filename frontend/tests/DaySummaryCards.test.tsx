import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithIntl } from "./testUtils";
import { DaySummaryCards } from "@/components/dashboard/DaySummaryCards";

describe("DaySummaryCards", () => {
  it("labels the section as program-wide stats, distinct from a filtered result count", () => {
    renderWithIntl(<DaySummaryCards total={10} completed={4} upcoming={6} />);
    expect(screen.getByText("Program Statistics")).toBeInTheDocument();
  });

  it("labels the 'completed' tile by day-lifecycle completion, not survey submission (point 13)", () => {
    renderWithIntl(<DaySummaryCards total={10} completed={4} upcoming={6} />);
    // "Completed days" implied personal accomplishment/submission, which
    // this count never measured (it's purely `state === "closed"`); the
    // relabelled copy describes what is actually counted. The tile no
    // longer shows an explanatory support line underneath (label + number
    // only, for a more compact tile), so only the label itself is checked.
    expect(screen.getByText("Ended days")).toBeInTheDocument();
    expect(screen.queryByText("Completed days")).not.toBeInTheDocument();
  });

  it("no longer shows an explanatory support line under any tile (label + number only)", () => {
    renderWithIntl(<DaySummaryCards total={10} completed={4} upcoming={6} />);
    expect(screen.queryByText("All training days in this program")).not.toBeInTheDocument();
    expect(screen.queryByText("Training days that have already taken place")).not.toBeInTheDocument();
    expect(screen.queryByText("Training days remaining in this program")).not.toBeInTheDocument();
  });

  it("renders the Arabic program-wide heading and relabelled tile", () => {
    renderWithIntl(<DaySummaryCards total={10} completed={4} upcoming={6} />, { locale: "ar" });
    expect(screen.getByText("إحصائيات البرنامج")).toBeInTheDocument();
    expect(screen.getByText("الأيام المنتهية")).toBeInTheDocument();
  });
});
