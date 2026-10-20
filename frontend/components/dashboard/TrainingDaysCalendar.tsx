"use client";

import { useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { DayCard } from "@/components/DayCard";
import { EmptyState } from "@/components/StateViews";
import { SelectMenu } from "@/components/SelectMenu";
import { ChevronIcon } from "@/components/icons";
import { DIRECTION_BY_LOCALE } from "@/i18n/direction";
import type { AppLocale } from "@/i18n/routing";
import { monthLongNames, weekdayLongNames, weekdayShortNames } from "@/lib/dashboard/format";
import type { DashboardEntryDto } from "@/lib/api/types";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function monthKey(year: number, month: number): string {
  return `${year}-${pad2(month + 1)}`;
}

function dateKey(year: number, month: number, day: number): string {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function firstWeekday(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 1)).getUTCDay();
}

/** The viewer's real current month/year (local time, so "today" matches
 * the date they see on their own clock; session dates themselves stay UTC) -- shared by the initial-load fallback below
 * and the "Today" button, which jumps back to this exact month on demand
 * (point 5 of the Training Days toolbar refinement). */
function currentCursor(): { year: number; month: number } {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}

/** The month containing the dated entry closest to "today" (upcoming or
 * just past), so opening the calendar lands somewhere relevant instead
 * of always on the real current month -- falls back to the real current
 * month when nothing in the (already filtered) list has a date. */
function defaultCursor(entries: DashboardEntryDto[]): { year: number; month: number } {
  const dated = entries.filter((e): e is DashboardEntryDto & { date: string } => !!e.date);
  if (dated.length === 0) return currentCursor();
  const todayMs = Date.now();
  let closest = dated[0];
  let closestDiff = Math.abs(Date.parse(`${closest.date}T00:00:00Z`) - todayMs);
  for (const entry of dated) {
    const diff = Math.abs(Date.parse(`${entry.date}T00:00:00Z`) - todayMs);
    if (diff < closestDiff) {
      closest = entry;
      closestDiff = diff;
    }
  }
  const d = new Date(`${closest.date}T00:00:00Z`);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
}

/**
 * Month-grid calendar view of the same filtered/sorted Training Days
 * list the card view shows (same `entries`, same permissions -- this is
 * a different layout, not a different dataset). Days that carry at
 * least one entry are marked and clickable; selecting one lists its
 * entries below the grid using the same `DayCard` + role-specific action
 * every card view entry already uses, via `renderActions`.
 *
 * Deliberately simple per the brief: no drag/drop, no multi-month
 * range, no event stacking beyond a small count badge. The grid itself
 * needs no RTL-specific code -- CSS Grid places column 1 at the
 * inline-start, so it mirrors automatically under `dir="rtl"` -- only
 * the prev/next chevrons are explicitly flipped (see globals.css).
 */
