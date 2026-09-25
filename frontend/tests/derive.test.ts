import { describe, it, expect } from "vitest";
import {
  buildAttendanceTasks,
  buildTasks,
  closedDaysRatio,
  completedCoursesRatio,
  daysForProgram,
  submittedSurveyRatio,
} from "@/lib/dashboard/derive";
import type { DashboardEntryDto } from "@/lib/api/types";

function day(overrides: Partial<DashboardEntryDto> = {}): DashboardEntryDto {
  return {
    training_day_id: 1,
    course_id: 1,
    program_id: 1,
    date: "2026-09-10",
    course_name: "Course",
    program_name: "Program",
    start_datetime: null,
    end_datetime: null,
    state: "planned",
    survey_open_at: null,
    survey_close_at: null,
    ...overrides,
  };
}

describe("daysForProgram", () => {
  it("returns an empty list when no program id is given", () => {
    expect(daysForProgram([day()], undefined)).toEqual([]);
  });

  it("filters days down to the given program", () => {
    const a = day({ training_day_id: 1, program_id: 1 });
    const b = day({ training_day_id: 2, program_id: 2 });
    expect(daysForProgram([a, b], 1)).toEqual([a]);
  });
});

describe("closedDaysRatio", () => {
  it("counts only closed days against the full total", () => {
    const days = [
      day({ state: "closed" }),
      day({ state: "open" }),
      day({ state: "closed" }),
    ];
    expect(closedDaysRatio(days)).toEqual({ done: 2, total: 3 });
  });

  it("returns 0/0 for an empty list", () => {
    expect(closedDaysRatio([])).toEqual({ done: 0, total: 0 });
  });
});

describe("completedCoursesRatio", () => {
  it("counts a course as done only once every one of its days is closed", () => {
    const days = [
      day({ training_day_id: 1, course_id: 1, state: "closed" }),
      day({ training_day_id: 2, course_id: 1, state: "closed" }),
      day({ training_day_id: 3, course_id: 2, state: "closed" }),
      day({ training_day_id: 4, course_id: 2, state: "open" }),
    ];
    expect(completedCoursesRatio(days)).toEqual({ done: 1, total: 2 });
  });

  it("returns 0/0 for an empty list", () => {
    expect(completedCoursesRatio([])).toEqual({ done: 0, total: 0 });
  });
});

describe("submittedSurveyRatio", () => {
  const pick = (d: DashboardEntryDto) => d.survey;

  it("counts configured surveys as the total and submitted ones as done", () => {
    const days = [
      day({ survey: { configured: true, response: { response_id: 1, state: "submitted", submitted_at: null, editable: false }, can_submit: false, reason: "already_submitted" } }),
      day({ survey: { configured: true, response: null, can_submit: true, reason: null } }),
      day({ survey: { configured: false, response: null, can_submit: false, reason: null } }),
    ];
    expect(submittedSurveyRatio(days, pick)).toEqual({ done: 1, total: 2 });
  });

  it("treats a day with no survey sub-DTO at all as not configured", () => {
    expect(submittedSurveyRatio([day()], pick)).toEqual({ done: 0, total: 0 });
  });
});

