"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { useLocale, useTranslations } from "next-intl";
import { CalendarSmallIcon, ChevronIcon } from "@/components/icons";
import { formatDate, monthLongNames, weekdayShortNames } from "@/lib/dashboard/format";

const pad2 = (n: number) => String(n).padStart(2, "0");
const key = (y: number, m: number, d: number) => `${y}-${pad2(m + 1)}-${pad2(d)}`;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
const parts = (k: string) => {
  const [y, m, d] = k.split("-").map(Number);
  return { y, m: m - 1, d };
};
function addDays(k: string, n: number): string {
  const { y, m, d } = parts(k);
  const date = new Date(Date.UTC(y, m, d + n));
  return key(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}
/** Same day-of-month in another month, clamped (31 Jan + 1 month -> 28/29 Feb). */
function addMonths(k: string, n: number): string {
  const { y, m, d } = parts(k);
  const target = new Date(Date.UTC(y, m + n, 1));
  const ty = target.getUTCFullYear();
  const tm = target.getUTCMonth();
  return key(ty, tm, Math.min(d, daysIn(ty, tm)));
}
function todayKey(): string {
  const now = new Date();
  return key(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * Themed date picker replacing the native `<input type="date">`: a button
 * showing the chosen date in the UI locale (or a translated placeholder)
 * that opens a month-grid popover. Values stay plain "YYYY-MM-DD" strings,
 * exactly what the native input produced, so callers (URL params, filter
 * logic) are unchanged. `min`/`max` disable days outside the range.
 *
 * Keyboard (inside the grid): arrows move by day/week (mirrored in RTL),
 * PageUp/PageDown by month (Shift = year), Home/End to the week's ends,
 * Enter/Space picks, Escape closes and returns focus to the button.
 *
 * The popover is a portal with fixed positioning: the filter panel clips
 * its overflow while animating its height. The weekday grid mirrors under
 * `dir="rtl"` by itself (CSS grid), the same way the Training Days calendar
 * does; only the arrow-key directions and prev/next chevrons are flipped.
 */
export function DatePicker({
  label,
  value,
  onChange,
  min,
  max,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  placeholder: string;
}) {
  const t = useTranslations("Lists");
  const locale = useLocale();
  const rtl = locale === "ar";
  const id = useId();
  const labelId = `${id}-label`;
  const dialogId = `${id}-dialog`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const focusGrid = useRef(false);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(todayKey);
  const [slide, setSlide] = useState<"next" | "prev" | null>(null);
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number } | null>(null);

  const validMin = min && DATE_RE.test(min) ? min : "";
  const validMax = max && DATE_RE.test(max) ? max : "";
  const disabled = (k: string) => (!!validMin && k < validMin) || (!!validMax && k > validMax);
  const clamp = (k: string) => (validMin && k < validMin ? validMin : validMax && k > validMax ? validMax : k);

  const place = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const height = popRef.current?.offsetHeight ?? 360;
    const width = popRef.current?.offsetWidth ?? 296;
    const flip = r.bottom + height + 8 > window.innerHeight && r.top > height + 8;
    // Align to the trigger's own start edge, kept inside the viewport.
    const anchor = rtl ? r.right - width : r.left;
    const left = Math.max(8, Math.min(anchor, window.innerWidth - width - 8));
    setPos(flip ? { left, bottom: window.innerHeight - r.top + 4 } : { left, top: r.bottom + 4 });
  };

  useLayoutEffect(() => {
    if (open) place();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cursor]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || popRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || !focusGrid.current || !pos) return;
    focusGrid.current = false;
    popRef.current?.querySelector<HTMLElement>(`[data-date="${cursor}"]`)?.focus();
  }, [open, cursor, pos]);

  const openPicker = () => {
    const start = value && DATE_RE.test(value) ? value : clamp(todayKey());
    setCursor(start);
    setSlide(null);
    focusGrid.current = true;
    setOpen(true);
  };

  const close = (returnFocus = true) => {
    setOpen(false);
    setPos(null);
    if (returnFocus) triggerRef.current?.focus();
  };

  const pick = (k: string) => {
    if (disabled(k)) return;
    onChange(k);
    close();
  };

  const move = (next: string, direction: "next" | "prev") => {
    const target = clamp(next);
    if (parts(target).m !== parts(cursor).m || parts(target).y !== parts(cursor).y) setSlide(direction);
    focusGrid.current = true;
    setCursor(target);
  };

  const onGridKey = (event: KeyboardEvent<HTMLElement>) => {
    const step = rtl ? -1 : 1;
    const { y, m } = parts(cursor);
    const weekday = new Date(Date.UTC(y, m, parts(cursor).d)).getUTCDay();
    const handled: Record<string, () => void> = {
      ArrowRight: () => move(addDays(cursor, step), step > 0 ? "next" : "prev"),
      ArrowLeft: () => move(addDays(cursor, -step), step > 0 ? "prev" : "next"),
      ArrowDown: () => move(addDays(cursor, 7), "next"),
      ArrowUp: () => move(addDays(cursor, -7), "prev"),
      Home: () => move(addDays(cursor, -weekday), "prev"),
      End: () => move(addDays(cursor, 6 - weekday), "next"),
      PageDown: () => move(addMonths(cursor, event.shiftKey ? 12 : 1), "next"),
      PageUp: () => move(addMonths(cursor, event.shiftKey ? -12 : -1), "prev"),
    };
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === "Tab") {
      // Keep the sheet's own focus trap (mobile) intact: leave the popover
      // by returning to the button rather than tabbing into the page.
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (handled[event.key] && (event.target as HTMLElement).dataset.date) {
      event.preventDefault();
      handled[event.key]();
    }
  };

  const { y: vy, m: vm } = parts(cursor);
  const months = useMemo(() => monthLongNames(locale), [locale]);
  const weekdays = useMemo(() => weekdayShortNames(locale), [locale]);
  const lead = new Date(Date.UTC(vy, vm, 1)).getUTCDay();
  const total = daysIn(vy, vm);
  const today = todayKey();
  const prevDisabled = !!validMin && key(vy, vm, 1) <= validMin;
  const nextDisabled = !!validMax && key(vy, vm, total) >= validMax;
  const shift = (n: number) => move(addMonths(cursor, n), n > 0 ? "next" : "prev");
  const display = value && DATE_RE.test(value) ? formatDate(value, locale) : "";

  return (
    <div className="control-select control-select--date">
      <span id={labelId} className="control-select__label">
        {label}
      </span>
      <button
        ref={triggerRef}
        type="button"
        className={`control-select__field date-picker__trigger${display ? "" : " date-picker__trigger--empty"}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
        aria-labelledby={labelId}
        data-value={value}
        data-min={validMin || undefined}
        data-max={validMax || undefined}
        onClick={() => (open ? close(false) : openPicker())}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            openPicker();
          }
        }}
      >
        <CalendarSmallIcon className="date-picker__icon" aria-hidden="true" />
        <span className="date-picker__text">{display || placeholder}</span>
      </button>
      {open
        ? createPortal(
            <div
              ref={popRef}
              id={dialogId}
              role="dialog"
              aria-label={label}
              className="date-picker__popover"
              style={{ left: pos?.left ?? 0, top: pos?.top, bottom: pos?.bottom, visibility: pos ? "visible" : "hidden" }}
              onKeyDown={onGridKey}
              onMouseDown={(e) => {
                if ((e.target as HTMLElement).closest("button") === null) e.preventDefault();
              }}
            >
              <div className="date-picker__header">
                <button
                  type="button"
                  className="date-picker__nav"
                  aria-label={t("previousMonth")}
                  disabled={prevDisabled}
                  onClick={() => shift(-1)}
                >
                  <ChevronIcon className="icon-prev" aria-hidden="true" />
                </button>
                <p className="date-picker__title" aria-live="polite">
                  {months[vm]} {vy}
                </p>
                <button
                  type="button"
                  className="date-picker__nav"
                  aria-label={t("nextMonth")}
                  disabled={nextDisabled}
                  onClick={() => shift(1)}
                >
                  <ChevronIcon className="icon-next" aria-hidden="true" />
                </button>
              </div>
              <div className="date-picker__weekdays" aria-hidden="true">
                {weekdays.map((w, i) => (
                  <span key={i}>{w}</span>
                ))}
              </div>
              <div
                key={`${vy}-${vm}`}
                role="grid"
                aria-label={`${months[vm]} ${vy}`}
                className={`date-picker__grid${slide ? ` date-picker__grid--${slide}` : ""}`}
              >
                {Array.from({ length: lead }, (_, i) => (
                  <span key={`b${i}`} role="presentation" />
                ))}
                {Array.from({ length: total }, (_, i) => {
                  const k = key(vy, vm, i + 1);
                  const off = disabled(k);
                  return (
                    <button
                      key={k}
                      type="button"
                      role="gridcell"
                      data-date={k}
                      tabIndex={k === cursor ? 0 : -1}
                      aria-selected={k === value}
                      aria-disabled={off || undefined}
                      aria-current={k === today ? "date" : undefined}
                      aria-label={formatDate(k, locale)}
                      className="date-picker__day"
                      onClick={() => pick(k)}
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>
              <div className="date-picker__footer">
                <button
                  type="button"
                  className="date-picker__link"
                  disabled={!value}
                  onClick={() => {
                    onChange("");
                    close();
                  }}
                >
                  {t("clearDate")}
                </button>
                <button
                  type="button"
                  className="date-picker__link"
                  disabled={disabled(today)}
                  onClick={() => pick(today)}
                >
                  {t("today")}
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
