import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import { useListControls } from "@/lib/dashboard/useListControls";
import { __installUrlSync, __setMockPathname, replace } from "./mocks/i18nNavigation";
import { __setMockSearchParams } from "./mocks/nextNavigation";
import { makeDays, submitted } from "./listFixtures";

vi.mock("@/i18n/navigation", () => import("./mocks/i18nNavigation"));
vi.mock("next/navigation", () => import("./mocks/nextNavigation"));

function wrapper({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {children}
    </NextIntlClientProvider>
  );
}

const days = makeDays(30, (i) => (i % 3 === 0 ? { survey: submitted } : {}));

function lastUrl() {
  return replace.mock.calls.at(-1)?.[0] as string;
}

beforeEach(() => {
  __setMockPathname("/supervisor/days");
  __setMockSearchParams({});
  __installUrlSync();
});

describe("useListControls", () => {
  it("has defaults, no active filters and everything visible", () => {
    const { result } = renderHook(() => useListControls(days, { paginate: true }), { wrapper });
    expect(result.current.showToolbar).toBe(true);
    expect(result.current.activeCount).toBe(0);
    expect(result.current.results).toHaveLength(30);
    expect(result.current.visible).toHaveLength(12);
    expect(result.current.page).toBe(1);
    expect(result.current.pageCount).toBe(3);
    expect(result.current.showPagination).toBe(true);
  });

  it("writes filters to the URL with a locale-safe replace (no scroll) and reads them back", () => {
    const { result } = renderHook(() => useListControls(days), { wrapper });
    act(() => result.current.setFilter("responseStatus", "submitted"));
    expect(replace).toHaveBeenCalledWith("/supervisor/days?survey=submitted", { scroll: false });
    expect(result.current.filters.responseStatus).toBe("submitted");
    expect(result.current.results).toHaveLength(10);
    expect(result.current.activeCount).toBe(1);
  });

  it("composes several updates in one tick and omits defaults", () => {
    const { result } = renderHook(() => useListControls(days), { wrapper });
    act(() => {
      result.current.setFilter("dayStatus", "open");
      result.current.setSort("course");
    });
    expect(lastUrl()).toBe("/supervisor/days?status=open&sort=course");
    act(() => result.current.setSort("dateDesc"));
    expect(lastUrl()).toBe("/supervisor/days?status=open");
  });

  it("uses the report param for the report kind", () => {
    const { result } = renderHook(() => useListControls(days, { kind: "report" }), { wrapper });
    act(() => result.current.setFilter("responseStatus", "not_started"));
    expect(lastUrl()).toBe("/supervisor/days?report=not_started");
  });

  it("initialises from the URL and ignores invalid values and unknown courses", () => {
    __setMockSearchParams({ status: "open", sort: "course", course: "1", from: "nope", attendance: "x", page: "abc" });
    const { result } = renderHook(() => useListControls(days), { wrapper });
    expect(result.current.filters.dayStatus).toBe("open");
    expect(result.current.filters.course).toBe("1");
    expect(result.current.filters.dateFrom).toBe("");
    expect(result.current.filters.attendance).toBe("");
    expect(result.current.sort).toBe("course");
    expect(result.current.page).toBe(1);

    __setMockSearchParams({ course: "999" });
    const again = renderHook(() => useListControls(days), { wrapper });
    expect(again.result.current.filters.course).toBe("");
  });

  it("resets page to 1 when search, filter or sort changes but not on page change", () => {
    __setMockSearchParams({ page: "2" });
    const { result } = renderHook(() => useListControls(days, { paginate: true }), { wrapper });
    expect(result.current.page).toBe(2);
    expect(result.current.visible[0].training_day_id).toBe(13);

    act(() => result.current.setFilter("dayStatus", "open"));
    expect(lastUrl()).toBe("/supervisor/days?status=open");
    act(() => result.current.setPage(3));
    expect(lastUrl()).toBe("/supervisor/days?status=open&page=3");
    act(() => result.current.setSearch("alpha"));
    expect(lastUrl()).toBe("/supervisor/days?status=open&q=alpha");
    act(() => result.current.setPage(2));
    act(() => result.current.setSort("dateAsc"));
    expect(lastUrl()).not.toContain("page=");
  });

  it("stores page size and resets to page 1; clamps an out-of-range page", () => {
    __setMockSearchParams({ page: "9" });
    const { result } = renderHook(() => useListControls(days, { paginate: true }), { wrapper });
    expect(result.current.page).toBe(3);
    act(() => result.current.setPageSize(24));
    expect(lastUrl()).toBe("/supervisor/days?size=24");
    expect(result.current.pageCount).toBe(2);
    expect(result.current.visible).toHaveLength(24);
    act(() => result.current.setPageSize(12));
    expect(lastUrl()).toBe("/supervisor/days");
  });

  it("searches case-insensitively over course names", () => {
    const { result } = renderHook(() => useListControls(days), { wrapper });
    act(() => result.current.setSearch("BETA"));
    expect(result.current.hasSearch).toBe(true);
    expect(result.current.results).toHaveLength(15);
  });

  it("clear removes every filter param but keeps sort and unrelated params", () => {
    __setMockSearchParams({ q: "beta", status: "open", sort: "course", page: "2", other: "1" });
    const { result } = renderHook(() => useListControls(days), { wrapper });
    act(() => result.current.clear());
    expect(lastUrl()).toBe("/supervisor/days?sort=course&other=1");
    expect(result.current.filters.q).toBe("");
  });

  it("follows external URL changes (back/forward)", () => {
    const { result } = renderHook(() => useListControls(days), { wrapper });
    act(() => __setMockSearchParams({ q: "alpha", status: "open" }));
    expect(result.current.filters.q).toBe("alpha");
    expect(result.current.filters.dayStatus).toBe("open");
  });

  it("leaves a set date range in place but inert while in calendar view (point 8/9)", () => {
    __setMockSearchParams({ from: "2026-09-10", to: "2026-09-20" });
    const { result } = renderHook(() => useListControls(days), { wrapper });
    const narrowedCount = result.current.results.length;
    expect(result.current.activeCount).toBe(2); // dateFrom + dateTo
    expect(narrowedCount).toBeLessThan(days.length);

    act(() => result.current.setViewMode("calendar"));
    // The value survives the view switch...
    expect(result.current.filters.dateFrom).toBe("2026-09-10");
    expect(result.current.filters.dateTo).toBe("2026-09-20");
    // ...but no longer narrows the results or counts as an active filter.
    expect(result.current.results).toHaveLength(days.length);
    expect(result.current.activeCount).toBe(0);

    // Switching back to Cards immediately re-applies it, unchanged.
    act(() => result.current.setViewMode("card"));
    expect(result.current.results).toHaveLength(narrowedCount);
    expect(result.current.activeCount).toBe(2);
  });

  it("hides the toolbar and ignores URL filters on short lists", () => {
    __setMockSearchParams({ status: "closed", q: "zzz" });
    const { result } = renderHook(() => useListControls(days.slice(0, 5)), { wrapper });
    expect(result.current.showToolbar).toBe(false);
    expect(result.current.results).toHaveLength(5);
    expect(result.current.activeCount).toBe(0);
  });

  describe("role-based filter visibility", () => {
    it("hides Evaluation Status and Attendance from a trainee and ignores their URL params in both views", () => {
      __setMockSearchParams({ avail: "closed", attendance: "complete" });
      const open = renderHook(() => useListControls(days, { role: "trainee" }), { wrapper });
      expect(open.result.current.visibleFilters.availability).toBe(false);
      expect(open.result.current.visibleFilters.attendance).toBe(false);
      expect(open.result.current.filters.availability).toBe("");
      expect(open.result.current.filters.attendance).toBe("");
      expect(open.result.current.results).toHaveLength(days.length);
      expect(open.result.current.activeCount).toBe(0);

      act(() => open.result.current.setViewMode("calendar"));
      expect(open.result.current.results).toHaveLength(days.length);
      expect(open.result.current.activeCount).toBe(0);
    });

    it("still applies the same params for a supervisor", () => {
      __setMockSearchParams({ attendance: "complete" });
      const { result } = renderHook(() => useListControls(days, { role: "supervisor" }), { wrapper });
      expect(result.current.visibleFilters.attendance).toBe(true);
      expect(result.current.filters.attendance).toBe("complete");
      expect(result.current.results.length).toBeLessThan(days.length);
    });

    it("gives trainers Report status but not Evaluation Status or Attendance", () => {
      const { result } = renderHook(() => useListControls(days, { role: "trainer", kind: "report" }), { wrapper });
      expect(result.current.visibleFilters).toMatchObject({
        responseStatus: true,
        availability: false,
        attendance: false,
      });
    });
  });
});
