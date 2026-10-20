"use client";

/**
 * Search / filter / sort / (optional) pagination state for a list of
 * training days, kept in the URL query string so it survives refresh and
 * back/forward and can be shared. Everything is client-side over the
 * already-loaded entries: changing a control never triggers an API call.
 *
 * URL params: q, status, survey | report, course, program, from, to,
 * attendance, sort, page, size. Defaults are omitted from the URL.
 */
import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";
import type { DashboardEntryDto, OperationalRole } from "@/lib/api/types";
import {
  ACTION_AVAILABILITY_GROUPS,
  ATTENDANCE_FILTERS,
  DAY_STATUS_ORDER,
  DEFAULT_PAGE_SIZE,
  DEFAULT_SORT,
  PAGE_SIZE_OPTIONS,
  RESPONSE_STATUSES,
  SORT_KEYS,
  actionAvailabilityGroupOf,
  deriveFilterOptions,
  filterEntries,
  filterVisibilityFor,
  maskHiddenFilters,
  pageCountOf,
  shouldShowToolbar,
  sortEntries,
  type ActionAvailabilityGroup,
  type AttendanceFilter,
  type AvailabilityKind,
  type FilterOptions,
  type FilterVisibility,
  type ListFilters,
  type ResponseStatus,
  type SortKey,
} from "@/lib/dashboard/listControls";
import type { TrainingDayStatus } from "@/lib/api/types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function oneOf<T extends string>(value: string | null, allowed: readonly T[]): T | "" {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : "";
}

function positiveInt(value: string | null): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const n = Number(value);
  return n >= 1 ? n : null;
}

export interface ListControls {
  kind: AvailabilityKind;
  filters: ListFilters;
  sort: SortKey;
  page: number;
  pageSize: number;
  pageCount: number;
  options: FilterOptions;
  /** Which toolbar filters the viewer's role may see. Hidden ones are
   * also masked out of `filters`, so they never narrow `results`. */
  visibleFilters: FilterVisibility;
  /** Total entries before filtering. */
  total: number;
  /** Filtered + sorted, all pages. */
  results: DashboardEntryDto[];
  /** The current page when `paginate` is on, otherwise all `results`. */
  visible: DashboardEntryDto[];
  showToolbar: boolean;
  /** Filters (not sort) currently narrowing the list, search included. */
  activeCount: number;
  hasSearch: boolean;
  hasFilters: boolean;
  showPagination: boolean;
  /** Card list vs. calendar grid (section 2 of the Training Days
   * unification); persisted in the URL like every other control here so
   * returning from an action subpage restores it. */
  viewMode: ViewMode;
  setSearch: (q: string) => void;
  setFilter: <K extends Exclude<keyof ListFilters, "q">>(key: K, value: ListFilters[K]) => void;
  setSort: (sort: SortKey) => void;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setViewMode: (mode: ViewMode) => void;
  clear: () => void;
}

export type ViewMode = "card" | "calendar";
const VIEW_MODES: ViewMode[] = ["card", "calendar"];

