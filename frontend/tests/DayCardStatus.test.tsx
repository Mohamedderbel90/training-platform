import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithIntl } from "./testUtils";
import { AttendanceStatusGroup, DayCard, SurveyStatusGroup } from "@/components/DayCard";
import type {
  AttendanceSummaryDto,
  DashboardEntryDto,
  SurveyAvailabilityDto,
  SurveyResponseStatus,
  TrainingDayStatus,
} from "@/lib/api/types";

vi.mock("@/i18n/navigation", () => import("./mocks/i18nNavigation"));

const entry = (state: TrainingDayStatus, overrides: Partial<DashboardEntryDto> = {}): DashboardEntryDto => ({
  training_day_id: 1,
  course_id: 1,
  program_id: 1,
  date: "2026-09-15",
  course_name: "Course A",
  program_name: "Program A",
  start_datetime: null,
  end_datetime: null,
  state,
  survey_open_at: null,
  survey_close_at: null,
  ...overrides,
});

const avail = (
  status: SurveyResponseStatus | null,
  can_submit: boolean,
  configured = true,
): SurveyAvailabilityDto => ({
  configured,
  response: status ? { response_id: 1, state: status, submitted_at: null, editable: false } : null,
  can_submit,
  reason: null,
});

function card(
  state: TrainingDayStatus,
  a: SurveyAvailabilityDto,
  opts: { kind?: "survey" | "report" | "evaluation"; locale?: "en" | "ar" } = {},
) {
  return renderWithIntl(
    <DayCard entry={entry(state)} dayNumber={1}>
      <SurveyStatusGroup availability={a} dayStatus={state} href="/x/1" kind={opts.kind} />
    </DayCard>,
    { locale: opts.locale ?? "en" },
  );
}

