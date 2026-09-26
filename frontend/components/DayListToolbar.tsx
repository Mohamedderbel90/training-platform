"use client";

import { useId } from "react";
import { useLocale, useTranslations } from "next-intl";
import { FilterBar, type ActiveFilter } from "@/components/FilterBar";
import { Pagination } from "@/components/Pagination";
import { SearchInput } from "@/components/SearchInput";
import { SortControl } from "@/components/SortControl";
import { EmptyState } from "@/components/StateViews";
import { formatDate } from "@/lib/dashboard/format";
import {
  ATTENDANCE_FILTERS,
  DAY_STATUS_ORDER,
  PAGE_SIZE_OPTIONS,
  RESPONSE_STATUSES,
  SORT_KEYS,
  type SortKey,
} from "@/lib/dashboard/listControls";
import type { ListControls } from "@/lib/dashboard/useListControls";

function DateField({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
}) {
  const id = useId();
  return (
    <div className="control-select control-select--date">
      <label htmlFor={id} className="control-select__label">
        {label}
      </label>
      <span className="control-select__wrap">
        <input
          id={id}
          type="date"
          className="control-select__field"
          value={value}
          min={min || undefined}
          max={max || undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      </span>
    </div>
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
  const { filters, options, kind } = controls;
  const all = t("all");
  const responseLabel = d(kind === "report" ? "reportStatusLabel" : "surveyStatusLabel");

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
  if (filters.dateFrom) {
    chip("from", t("from"), formatDate(filters.dateFrom, locale), () => controls.setFilter("dateFrom", ""));
  }
  if (filters.dateTo) {
    chip("to", t("to"), formatDate(filters.dateTo, locale), () => controls.setFilter("dateTo", ""));
  }
  if (filters.attendance) {
    chip("attendance", t("attendance"), t(`attendanceState.${filters.attendance}`), () =>
      controls.setFilter("attendance", ""),
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
    >
      <SortControl
        label={d("dayStatusLabel")}
        value={filters.dayStatus}
        onChange={(v) => controls.setFilter("dayStatus", v as typeof filters.dayStatus)}
        options={[
          { value: "", label: all },
          ...DAY_STATUS_ORDER.map((s) => ({ value: s, label: d(`dayState.${s}`) })),
        ]}
      />
      <SortControl
        label={responseLabel}
        value={filters.responseStatus}
        onChange={(v) => controls.setFilter("responseStatus", v as typeof filters.responseStatus)}
        options={[{ value: "", label: all }, ...RESPONSE_STATUSES.map((s) => ({ value: s, label: responseName(s) }))]}
      />
      {showAttendance ? (
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
      <SortControl
        label={t("course")}
        value={filters.course}
        onChange={(v) => controls.setFilter("course", v)}
        options={[{ value: "", label: all }, ...options.courses]}
      />
      {options.programs.length > 0 ? (
        <SortControl
          label={t("program")}
          value={filters.program}
          onChange={(v) => controls.setFilter("program", v)}
          options={[{ value: "", label: all }, ...options.programs]}
        />
      ) : null}
      <DateField
        label={t("from")}
        value={filters.dateFrom}
        max={filters.dateTo}
        onChange={(v) => controls.setFilter("dateFrom", v)}
      />
      <DateField
        label={t("to")}
        value={filters.dateTo}
        min={filters.dateFrom}
        onChange={(v) => controls.setFilter("dateTo", v)}
      />
      <SortControl
        value={controls.sort}
        onChange={(v) => controls.setSort(v as SortKey)}
        options={SORT_KEYS.map((k) => ({ value: k, label: t(`sort.${k}`) }))}
      />
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
export function DayListPagination({ controls }: { controls: ListControls }) {
  if (!controls.showPagination) return null;
  return (
    <Pagination
      page={controls.page}
      pageCount={controls.pageCount}
      onPageChange={controls.setPage}
      pageSize={controls.pageSize}
      pageSizeOptions={PAGE_SIZE_OPTIONS}
      onPageSizeChange={controls.setPageSize}
    />
  );
}