export function useListControls(
  entries: DashboardEntryDto[],
  {
    kind = "survey",
    paginate = false,
    groupOf,
    role,
  }: {
    /** The viewer's operational role; decides which filters exist (see
     * FILTER_VISIBILITY in listControls.ts). Omit for no restriction. */
    role?: OperationalRole;
    kind?: AvailabilityKind;
    paginate?: boolean;
    /** Supervisor lists pass `supervisorActionAvailabilityGroupOf`
     * (two actions per day); everyone else uses the single-action
     * default (`actionAvailabilityGroupOf(entry, kind)`). */
    groupOf?: (entry: DashboardEntryDto) => ActionAvailabilityGroup;
  } = {},
): ListControls {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const paramsKey = searchParams?.toString() ?? "";
  const responseParam = kind === "report" ? "report" : "survey";

  // The params we last built, so several updates in one tick compose.
  const latest = useRef(new URLSearchParams(paramsKey));
  useEffect(() => {
    latest.current = new URLSearchParams(paramsKey);
  }, [paramsKey]);

  const commit = (mutate: (params: URLSearchParams) => void) => {
    const next = new URLSearchParams(latest.current.toString());
    mutate(next);
    latest.current = next;
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const options = useMemo(() => deriveFilterOptions(entries, locale), [entries, locale]);

  const params = new URLSearchParams(paramsKey);
  const urlQ = params.get("q") ?? "";

  // The search text is held locally so typing is never overwritten by the
  // (slightly delayed) URL echo; external URL changes are still followed.
  const [q, setQState] = useState(urlQ);
  const lastPushedQ = useRef(urlQ);
  useEffect(() => {
    if (urlQ !== lastPushedQ.current) {
      lastPushedQ.current = urlQ;
      startTransition(() => setQState(urlQ));
    }
  }, [urlQ]);

  const visibleFilters = useMemo(() => filterVisibilityFor(role), [role]);

  const filters = useMemo<ListFilters>(() => {
    const params = new URLSearchParams(paramsKey);
    const knownCourse = params.get("course");
    const knownProgram = params.get("program");
    const from = params.get("from");
    const to = params.get("to");
    return maskHiddenFilters({
      q,
      dayStatus: oneOf<TrainingDayStatus>(params.get("status"), DAY_STATUS_ORDER),
      responseStatus: oneOf<ResponseStatus>(params.get(responseParam), RESPONSE_STATUSES),
      course: options.courses.some((c) => c.value === knownCourse) ? (knownCourse as string) : "",
      program: options.programs.some((p) => p.value === knownProgram) ? (knownProgram as string) : "",
      dateFrom: from && DATE_RE.test(from) ? from : "",
      dateTo: to && DATE_RE.test(to) ? to : "",
      attendance: oneOf<AttendanceFilter>(params.get("attendance"), ATTENDANCE_FILTERS),
      availability: oneOf<ActionAvailabilityGroup>(params.get("avail"), ACTION_AVAILABILITY_GROUPS),
    }, visibleFilters);
  }, [paramsKey, q, options, responseParam, visibleFilters]);

  const sort = (oneOf<SortKey>(params.get("sort"), SORT_KEYS) || DEFAULT_SORT) as SortKey;
  const urlSize = positiveInt(params.get("size"));
  const pageSize = urlSize && PAGE_SIZE_OPTIONS.includes(urlSize) ? urlSize : DEFAULT_PAGE_SIZE;
  const viewMode = (oneOf<ViewMode>(params.get("view"), VIEW_MODES) || "card") as ViewMode;

  const resolveGroup = useMemo(
    () => groupOf ?? ((entry: DashboardEntryDto) => actionAvailabilityGroupOf(entry, kind)),
    [groupOf, kind],
  );

  // Calendar view replaces the date-range mechanism with its own
  // month-level navigation (point 8): the filter's value is left alone
  // (so Cards view shows it again unchanged) but is not applied here.
  const skipDateRange = viewMode === "calendar";

  // On short lists the toolbar is hidden, so URL-supplied filters must not
  // silently narrow what the user sees.
  const showToolbar = shouldShowToolbar(entries.length);
  const results = showToolbar
    ? sortEntries(
        filterEntries(entries, filters, { locale, kind, groupOf: resolveGroup, skipDateRange }),
        sort,
        locale,
      )
    : sortEntries(entries, DEFAULT_SORT, locale);

  const pageCount = pageCountOf(results.length, pageSize);
  const page = Math.min(positiveInt(params.get("page")) ?? 1, pageCount);
  const visible = paginate ? results.slice((page - 1) * pageSize, page * pageSize) : results;

  const hasSearch = showToolbar && filters.q.trim() !== "";
  // The date range is inert (and so excluded from the count/chips, point
  // 9) while it isn't actually narrowing anything, i.e. in calendar view.
  const activeCount = showToolbar
    ? Object.entries(filters).filter(([key, v]) => {
        if (key === "q" || v === "") return false;
        if (skipDateRange && (key === "dateFrom" || key === "dateTo")) return false;
        return true;
      }).length
    : 0;

  const setSearch = (value: string) => {
    lastPushedQ.current = value;
    setQState(value);
    commit((p) => {
      if (value.trim()) p.set("q", value);
      else p.delete("q");
      p.delete("page");
    });
  };

  const setFilter: ListControls["setFilter"] = (key, value) => {
    const name =
      key === "dayStatus"
        ? "status"
        : key === "responseStatus"
          ? responseParam
          : key === "dateFrom"
            ? "from"
            : key === "dateTo"
              ? "to"
              : key === "availability"
                ? "avail"
                : key;
    commit((p) => {
      if (value) p.set(name, value);
      else p.delete(name);
      p.delete("page");
    });
  };

  const setSort = (value: SortKey) => {
    commit((p) => {
      if (value === DEFAULT_SORT) p.delete("sort");
      else p.set("sort", value);
      p.delete("page");
    });
  };

  const setPage = (value: number) => {
    commit((p) => {
      if (value <= 1) p.delete("page");
      else p.set("page", String(value));
    });
  };

  const setPageSize = (value: number) => {
    commit((p) => {
      if (value === DEFAULT_PAGE_SIZE) p.delete("size");
      else p.set("size", String(value));
      p.delete("page");
    });
  };

  const setViewMode = (value: ViewMode) => {
    commit((p) => {
      if (value === "card") p.delete("view");
      else p.set("view", value);
    });
  };

  const clear = () => {
    lastPushedQ.current = "";
    setQState("");
    commit((p) => {
      for (const key of [
        "q",
        "status",
        responseParam,
        "course",
        "program",
        "from",
        "to",
        "attendance",
        "avail",
        "page",
      ]) {
        p.delete(key);
      }
    });
  };

  return {
    kind,
    filters,
    sort,
    page,
    pageSize,
    pageCount,
    options,
    visibleFilters,
    viewMode,
    total: entries.length,
    results,
    visible,
    showToolbar,
    activeCount: activeCount + (hasSearch ? 1 : 0),
    hasSearch,
    hasFilters: activeCount > 0,
    showPagination: viewMode === "card" && paginate && results.length > PAGE_SIZE_OPTIONS[0],
    setSearch,
    setFilter,
    setSort,
    setPage,
    setPageSize,
    setViewMode,
    clear,
  };
}
