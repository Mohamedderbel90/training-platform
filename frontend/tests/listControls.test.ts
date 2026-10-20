import { describe, it, expect } from "vitest";
import {
  TOOLBAR_MIN_ENTRIES,
  dayNumbersByProgram,
  deriveFilterOptions,
  filterEntries,
  normalizeSearchText,
  responseStatusOf,
  shouldShowToolbar,
  sortEntries,
} from "@/lib/dashboard/listControls";
import { inProgress, makeEntry, notConfigured, notStarted, submitted } from "./listFixtures";

const en = { locale: "en" };

describe("responseStatusOf", () => {
  it("maps availability to the four response statuses", () => {
    expect(responseStatusOf(undefined)).toBe("not_configured");
    expect(responseStatusOf(notConfigured)).toBe("not_configured");
    expect(responseStatusOf(notStarted)).toBe("not_started");
    expect(responseStatusOf(inProgress)).toBe("in_progress");
    expect(responseStatusOf(submitted)).toBe("submitted");
  });
});

describe("normalizeSearchText", () => {
  it("is case, accent and whitespace insensitive for Latin", () => {
    expect(normalizeSearchText("  Café   LEADERSHIP ")).toBe("cafe leadership");
  });
  it("unifies Arabic alef/ya/ta-marbuta variants and strips tashkeel and tatweel", () => {
    expect(normalizeSearchText("أحمد")).toBe(normalizeSearchText("احمد"));
    expect(normalizeSearchText("إدارة")).toBe(normalizeSearchText("اداره"));
    expect(normalizeSearchText("مَدْرَسَة")).toBe(normalizeSearchText("مدرسه"));
    expect(normalizeSearchText("على")).toBe(normalizeSearchText("علي"));
    expect(normalizeSearchText("قيــادة")).toBe(normalizeSearchText("قياده"));
  });
  it("maps Arabic-Indic digits to Latin", () => {
    expect(normalizeSearchText("١٥")).toBe("15");
  });
});

describe("filterEntries", () => {
  const a = makeEntry({ training_day_id: 1, course_id: 1, course_name: "Leadership Basics", program_id: 1, program_name: "Spring", date: "2026-09-15", state: "open", survey: submitted });
  const b = makeEntry({ training_day_id: 2, course_id: 2, course_name: "Communication", program_id: 2, program_name: "Autumn", date: "2026-10-01", state: "planned", survey: notStarted, attendance: { recorded_count: 2, total_enrolled: 2, complete: true } });
  const c = makeEntry({ training_day_id: 3, course_id: 2, course_name: "Communication", program_id: 2, program_name: "Autumn", date: null, state: "closed", survey: notConfigured, attendance: { recorded_count: 0, total_enrolled: 2, complete: false } });
  const all = [a, b, c];
  const ids = (list: typeof all) => list.map((e) => e.training_day_id);

  it("returns everything with no filters", () => {
    expect(ids(filterEntries(all, {}, en))).toEqual([1, 2, 3]);
  });
  it("searches course name, program name and the locale-formatted date", () => {
    expect(ids(filterEntries(all, { q: "LEADER" }, en))).toEqual([1]);
    expect(ids(filterEntries(all, { q: "autumn" }, en))).toEqual([2, 3]);
    expect(ids(filterEntries(all, { q: "sep 15" }, en))).toEqual([1]);
    expect(ids(filterEntries(all, { q: "2026-10-01" }, en))).toEqual([2]);
  });
  it("requires every search word to match", () => {
    expect(ids(filterEntries(all, { q: "communication autumn" }, en))).toEqual([2, 3]);
    expect(ids(filterEntries(all, { q: "communication spring" }, en))).toEqual([]);
  });
  it("matches Arabic course names forgivingly", () => {
    const ar = [makeEntry({ training_day_id: 9, course_name: "إدارة المدرسة" })];
    expect(filterEntries(ar, { q: "ادارة المدرسه" }, { locale: "ar" })).toHaveLength(1);
    expect(filterEntries(ar, { q: "  إدارَة " }, { locale: "ar" })).toHaveLength(1);
  });
  it("also matches the day's own topic, and tolerates a null/unset topic", () => {
    const withTopic = [
      makeEntry({ training_day_id: 10, course_name: "Course X", topic: "Strategic Leadership" }),
      makeEntry({ training_day_id: 11, course_name: "Course Y", topic: null }),
      makeEntry({ training_day_id: 12, course_name: "Course Z" }),
    ];
    expect(ids(filterEntries(withTopic, { q: "strategic" }, en))).toEqual([10]);
    // A null/unset topic must never throw or otherwise break the search.
    expect(ids(filterEntries(withTopic, { q: "course" }, en))).toEqual([10, 11, 12]);
  });
  it("filters by day status, survey status, course, program", () => {
    expect(ids(filterEntries(all, { dayStatus: "planned" }, en))).toEqual([2]);
    expect(ids(filterEntries(all, { responseStatus: "submitted" }, en))).toEqual([1]);
    expect(ids(filterEntries(all, { responseStatus: "not_configured" }, en))).toEqual([3]);
    expect(ids(filterEntries(all, { course: "2" }, en))).toEqual([2, 3]);
    expect(ids(filterEntries(all, { program: "1" }, en))).toEqual([1]);
  });
  it("uses the report availability for the report kind", () => {
    const t = makeEntry({ training_day_id: 5, survey: undefined, trainer_report: submitted });
    expect(filterEntries([t], { responseStatus: "submitted" }, { locale: "en", kind: "report" })).toHaveLength(1);
    expect(filterEntries([t], { responseStatus: "submitted" }, en)).toHaveLength(0);
  });
  it("filters by inclusive date range and drops undated days when a range is set", () => {
    expect(ids(filterEntries(all, { dateFrom: "2026-09-15" }, en))).toEqual([1, 2]);
    expect(ids(filterEntries(all, { dateTo: "2026-09-15" }, en))).toEqual([1]);
    expect(ids(filterEntries(all, { dateFrom: "2026-09-16", dateTo: "2026-10-01" }, en))).toEqual([2]);
  });
  it("skips the date range entirely when skipDateRange is set (calendar view, point 8)", () => {
    expect(ids(filterEntries(all, { dateFrom: "2026-09-16", dateTo: "2026-10-01" }, { ...en, skipDateRange: true }))).toEqual([
      1, 2, 3,
    ]);
    // Every other filter still applies normally alongside it.
    expect(
      ids(filterEntries(all, { dateFrom: "2026-09-16", course: "2" }, { ...en, skipDateRange: true })),
    ).toEqual([2, 3]);
  });
  it("filters by attendance completeness", () => {
    expect(ids(filterEntries(all, { attendance: "complete" }, en))).toEqual([2]);
    expect(ids(filterEntries(all, { attendance: "pending" }, en))).toEqual([1, 3]);
  });
  it("combines filters with AND", () => {
    expect(ids(filterEntries(all, { course: "2", dayStatus: "closed" }, en))).toEqual([3]);
  });
});

