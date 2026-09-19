/**
 * Pure helpers that turn the dashboard's existing `days` array (already
 * scoped/authorized by the Operational API -- see lib/api/types.ts)
 * into the small view-model shapes the new Dashboard home renders:
 * a task list and a "done/total" ratio row. No network calls, no new
 * business rule -- every number here is a plain count over fields the
 * API already returns, never a fabricated example value.
 */
import type { DashboardEntryDto } from "@/lib/api/types";

export function daysForProgram(
  days: DashboardEntryDto[],
  programId: number | undefined,
): DashboardEntryDto[] {
  if (programId == null) return [];
  return days.filter((day) => day.program_id === programId);
}

export interface Ratio {
  done: number;
  total: number;
}

/** {done, total} of training days whose `state` is "closed". */
export function closedDaysRatio(days: DashboardEntryDto[]): Ratio {
  return { done: days.filter((d) => d.state === "closed").length, total: days.length };
}

/** {done, total} of distinct courses whose every training day is
 * "closed" -- a course counts as done only once none of its days are
 * still pending. */
export function completedCoursesRatio(days: DashboardEntryDto[]): Ratio {
  const byCourse = new Map<number, DashboardEntryDto[]>();
  for (const day of days) {
    const list = byCourse.get(day.course_id) ?? [];
    list.push(day);
    byCourse.set(day.course_id, list);
  }
  let done = 0;
  for (const courseDays of byCourse.values()) {
    if (courseDays.every((d) => d.state === "closed")) done += 1;
  }
  return { done, total: byCourse.size };
}

/** {done, total} of configured surveys/reports that reached "submitted",
 * reading whichever role-specific sub-DTO is present on each entry. */
export function submittedSurveyRatio(
  days: DashboardEntryDto[],
  pick: (day: DashboardEntryDto) => DashboardEntryDto["survey"],
): Ratio {
  const configured = days.filter((d) => pick(d)?.configured);
  const submitted = configured.filter((d) => pick(d)?.response?.state === "submitted");
  return { done: submitted.length, total: configured.length };
}

export type TaskBadge = "required" | "upcoming";

export interface DashboardTask {
  id: string;
  labelKey: string;
  courseName: string;
  badge: TaskBadge;
  href: string;
}

/** Real, actionable items only: every configured survey/report the user
 * can submit right now ("required"), plus at most ONE "upcoming" hint
 * for the next not-yet-open one -- a trainee with ten future planned
 * days should see one "coming up" pointer, not ten near-duplicate rows
 * for the same not-yet-open state. Nothing here is invented: a day with
 * no survey configured, or already submitted, contributes no task. */
export function buildTasks(
  days: DashboardEntryDto[],
  pick: (day: DashboardEntryDto) => DashboardEntryDto["survey"],
  hrefFor: (day: DashboardEntryDto) => string,
  labelKey: string,
  limit = 5,
): DashboardTask[] {
  const tasks: DashboardTask[] = [];
  const sorted = [...days].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  let hasUpcoming = false;

  for (const day of sorted) {
    const availability = pick(day);
    if (!availability?.configured) continue;
    if (availability.response?.state === "submitted") continue;
    if (availability.can_submit) {
      tasks.push({
        id: `required-${day.training_day_id}`,
        labelKey,
        courseName: day.course_name,
        badge: "required",
        href: hrefFor(day),
      });
    } else if (
      !hasUpcoming &&
      day.state === "planned" &&
      availability.reason !== "already_submitted"
    ) {
      tasks.push({
        id: `upcoming-${day.training_day_id}`,
        labelKey,
        courseName: day.course_name,
        badge: "upcoming",
        href: hrefFor(day),
      });
      hasUpcoming = true;
    }
    if (tasks.length >= limit) break;
  }
  return tasks;
}

/** Supervisor-only task source: an open day whose attendance has not
 * been fully recorded yet (training.attendance count < enrolled
 * count) -- reads the same `attendance` sub-DTO the days list and
 * DayCard already render, no new field. */
export function buildAttendanceTasks(
  days: DashboardEntryDto[],
  hrefFor: (day: DashboardEntryDto) => string,
  labelKey: string,
  limit = 5,
): DashboardTask[] {
  const tasks: DashboardTask[] = [];
  const sorted = [...days].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  for (const day of sorted) {
    if (day.state !== "open") continue;
    if (!day.attendance || day.attendance.complete) continue;
    tasks.push({
      id: `attendance-${day.training_day_id}`,
      labelKey,
      courseName: day.course_name,
      badge: "required",
      href: hrefFor(day),
    });
    if (tasks.length >= limit) break;
  }
  return tasks;
}
