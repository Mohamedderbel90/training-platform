import { describe, it, expect } from "vitest";
import {
  TOOLBAR_MIN_ENTRIES,
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