describe("DayCard status labelling", () => {
  it("no longer shows a visible 'Day Status'/'Survey Status' caption, but the day badge keeps its accessible name", () => {
    card("open", avail(null, true));
    expect(screen.queryByText("Day Status")).not.toBeInTheDocument();
    expect(screen.queryByText("Survey Status")).not.toBeInTheDocument();
    const badge = screen.getByText("Open");
    expect(badge).toHaveAttribute("aria-label", "Day Status: Open");
    expect(screen.getByRole("link", { name: "Fill out survey" })).toHaveAttribute("href", "/x/1");
  });

  it("does not repeat the program name on the card (shown once at the page level instead)", () => {
    card("open", avail(null, true));
    expect(screen.queryByText("Program A")).not.toBeInTheDocument();
  });

  it("labels the day badge in Arabic", () => {
    card("open", avail(null, true), { locale: "ar" });
    const badge = screen.getByText("مفتوح");
    expect(badge).toHaveAttribute("aria-label", "حالة اليوم: مفتوح");
    expect(screen.getByRole("link", { name: "تعبئة الاستبانة" })).toBeInTheDocument();
  });

  it("planned: no link, but a real focusable disabled-look button explains why via a tooltip", () => {
    card("planned", avail(null, false));
    expect(screen.getByText("Planned")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
    const button = screen.getByRole("button", { name: "Fill out survey" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button.tagName).toBe("BUTTON");
    const describedBy = button.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)).toHaveTextContent("Not available yet");
  });

  it("in progress and can submit: continue action", () => {
    card("open", avail("in_progress", true));
    expect(screen.getByRole("link", { name: "Continue survey" })).toBeInTheDocument();
  });

  it("submitted: view action, no disabled button", () => {
    card("open", avail("submitted", false));
    expect(screen.getByRole("link", { name: "View survey" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Fill out survey" })).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("closed and not submitted: disabled button with the missed-deadline hint, not the 'not available yet' hint", () => {
    card("closed", avail(null, false));
    expect(screen.getByText("Closed")).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Fill out survey" });
    const describedBy = button.getAttribute("aria-describedby")!;
    expect(document.getElementById(describedBy)).toHaveTextContent(
      "You did not complete this before the window closed.",
    );
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("closed and submitted: still shows the view action (bypasses the closed-day disabled state)", () => {
    card("closed", avail("submitted", false));
    expect(screen.getByText("Closed")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View survey" })).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it.each([
    ["postponed", "Postponed"],
    ["cancelled", "Cancelled"],
  ] as const)("%s: day status badge shown, disabled button carries the missed-deadline hint", (state, label) => {
    card(state, avail(null, false));
    expect(screen.getByText(label)).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Fill out survey" });
    const describedBy = button.getAttribute("aria-describedby")!;
    expect(document.getElementById(describedBy)).toHaveTextContent(
      "You did not complete this before the window closed.",
    );
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("open day, window already expired (close date in the past): missed-deadline hint, not the 'not yet open' one", () => {
    renderWithIntl(
      <DayCard entry={{ ...entry("open"), survey_close_at: "2020-01-01 00:00:00" }} dayNumber={1}>
        <SurveyStatusGroup
          availability={avail(null, false)}
          dayStatus="open"
          dateFields={{ survey_open_at: null, survey_close_at: "2020-01-01 00:00:00" }}
          href="/x/1"
        />
      </DayCard>,
    );
    const button = screen.getByRole("button", { name: "Fill out survey" });
    const describedBy = button.getAttribute("aria-describedby")!;
    expect(document.getElementById(describedBy)).toHaveTextContent(
      "You did not complete this before the window closed.",
    );
  });

  it("shows the submitted date under the View link when the API returns one", () => {
    card("open", {
      configured: true,
      response: { response_id: 1, state: "submitted", submitted_at: "2026-09-16 10:00:00", editable: false },
      can_submit: false,
      reason: null,
    });
    expect(screen.getByRole("link", { name: "View survey" })).toBeInTheDocument();
    expect(screen.getByText(/Submitted/)).toBeInTheDocument();
  });

  it("not configured: disabled button with the not-configured hint", () => {
    card("open", avail(null, false, false));
    const button = screen.getByRole("button", { name: "Fill out survey" });
    const describedBy = button.getAttribute("aria-describedby")!;
    expect(document.getElementById(describedBy)).toHaveTextContent("Not configured yet");
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("report kind for trainer", () => {
    card("open", avail(null, true), { kind: "report" });
    expect(screen.getByRole("link", { name: "Fill out impression report" })).toBeInTheDocument();
  });

  it("report kind, not yet available: disabled button reuses the report label", () => {
    card("planned", avail(null, false), { kind: "report" });
    const button = screen.getByRole("button", { name: "Fill out impression report" });
    expect(button).toHaveAttribute("aria-disabled", "true");
  });
});

describe("supervisor evaluation labelling (distinct from the generic survey labels)", () => {
  it("actionable: 'Fill out supervisory evaluation', not the generic 'Fill out survey'", () => {
    card("open", avail(null, true), { kind: "evaluation" });
    expect(screen.getByRole("link", { name: "Fill out supervisory evaluation" })).toBeInTheDocument();
    expect(screen.queryByText("Fill out survey")).not.toBeInTheDocument();
  });

  it("in progress: 'Continue supervisory evaluation'", () => {
    card("open", avail("in_progress", true), { kind: "evaluation" });
    expect(screen.getByRole("link", { name: "Continue supervisory evaluation" })).toBeInTheDocument();
  });

  it("submitted: 'View supervisory evaluation'", () => {
    card("open", avail("submitted", false), { kind: "evaluation" });
    expect(screen.getByRole("link", { name: "View supervisory evaluation" })).toBeInTheDocument();
  });

  it("disabled (not yet open): the disabled button still reads 'Fill out supervisory evaluation'", () => {
    card("planned", avail(null, false), { kind: "evaluation" });
    expect(screen.getByRole("button", { name: "Fill out supervisory evaluation" })).toHaveAttribute("aria-disabled", "true");
  });

  it("renders the Arabic label across all three states", () => {
    card("open", avail(null, true), { kind: "evaluation", locale: "ar" });
    expect(screen.getByRole("link", { name: "تعبئة التقييم الإشرافي" })).toBeInTheDocument();
  });
});

describe("day card title: computed 'Day N' ordinal + optional topic", () => {
  it("falls back to just the day number when topic is unset (no dangling separator)", () => {
    renderWithIntl(
      <DayCard entry={entry("open")} dayNumber={3}>
        <SurveyStatusGroup availability={avail(null, true)} dayStatus="open" href="/x/1" />
      </DayCard>,
    );
    // Zero-padded ("03"), matching the approved reference.
    expect(screen.getByText("Day 03")).toBeInTheDocument();
    expect(screen.queryByText(/—/)).not.toBeInTheDocument();
    // course_name now renders as secondary/meta text, not the title.
    expect(screen.getByText("Course A")).toBeInTheDocument();
  });

  it("shows 'Day N — topic' when the backend-supplied topic is set", () => {
    renderWithIntl(
      <DayCard entry={entry("open", { topic: "Strategic Leadership" })} dayNumber={8}>
        <SurveyStatusGroup availability={avail(null, true)} dayStatus="open" href="/x/1" />
      </DayCard>,
    );
    expect(screen.getByText("Day 08 — Strategic Leadership")).toBeInTheDocument();
    expect(screen.getByText("Course A")).toBeInTheDocument();
  });

  it("treats a blank/whitespace-only topic the same as unset", () => {
    renderWithIntl(
      <DayCard entry={entry("open", { topic: "   " })} dayNumber={5}>
        <SurveyStatusGroup availability={avail(null, true)} dayStatus="open" href="/x/1" />
      </DayCard>,
    );
    expect(screen.getByText("Day 05")).toBeInTheDocument();
  });

  it("renders the Arabic day-number label", () => {
    renderWithIntl(
      <DayCard entry={entry("open", { topic: "القيادة الاستراتيجية" })} dayNumber={8}>
        <SurveyStatusGroup availability={avail(null, true)} dayStatus="open" href="/x/1" />
      </DayCard>,
      { locale: "ar" },
    );
    expect(screen.getByText("اليوم 08 — القيادة الاستراتيجية")).toBeInTheDocument();
  });
});

describe("AttendanceStatusGroup: planned-day disable (project-owner-confirmed rule)", () => {
  const attendance: AttendanceSummaryDto = { recorded_count: 0, total_enrolled: 5, complete: false };

  it("planned day: attendance action is a disabled-look, focusable button with a tooltip hint", () => {
    renderWithIntl(<AttendanceStatusGroup attendance={attendance} dayStatus="planned" href="/x/1/attendance" />);
    const button = screen.getByRole("button", { name: "Record attendance" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(screen.queryByRole("link")).toBeNull();
    const describedBy = button.getAttribute("aria-describedby")!;
    expect(document.getElementById(describedBy)).toHaveTextContent("Not available yet");
  });

  it("open day: attendance action is a real, enabled link (regression check)", () => {
    renderWithIntl(<AttendanceStatusGroup attendance={attendance} dayStatus="open" href="/x/1/attendance" />);
    expect(screen.getByRole("link", { name: "Record attendance" })).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("closed day: still a real, enabled 'View attendance' link, not disabled (regression check)", () => {
    renderWithIntl(<AttendanceStatusGroup attendance={attendance} dayStatus="closed" href="/x/1/attendance" />);
    const link = screen.getByRole("link", { name: "View attendance" });
    expect(link).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
