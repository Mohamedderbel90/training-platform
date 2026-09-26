import type { DashboardEntryDto, SurveyAvailabilityDto } from "@/lib/api/types";

export const notStarted: SurveyAvailabilityDto = { configured: true, response: null, can_submit: true, reason: null };
export const inProgress: SurveyAvailabilityDto = {
  configured: true,
  response: { response_id: 1, state: "in_progress", submitted_at: null, editable: true },
  can_submit: true,
  reason: null,
};
export const submitted: SurveyAvailabilityDto = {
  configured: true,
  response: { response_id: 2, state: "submitted", submitted_at: null, editable: false },
  can_submit: false,
  reason: null,
};
export const notConfigured: SurveyAvailabilityDto = { configured: false, response: null, can_submit: false, reason: "not_configured" };

export function makeEntry(over: Partial<DashboardEntryDto> & { training_day_id: number }): DashboardEntryDto {
  return {
    course_id: 1,
    program_id: 1,
    date: "2026-09-15",
    course_name: "Leadership",
    program_name: "Program One",
    start_datetime: null,
    end_datetime: null,
    state: "open",
    survey_open_at: null,
    survey_close_at: null,
    survey: notStarted,
    ...over,
  };
}

/** n days, newest first (as the API returns them), alternating two courses. */
export function makeDays(n: number, over: (i: number) => Partial<DashboardEntryDto> = () => ({})): DashboardEntryDto[] {
  return Array.from({ length: n }, (_, i) => {
    const day = String(28 - i).padStart(2, "0");
    return makeEntry({
      training_day_id: i + 1,
      date: `2026-09-${day}`,
      course_id: (i % 2) + 1,
      course_name: i % 2 === 0 ? `Alpha Course ${i + 1}` : `Beta Course ${i + 1}`,
      ...over(i),
    });
  });
}