describe("sortEntries", () => {
  const list = [
    makeEntry({ training_day_id: 1, date: "2026-09-20", state: "closed", course_name: "b" }),
    makeEntry({ training_day_id: 2, date: null, state: "planned", course_name: "A" }),
    makeEntry({ training_day_id: 3, date: "2026-09-10", state: "open", course_name: "c" }),
    makeEntry({ training_day_id: 4, date: "2026-09-20", state: "closed", course_name: "a" }),
    makeEntry({ training_day_id: 5, date: "2026-09-01", state: "cancelled", course_name: "d" }),
    makeEntry({ training_day_id: 6, date: "2026-09-02", state: "postponed", course_name: "e" }),
  ];
  const ids = (l: typeof list) => l.map((e) => e.training_day_id);

  it("date newest first, undated last, stable on ties", () => {
    expect(ids(sortEntries(list, "dateDesc"))).toEqual([1, 4, 3, 6, 5, 2]);
  });
  it("date oldest first, undated last, stable on ties", () => {
    expect(ids(sortEntries(list, "dateAsc"))).toEqual([5, 6, 3, 1, 4, 2]);
  });
  it("day status planned, open, closed, postponed, cancelled", () => {
    expect(ids(sortEntries(list, "status"))).toEqual([2, 3, 1, 4, 6, 5]);
  });
  it("course name A-Z, case-insensitive, stable", () => {
    expect(ids(sortEntries(list, "course"))).toEqual([2, 4, 1, 3, 5, 6]);
  });
  it("does not mutate the input", () => {
    const copy = ids(list);
    sortEntries(list, "course");
    expect(ids(list)).toEqual(copy);
  });
  it("sorts Arabic names with locale-aware collation", () => {
    const ar = [
      makeEntry({ training_day_id: 1, course_name: "ياسمين" }),
      makeEntry({ training_day_id: 2, course_name: "أمل" }),
      makeEntry({ training_day_id: 3, course_name: "بناء" }),
    ];
    expect(sortEntries(ar, "course", "ar").map((e) => e.training_day_id)).toEqual([2, 3, 1]);
  });
});