describe("buildTasks", () => {
  const pick = (d: DashboardEntryDto) => d.survey;
  const hrefFor = (d: DashboardEntryDto) => `/x/${d.training_day_id}`;

  it("emits a required task for every submittable, not-yet-submitted survey, sorted by date", () => {
    const later = day({
      training_day_id: 2,
      date: "2026-09-20",
      course_name: "Later Course",
      survey: { configured: true, response: null, can_submit: true, reason: null },
    });
    const earlier = day({
      training_day_id: 1,
      date: "2026-09-05",
      course_name: "Earlier Course",
      survey: { configured: true, response: null, can_submit: true, reason: null },
    });
    const tasks = buildTasks([later, earlier], pick, hrefFor, "taskSurveyRequired");
    expect(tasks).toEqual([
      { id: "required-1", labelKey: "taskSurveyRequired", courseName: "Earlier Course", badge: "required", href: "/x/1" },
      { id: "required-2", labelKey: "taskSurveyRequired", courseName: "Later Course", badge: "required", href: "/x/2" },
    ]);
  });

  it("skips a day with no survey configured", () => {
    const d = day({ survey: { configured: false, response: null, can_submit: false, reason: null } });
    expect(buildTasks([d], pick, hrefFor, "taskSurveyRequired")).toEqual([]);
  });

  it("skips a day whose survey is already submitted", () => {
    const d = day({
      survey: {
        configured: true,
        response: { response_id: 1, state: "submitted", submitted_at: "2026-09-10 10:00:00", editable: false },
        can_submit: false,
        reason: "already_submitted",
      },
    });
    expect(buildTasks([d], pick, hrefFor, "taskSurveyRequired")).toEqual([]);
  });

  it("caps 'upcoming' hints at one even when several not-yet-open planned days exist", () => {
    const days = [
      day({
        training_day_id: 1,
        date: "2026-09-05",
        course_name: "First Upcoming",
        state: "planned",
        survey: { configured: true, response: null, can_submit: false, reason: null },
      }),
      day({
        training_day_id: 2,
        date: "2026-09-06",
        course_name: "Second Upcoming",
        state: "planned",
        survey: { configured: true, response: null, can_submit: false, reason: null },
      }),
    ];
    const tasks = buildTasks(days, pick, hrefFor, "taskSurveyRequired");
    expect(tasks).toEqual([
      { id: "upcoming-1", labelKey: "taskSurveyRequired", courseName: "First Upcoming", badge: "upcoming", href: "/x/1" },
    ]);
  });

  it("does not treat a non-planned, not-yet-submittable day as upcoming", () => {
    const d = day({
      state: "closed",
      survey: { configured: true, response: null, can_submit: false, reason: null },
    });
    expect(buildTasks([d], pick, hrefFor, "taskSurveyRequired")).toEqual([]);
  });

  it("does not treat an already-submitted-reason day as upcoming", () => {
    const d = day({
      state: "planned",
      survey: { configured: true, response: null, can_submit: false, reason: "already_submitted" },
    });
    expect(buildTasks([d], pick, hrefFor, "taskSurveyRequired")).toEqual([]);
  });

  it("stops at the given limit", () => {
    const days = Array.from({ length: 7 }, (_, i) =>
      day({
        training_day_id: i + 1,
        date: `2026-09-${String(i + 1).padStart(2, "0")}`,
        survey: { configured: true, response: null, can_submit: true, reason: null },
      }),
    );
    expect(buildTasks(days, pick, hrefFor, "taskSurveyRequired")).toHaveLength(5);
    expect(buildTasks(days, pick, hrefFor, "taskSurveyRequired", 2)).toHaveLength(2);
  });
});

describe("buildAttendanceTasks", () => {
  const hrefFor = (d: DashboardEntryDto) => `/x/${d.training_day_id}/attendance`;

  it("emits a task only for an open day with incomplete attendance, sorted by date", () => {
    const later = day({
      training_day_id: 2,
      date: "2026-09-20",
      course_name: "Later Course",
      state: "open",
      attendance: { recorded_count: 1, total_enrolled: 3, complete: false },
    });
    const earlier = day({
      training_day_id: 1,
      date: "2026-09-05",
      course_name: "Earlier Course",
      state: "open",
      attendance: { recorded_count: 0, total_enrolled: 3, complete: false },
    });
    const tasks = buildAttendanceTasks([later, earlier], hrefFor, "taskAttendanceRequired");
    expect(tasks).toEqual([
      { id: "attendance-1", labelKey: "taskAttendanceRequired", courseName: "Earlier Course", badge: "required", href: "/x/1/attendance" },
      { id: "attendance-2", labelKey: "taskAttendanceRequired", courseName: "Later Course", badge: "required", href: "/x/2/attendance" },
    ]);
  });

  it("skips a non-open day even with incomplete attendance", () => {
    const d = day({ state: "planned", attendance: { recorded_count: 0, total_enrolled: 3, complete: false } });
    expect(buildAttendanceTasks([d], hrefFor, "taskAttendanceRequired")).toEqual([]);
  });

  it("skips a day with no attendance sub-DTO at all", () => {
    const d = day({ state: "open" });
    expect(buildAttendanceTasks([d], hrefFor, "taskAttendanceRequired")).toEqual([]);
  });

  it("skips a day whose attendance is already complete", () => {
    const d = day({ state: "open", attendance: { recorded_count: 3, total_enrolled: 3, complete: true } });
    expect(buildAttendanceTasks([d], hrefFor, "taskAttendanceRequired")).toEqual([]);
  });

  it("stops at the given limit", () => {
    const days = Array.from({ length: 7 }, (_, i) =>
      day({
        training_day_id: i + 1,
        date: `2026-09-${String(i + 1).padStart(2, "0")}`,
        state: "open",
        attendance: { recorded_count: 0, total_enrolled: 3, complete: false },
      }),
    );
    expect(buildAttendanceTasks(days, hrefFor, "taskAttendanceRequired")).toHaveLength(5);
    expect(buildAttendanceTasks(days, hrefFor, "taskAttendanceRequired", 2)).toHaveLength(2);
  });
});
