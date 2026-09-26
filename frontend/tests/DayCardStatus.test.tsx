import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithIntl } from "./testUtils";
import { DayCard, SurveyStatusGroup } from "@/components/DayCard";
import type {
  DashboardEntryDto,
  SurveyAvailabilityDto,
  SurveyResponseStatus,
  TrainingDayStatus,
} from "@/lib/api/types";

vi.mock("@/i18n/navigation", () => import("./mocks/i18nNavigation"));

const entry = (state: TrainingDayStatus): DashboardEntryDto => ({
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
  opts: { kind?: "survey" | "report"; locale?: "en" | "ar" } = {},
) {
  return renderWithIntl(
    <DayCard entry={entry(state)}>
      <SurveyStatusGroup availability={a} dayStatus={state} href="/x/1" kind={opts.kind} />
    </DayCard>,
    { locale: opts.locale ?? "en" },
  );
}

describe("DayCard status labelling", () => {
  it("labels day and survey status in English", () => {
    card("open", avail(null, true));
    expect(screen.getByText("Day Status")).toBeInTheDocument();
    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(screen.getByText("Survey Status")).toBeInTheDocument();
    expect(screen.getByText("Not started")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open survey" })).toHaveAttribute("href", "/x/1");
  });

  it("labels day and survey status in Arabic", () => {
    card("open", avail(null, true), { locale: "ar" });
    expect(screen.getByText("حالة اليوم")).toBeInTheDocument();
    expect(screen.getByText("مفتوح")).toBeInTheDocument();
    expect(screen.getByText("حالة الاستبيان")).toBeInTheDocument();
    expect(screen.getByText("لم يبدأ")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "فتح الاستبيان" })).toBeInTheDocument();
  });

  it("planned: no action, hint instead", () => {
    card("planned", avail(null, false));
    expect(screen.getByText("Planned")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Not available yet")).toBeInTheDocument();
  });

  it("in progress and can submit: continue action", () => {
    card("open", avail("in_progress", true));
    expect(screen.getByText("In progress")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Continue survey" })).toBeInTheDocument();
  });

  it("submitted: completed state with view action", () => {
    card("open", avail("submitted", false));
    expect(screen.getByText(/Submitted/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View survey" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open survey" })).toBeNull();
  });

  it("closed and not submitted: day closed hint, no action", () => {
    card("closed", avail(null, false));
    expect(screen.getByText("Closed")).toBeInTheDocument();
    expect(screen.getByText("The day is closed")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("closed and submitted: still shows submitted", () => {
    card("closed", avail("submitted", false));
    expect(screen.getByText("Closed")).toBeInTheDocument();
    expect(screen.getByText(/Submitted/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View survey" })).toBeInTheDocument();
  });

  it.each([
    ["postponed", "Postponed", "The day is postponed"],
    ["cancelled", "Cancelled", "The day is cancelled"],
  ] as const)("%s: day status prioritised, no primary action", (state, label, hint) => {
    card(state, avail(null, false));
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByText(hint)).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("not configured: no action", () => {
    card("open", avail(null, false, false));
    expect(screen.getByText("Not configured")).toBeInTheDocument();
    expect(screen.getByText("Not configured yet")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("report kind for trainer", () => {
    card("open", avail(null, true), { kind: "report" });
    expect(screen.getByText("Report Status")).toBeInTheDocument();
    expect(screen.queryByText("Survey Status")).toBeNull();
    expect(screen.getByRole("link", { name: "Open report" })).toBeInTheDocument();
  });

  it("report kind in Arabic", () => {
    card("open", avail(null, true), { kind: "report", locale: "ar" });
    expect(screen.getByText("حالة التقرير")).toBeInTheDocument();
  });
});
