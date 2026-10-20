"use client";

import { type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { FilterBar, type ActiveFilter } from "@/components/FilterBar";
import { Pagination } from "@/components/Pagination";
import { DatePicker } from "@/components/DatePicker";
import { SearchInput } from "@/components/SearchInput";
import { SortControl } from "@/components/SortControl";
import { EmptyState } from "@/components/StateViews";
import { CalendarIcon, GridIcon } from "@/components/icons";
import { formatDate } from "@/lib/dashboard/format";
import {
  ACTION_AVAILABILITY_GROUPS,
  ATTENDANCE_FILTERS,
  DAY_STATUS_ORDER,
  PAGE_SIZE_OPTIONS,
  RESPONSE_STATUSES,
  SORT_KEYS,
  type SortKey,
} from "@/lib/dashboard/listControls";
import type { ListControls, ViewMode } from "@/lib/dashboard/useListControls";

/** Card list vs. calendar grid toggle (section 2 of the Training Days
 * unification), shared by all three roles. Two real, adjacent buttons
 * (icon + label) rather than a radio-dot segmented control: the active
 * view is distinguished by a filled button + `aria-pressed="true"`, the
 * inactive one stays a plain outline button, so the state reads clearly
 * without relying on the dot/pill convention used elsewhere for
 * single-choice filters. Rendered by each role's day-list page in the
 * page header's top-corner `actions` slot, not inside the toolbar
 * itself -- see `TrainingDaysViewActions` below and `PageHeader`. */
export function ViewModeToggle({ value, onChange }: { value: ViewMode; onChange: (mode: ViewMode) => void }) {
  const t = useTranslations("Lists");
  const options: { mode: ViewMode; label: string; icon: ReactNode }[] = [
    { mode: "card", label: t("viewCard"), icon: <GridIcon aria-hidden="true" /> },
    { mode: "calendar", label: t("viewCalendar"), icon: <CalendarIcon aria-hidden="true" /> },
  ];
  return (
    <div className="view-toggle" role="group" aria-label={t("viewToggleLabel")}>
      {options.map((option) => {
        const active = value === option.mode;
        return (
          <button
            key={option.mode}
            type="button"
            className={`button${active ? "" : " button--secondary"} view-toggle__button`}
            aria-pressed={active}
            onClick={() => onChange(option.mode)}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Thin wrapper around `ViewModeToggle`, rendered in the page header's
 * top-corner `leadingActions` slot, above the title -- matching the
 * approved reference. Sort-by used to render here too, beside the
 * toggle; it now sits in the toolbar's own results row instead (see
 * `sortControl` below and `.filter-bar__results-row` in globals.css),
 * matching the reference's "Showing X of Y" + "Sort: ..." line. */
export function TrainingDaysViewActions({ controls }: { controls: ListControls }) {
  return (
    <div className="training-days-view-actions">
      <ViewModeToggle value={controls.viewMode} onChange={controls.setViewMode} />
    </div>
  );
}

/** The card-view-only Sort-by control for the toolbar's results row (see
 * `DayListToolbar` below) -- `undefined` in calendar view, same as
 * before the control moved here from the page header. */
function sortControl(controls: ListControls, t: (key: string) => string) {
  if (controls.viewMode !== "card") return undefined;
  return (
    <SortControl
      compact
      value={controls.sort}
      onChange={(v) => controls.setSort(v as SortKey)}
      options={SORT_KEYS.map((k) => ({ value: k, label: t(`sort.${k}`) }))}
    />
  );
}

/** Shared search / filter / sort toolbar for the training-day lists.
 * Purely presentational: all state lives in `useListControls`. Render it
 * only when `controls.showToolbar`. */
export function DayListToolbar({
  controls,
  showAttendance = false,
}: {
  controls: ListControls;
  /** Supervisor lists only: filter by attendance completeness. */
  showAttendance?: boolean;
}) {
  const t = useTranslations("Lists");
  const d = useTranslations("Dashboard");
  const ui = useTranslations("Ui");
  const locale = useLocale();
  const { filters, options, kind, visibleFilters: show } = controls;
  const all = t("all");
  const responseLabel = d(kind === "report" ? "reportStatusLabel" : "surveyStatusLabel");
  // The calendar's own month navigation governs what's visible instead of
  // the date range once in calendar view (points 4/8); the toolbar hides
  // the From/To fields entirely there, rather than showing a range that
  // would look active but do nothing.
  const isCalendar = controls.viewMode === "calendar";

  const responseName = (v: string) => d(v === "not_configured" ? "surveyState.notConfigured" : `surveyState.${v}`);
  const courseName = options.courses.find((c) => c.value === filters.course)?.label ?? "";
  const programName = options.programs.find((p) => p.value === filters.program)?.label ?? "";

  const chips: ActiveFilter[] = [];
  if (controls.hasSearch) {
    chips.push({
      id: "q",
      label: t("chipSearch", { value: filters.q.trim() }),
      onRemove: () => controls.setSearch(""),
    });
  }
  const chip = (id: string, name: string, value: string, clear: () => void) =>
    chips.push({ id, label: t("chipFilter", { name, value }), onRemove: clear });
  if (filters.dayStatus) {
    chip("status", d("dayStatusLabel"), d(`dayState.${filters.dayStatus}`), () => controls.setFilter("dayStatus", ""));
  }
  if (filters.responseStatus) {
    chip("response", responseLabel, responseName(filters.responseStatus), () => controls.setFilter("responseStatus", ""));
  }
  if (filters.course) chip("course", t("course"), courseName, () => controls.setFilter("course", ""));
  if (filters.program) chip("program", t("program"), programName, () => controls.setFilter("program", ""));
  // Excluded from the panel/chip count while in calendar view (point 9):
  // the value stays set so Cards view shows it again, but it isn't
  // narrowing anything right now, so it must not read as an active filter.
  if (!isCalendar && filters.dateFrom) {
    chip("from", t("from"), formatDate(filters.dateFrom, locale), () => controls.setFilter("dateFrom", ""));
  }
  if (!isCalendar && filters.dateTo) {
    chip("to", t("to"), formatDate(filters.dateTo, locale), () => controls.setFilter("dateTo", ""));
  }
  if (filters.attendance) {
    chip("attendance", t("attendance"), t(`attendanceState.${filters.attendance}`), () =>
      controls.setFilter("attendance", ""),
    );
  }
  if (filters.availability) {
    chip("availability", d("actionAvailabilityLabel"), d(`actionAvailability.${filters.availability}`), () =>
      controls.setFilter("availability", ""),
    );
  }

  const filtering = controls.activeCount > 0;
  const resultText = filtering
    ? ui("resultsOf", { shown: controls.results.length, total: controls.total })
    : ui("daysCount", { count: controls.total });

  return (
    <FilterBar
      search={
        <SearchInput
          value={filters.q}
          onChange={controls.setSearch}
          label={t("searchLabel")}
          placeholder={t("searchPlaceholder")}
          debounceMs={250}
        />
      }
      activeFilters={chips}
      onClear={controls.clear}
      resultText={resultText}
      sort={sortControl(controls, t)}
      panelActiveCount={chips.filter((c) => c.id !== "q").length}
      primary={
        // Always visible (not just in card view, point 1): Course keeps
        // narrowing the calendar grid too (point 5), unlike the date range.
        show.course ? (
        <SortControl
          compact
          label={t("course")}
          value={filters.course}
          onChange={(v) => controls.setFilter("course", v)}
          options={[{ value: "", label: all }, ...options.courses]}
        />
        ) : undefined
      }
    >
      {/* Day Status / Evaluation Status / Survey|Report Status (/
       * Attendance): equal-width, equal-height, grouped in one row (point
       * 2). Day Status and Evaluation Status look similar but are NOT the
       * same concept -- Day Status is the record's own raw lifecycle
       * state, Evaluation Status is a derived "can this role's action be
       * submitted right now" (see the long comment above
       * `ActionAvailabilityGroup` in listControls.ts) -- so each keeps its
       * own distinct label, and Evaluation Status gets an inline hint
       * clarifying the difference (point 3). */}
      <div className="filter-bar__status-row">
        {show.dayStatus ? (
        <SortControl
          label={d("dayStatusLabel")}
          value={filters.dayStatus}
          onChange={(v) => controls.setFilter("dayStatus", v as typeof filters.dayStatus)}
          options={[
            { value: "", label: all },
            ...DAY_STATUS_ORDER.map((s) => ({ value: s, label: d(`dayState.${s}`) })),
          ]}
        />
        ) : null}
        {show.availability ? (
        <SortControl
          label={d("actionAvailabilityLabel")}
          hint={d("actionAvailabilityHint")}
          value={filters.availability}
          onChange={(v) => controls.setFilter("availability", v as typeof filters.availability)}
          options={[
            { value: "", label: all },
            ...ACTION_AVAILABILITY_GROUPS.map((g) => ({ value: g, label: d(`actionAvailability.${g}`) })),
          ]}
        />
        ) : null}
        {show.responseStatus ? (
        <SortControl
          label={responseLabel}
          value={filters.responseStatus}
          onChange={(v) => controls.setFilter("responseStatus", v as typeof filters.responseStatus)}
          options={[{ value: "", label: all }, ...RESPONSE_STATUSES.map((s) => ({ value: s, label: responseName(s) }))]}
        />
        ) : null}
        {showAttendance && show.attendance ? (
          <SortControl
            label={t("attendance")}
            value={filters.attendance}
            onChange={(v) => controls.setFilter("attendance", v as typeof filters.attendance)}
            options={[
              { value: "", label: all },
              ...ATTENDANCE_FILTERS.map((s) => ({ value: s, label: t(`attendanceState.${s}`) })),
            ]}
          />
        ) : null}
      </div>
      {show.program && options.programs.length > 0 ? (
        <SortControl
          label={t("program")}
          value={filters.program}
          onChange={(v) => controls.setFilter("program", v)}
          options={[{ value: "", label: all }, ...options.programs]}
        />
      ) : null}
      {!isCalendar && show.dateRange ? (
        <div className="filter-bar__date-section">
          <p className="filter-bar__date-section-label">{t("dateRangeLabel")}</p>
          <div className="filter-bar__date-fields">
            <DatePicker
              label={t("from")}
              value={filters.dateFrom}
              max={filters.dateTo}
              placeholder={t("chooseDate")}
              onChange={(v) => controls.setFilter("dateFrom", v)}
            />
            <DatePicker
              label={t("to")}
              value={filters.dateTo}
              min={filters.dateFrom}
              placeholder={t("chooseDate")}
              onChange={(v) => controls.setFilter("dateTo", v)}
            />
          </div>
        </div>
      ) : null}
    </FilterBar>
  );
}

/** "Nothing matches" state: the `search` variant when a search text is
 * active, otherwise `filtered`; both offer the Clear action. */
export function DayListNoResults({ controls }: { controls: ListControls }) {
  const ui = useTranslations("Ui");
  const clear = (
    <button type="button" className="button button--secondary" onClick={controls.clear}>
      {ui("clearFilters")}
    </button>
  );
  return controls.hasSearch ? (
    <EmptyState variant="search" query={controls.filters.q.trim()} action={clear} />
  ) : (
    <EmptyState variant="filtered" action={clear} />
  );
}

/** Client-side pagination for a flat list; rendered only when the
 * filtered results exceed the smallest page size. */
export function DayListPagination({
  controls,
  onPageChange,
}: {
  controls: ListControls;
  /** Called after the page changes (e.g. to scroll the list back into view). */
  onPageChange?: () => void;
}) {
  if (!controls.showPagination) return null;
  return (
    <Pagination
      page={controls.page}
      pageCount={controls.pageCount}
      onPageChange={(page) => {
        controls.setPage(page);
        onPageChange?.();
      }}
      pageSize={controls.pageSize}
      pageSizeOptions={PAGE_SIZE_OPTIONS}
      onPageSizeChange={controls.setPageSize}
    />
  );
}