describe("deriveFilterOptions", () => {
  it("lists distinct courses sorted by name; programs only when more than one", () => {
    const one = [
      makeEntry({ training_day_id: 1, course_id: 2, course_name: "Zeta" }),
      makeEntry({ training_day_id: 2, course_id: 1, course_name: "Alpha" }),
      makeEntry({ training_day_id: 3, course_id: 1, course_name: "Alpha" }),
    ];
    const opts = deriveFilterOptions(one);
    expect(opts.courses).toEqual([
      { value: "1", label: "Alpha" },
      { value: "2", label: "Zeta" },
    ]);
    expect(opts.programs).toEqual([]);

    const two = [...one, makeEntry({ training_day_id: 4, program_id: 2, program_name: "Other" })];
    expect(deriveFilterOptions(two).programs.map((p) => p.label)).toEqual(["Other", "Program One"]);
  });
});

describe("toolbar threshold", () => {
  it("shows the toolbar only from TOOLBAR_MIN_ENTRIES entries", () => {
    expect(TOOLBAR_MIN_ENTRIES).toBe(6);
    expect(shouldShowToolbar(5)).toBe(false);
    expect(shouldShowToolbar(6)).toBe(true);
  });
});

describe("dayNumbersByProgram", () => {
  it("numbers each program's own days 1..N by date ascending, independently per program -- spanning multiple courses within one program", () => {
    const days = [
      makeEntry({ training_day_id: 10, program_id: 1, course_id: 1, date: "2026-09-20" }),
      // Different course, same program, earliest date: must still land at
      // program-position 1, even though it is the ONLY day of course 2 (so
      // a course-scoped ordinal would also call it "1 of 1" -- the real
      // proof is the next case below).
      makeEntry({ training_day_id: 11, program_id: 1, course_id: 2, date: "2026-09-10" }),
      makeEntry({ training_day_id: 12, program_id: 1, course_id: 1, date: "2026-09-15" }),
      // A different program entirely numbers independently, starting back at 1.
      makeEntry({ training_day_id: 20, program_id: 2, course_id: 3, date: "2026-10-01" }),
      makeEntry({ training_day_id: 21, program_id: 2, course_id: 3, date: "2026-10-02" }),
    ];
    const numbers = dayNumbersByProgram(days);
    // Program 1, across both of its courses: 11 (course 2, 09-10) -> 1,
    // 12 (course 1, 09-15) -> 2, 10 (course 1, 09-20) -> 3.
    expect(numbers.get(11)).toBe(1);
    expect(numbers.get(12)).toBe(2);
    expect(numbers.get(10)).toBe(3);
    expect(numbers.get(20)).toBe(1);
    expect(numbers.get(21)).toBe(2);
  });

  it("gives a different ordinal than a course-scoped count would -- proving the number is program-wide, not per-course", () => {
    // Course A has two days; Course B (same program) has one day that
    // falls chronologically BETWEEN them. A course-scoped ordinal would
    // call the Course A days "1 of 2" and "2 of 2" and the Course B day
    // "1 of 1". The program-wide ordinal must instead read 1, 2, 3 across
    // all three in date order, regardless of which course each belongs to.
    const days = [
      makeEntry({ training_day_id: 1, program_id: 1, course_id: 100, date: "2026-09-01" }), // Course A, day 1
      makeEntry({ training_day_id: 2, program_id: 1, course_id: 200, date: "2026-09-15" }), // Course B, day 1 (would be "1 of 1" per-course)
      makeEntry({ training_day_id: 3, program_id: 1, course_id: 100, date: "2026-09-30" }), // Course A, day 2
    ];
    const numbers = dayNumbersByProgram(days);
    expect(numbers.get(1)).toBe(1);
    // Course B's only day is first (and only) within its own course, but
    // is program-position 2, not 1 -- this is exactly what a course-scoped
    // ordinal would get wrong.
    expect(numbers.get(2)).toBe(2);
    expect(numbers.get(3)).toBe(3);
  });

  it("breaks ties on the same date by training_day_id ascending, for determinism", () => {
    const days = [
      makeEntry({ training_day_id: 5, program_id: 1, date: "2026-09-10" }),
      makeEntry({ training_day_id: 3, program_id: 1, date: "2026-09-10" }),
    ];
    const numbers = dayNumbersByProgram(days);
    expect(numbers.get(3)).toBe(1);
    expect(numbers.get(5)).toBe(2);
  });

  it("sorts a day with no date after every dated day of its program", () => {
    const days = [
      makeEntry({ training_day_id: 1, program_id: 1, date: null }),
      makeEntry({ training_day_id: 2, program_id: 1, date: "2026-09-10" }),
    ];
    const numbers = dayNumbersByProgram(days);
    expect(numbers.get(2)).toBe(1);
    expect(numbers.get(1)).toBe(2);
  });
});