export function TrainingDaysCalendar({
  entries,
  timeZone,
  dayNumbers,
  renderActions,
}: {
  entries: DashboardEntryDto[];
  timeZone?: string | null;
  /** See `TrainingDaysBoard`'s own `dayNumbers` prop -- keyed by
   * `training_day_id`, computed from the full unfiltered `days` array. */
  dayNumbers: Map<number, number>;
  renderActions: (entry: DashboardEntryDto) => ReactNode;
}) {
  const t = useTranslations("Lists");
  const d = useTranslations("Dashboard");
  const locale = useLocale();
  const monthSelectId = useId();
  const yearSelectId = useId();
  const monthLabelId = `${monthSelectId}-label`;
  const yearLabelId = `${yearSelectId}-label`;

  const byDate = useMemo(() => {
    const map = new Map<string, DashboardEntryDto[]>();
    for (const entry of entries) {
      if (!entry.date) continue;
      const list = map.get(entry.date);
      if (list) list.push(entry);
      else map.set(entry.date, [entry]);
    }
    return map;
  }, [entries]);
  const undated = useMemo(() => entries.filter((e) => !e.date), [entries]);

  const [cursor, setCursor] = useState(() => defaultCursor(entries));
  // The user's explicit pick, when it still falls in the visible month;
  // otherwise derived at render time (never via an effect + extra
  // setState) so a month change or filter change that leaves the old
  // pick out of range immediately falls back to that month's first
  // entry, with no stale cross-month selection ever shown.
  const [pickedDate, setPickedDate] = useState<string | null>(null);

  const monthLabel = new Intl.DateTimeFormat(locale === "ar" ? "ar-u-nu-latn" : "en", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(cursor.year, cursor.month, 1)));

  const keysInMonth = useMemo(
    () =>
      [...byDate.keys()].filter((key) => key.startsWith(monthKey(cursor.year, cursor.month))).sort(),
    [byDate, cursor],
  );

  const monthNames = useMemo(() => monthLongNames(locale), [locale]);

  // Direct month/year jump (point 5), alongside the prev/next steppers:
  // bounds always cover "today" +/- 5 years and every year that actually
  // has a training day, plus wherever prev/next have already navigated
  // to, so stepping past the computed bounds never produces a cursor the
  // year select itself can't represent.
  const yearOptions = useMemo(() => {
    const thisYear = currentCursor().year;
    const datedYears = [...byDate.keys()].map((key) => Number(key.slice(0, 4)));
    const candidates = [thisYear - 5, thisYear + 5, cursor.year, ...datedYears];
    const min = Math.min(...candidates);
    const max = Math.max(...candidates);
    return Array.from({ length: max - min + 1 }, (_, i) => min + i);
  }, [byDate, cursor.year]);

  const selectedDate = pickedDate && keysInMonth.includes(pickedDate) ? pickedDate : (keysInMonth[0] ?? null);
  const setSelectedDate = setPickedDate;

  const todayKey = (() => {
    const now = new Date();
    return dateKey(now.getFullYear(), now.getMonth(), now.getDate());
  })();

  const weekdays = weekdayShortNames(locale);
  const totalDays = daysInMonth(cursor.year, cursor.month);
  const leading = firstWeekday(cursor.year, cursor.month);
  const cells: Array<{ day: number; key: string } | null> = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: totalDays }, (_, i) => ({ day: i + 1, key: dateKey(cursor.year, cursor.month, i + 1) })),
  ];
  const weekdaysLong = useMemo(() => weekdayLongNames(locale), [locale]);
  const numWeeks = Math.ceil(cells.length / 7);
  const isRtl = DIRECTION_BY_LOCALE[locale as AppLocale] === "rtl";

  function cellHasEntries(cell: { day: number; key: string } | null): boolean {
    return !!cell && (byDate.get(cell.key)?.length ?? 0) > 0;
  }

  function cellAt(week: number, col: number) {
    if (week < 0 || week >= numWeeks || col < 0 || col > 6) return null;
    const index = week * 7 + col;
    return index >= 0 && index < cells.length ? cells[index] : null;
  }

  /** The focusable day button each keyboard-navigable cell renders
   * (`buttonRefs.current` below) so arrow-key handling can move real DOM
   * focus, not just update which cell is logically "active" -- roving
   * tabindex needs both (see `activeKey` and `handleDayKeyDown`). */
  const buttonRefs = useRef(new Map<string, HTMLButtonElement>());

  // Roving tabindex (WAI-ARIA grid pattern): exactly one day button is
  // ever in the Tab order at a time -- the most recently arrow-key'd or
  // focused one, defaulting to the month's first entry day -- so Tab
  // moves straight from the grid to whatever follows it on the page,
  // while arrow keys move within the grid itself. Reset on month change
  // so a stale key from a previous month never lingers as the "active"
  // one.
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const activeDayKey = activeKey && keysInMonth.includes(activeKey) ? activeKey : (keysInMonth[0] ?? null);

  /** Moves roving focus from `(week, col)` one step at a time toward
   * `(dRow, dCol)`, skipping blank and entry-less cells, and stops at the
   * grid's own edge -- this is a small month grid, not a generic
   * data-grid widget, so there is no wrap-to-next-row/month behaviour.
   * ArrowLeft/Right are pre-flipped by the caller for RTL, so this stays
   * direction-agnostic. */
  function handleDayKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, week: number, col: number) {
    let dRow = 0;
    let dCol = 0;
    switch (event.key) {
      case "ArrowUp":
        dRow = -1;
        break;
      case "ArrowDown":
        dRow = 1;
        break;
      case "ArrowLeft":
        dCol = isRtl ? 1 : -1;
        break;
      case "ArrowRight":
        dCol = isRtl ? -1 : 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    let w = week + dRow;
    let c = col + dCol;
    let found: { day: number; key: string } | null = null;
    while (w >= 0 && w < numWeeks && c >= 0 && c <= 6) {
      const cell = cellAt(w, c);
      if (cell && cellHasEntries(cell)) {
        found = cell;
        break;
      }
      w += dRow;
      c += dCol;
    }
    if (found) {
      setActiveKey(found.key);
      buttonRefs.current.get(found.key)?.focus();
    }
  }

  const goToMonth = (delta: number) => {
    setCursor((current) => {
      const next = current.month + delta;
      if (next < 0) return { year: current.year - 1, month: 11 };
      if (next > 11) return { year: current.year + 1, month: 0 };
      return { year: current.year, month: next };
    });
  };

  const goToday = () => setCursor(currentCursor());

  const selectedEntries = selectedDate ? (byDate.get(selectedDate) ?? []) : [];

  return (
    <div className="training-calendar">
      <div className="training-calendar__nav">
        <button
          type="button"
          className="button button--ghost button--icon training-calendar__nav-btn training-calendar__nav-btn--prev"
          onClick={() => goToMonth(-1)}
          aria-label={t("previousMonth")}
        >
          <ChevronIcon />
        </button>
        <div className="training-calendar__nav-center">
          <span id={monthLabelId} className="visually-hidden">
            {t("monthSelectLabel")}
          </span>
          <span className="training-calendar__month-select">
            <SelectMenu
              id={monthSelectId}
              labelledBy={monthLabelId}
              className="control-select__field"
              value={String(cursor.month)}
              onChange={(v) => setCursor((c) => ({ ...c, month: Number(v) }))}
              options={monthNames.map((name, i) => ({ value: String(i), label: name }))}
            />
          </span>
          <span id={yearLabelId} className="visually-hidden">
            {t("yearSelectLabel")}
          </span>
          <span className="training-calendar__year-select">
            <SelectMenu
              id={yearSelectId}
              labelledBy={yearLabelId}
              className="control-select__field"
              value={String(cursor.year)}
              onChange={(v) => setCursor((c) => ({ ...c, year: Number(v) }))}
              options={yearOptions.map((year) => ({ value: String(year), label: String(year) }))}
            />
          </span>
          {/* Announces month/year changes made via the prev/next steppers
           * or the Today button to screen-reader users; the selects above
           * already announce their own value on direct interaction. */}
          <p className="visually-hidden" aria-live="polite">
            {monthLabel}
          </p>
        </div>
        <button
          type="button"
          className="button button--ghost button--icon training-calendar__nav-btn training-calendar__nav-btn--next"
          onClick={() => goToMonth(1)}
          aria-label={t("nextMonth")}
        >
          <ChevronIcon />
        </button>
        <button type="button" className="button button--secondary training-calendar__today-btn" onClick={goToday}>
          {t("today")}
        </button>
      </div>
      <div className="training-calendar__weekdays" aria-hidden="true">
        {weekdays.map((label, i) => (
          <span key={i}>{label}</span>
        ))}
      </div>
      <div className="training-calendar__grid" role="grid" aria-label={monthLabel}>
        {Array.from({ length: numWeeks }, (_, week) => (
          <div key={week} role="row" className="training-calendar__week">
        {cells.slice(week * 7, week * 7 + 7).map((cell, j) => {
          const i = week * 7 + j;
          if (!cell) return <div key={`blank-${i}`} className="training-calendar__cell training-calendar__cell--blank" />;
          const dayEntries = byDate.get(cell.key) ?? [];
          const hasEntries = dayEntries.length > 0;
          const isToday = cell.key === todayKey;
          const isSelected = cell.key === selectedDate;
          return (
            <div key={cell.key} role="gridcell" className="training-calendar__cell">
              {hasEntries ? (
                <button
                  ref={(el) => {
                    if (el) buttonRefs.current.set(cell.key, el);
                    else buttonRefs.current.delete(cell.key);
                  }}
                  type="button"
                  className="training-calendar__day training-calendar__day--has-entries"
                  data-selected={isSelected ? "true" : undefined}
                  data-today={isToday ? "true" : undefined}
                  aria-pressed={isSelected}
                  aria-label={t("calendarDayWithCountAndWeekday", {
                    weekday: weekdaysLong[j],
                    day: cell.day,
                    count: dayEntries.length,
                  })}
                  tabIndex={cell.key === activeDayKey ? 0 : -1}
                  onFocus={() => setActiveKey(cell.key)}
                  onKeyDown={(event) => handleDayKeyDown(event, week, j)}
                  onClick={() => setSelectedDate(cell.key)}
                >
                  <span className="training-calendar__day-number">{cell.day}</span>
                  <span className="training-calendar__day-dot" aria-hidden="true" />
                </button>
              ) : (
                <span className="training-calendar__day" data-today={isToday ? "true" : undefined}>
                  <span className="training-calendar__day-number">{cell.day}</span>
                </span>
              )}
            </div>
          );
        })}
          </div>
        ))}
      </div>

      <div className="training-calendar__selection">
        {selectedEntries.length > 0 ? (
          <div className="card-list">
            {selectedEntries.map((entry) => (
              <DayCard
                key={entry.training_day_id}
                entry={entry}
                timeZone={timeZone}
                dayNumber={dayNumbers.get(entry.training_day_id) ?? 1}
              >
                {renderActions(entry)}
              </DayCard>
            ))}
          </div>
        ) : (
          <EmptyState variant="default" title={t("calendarNoSelectionTitle")} message={t("calendarNoSelectionMessage")} />
        )}
      </div>

      {undated.length > 0 ? (
        <div className="training-calendar__undated">
          <h3 className="page-section__title">
            {d("dateUnknown")} <span className="page-section__count">({undated.length})</span>
          </h3>
          <div className="card-list">
            {undated.map((entry) => (
              <DayCard
                key={entry.training_day_id}
                entry={entry}
                timeZone={timeZone}
                dayNumber={dayNumbers.get(entry.training_day_id) ?? 1}
              >
                {renderActions(entry)}
              </DayCard>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
