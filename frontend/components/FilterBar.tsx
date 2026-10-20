"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { FOCUSABLE } from "@/components/ConfirmDialog";
import { ChevronDownIcon, CloseIcon, FilterIcon, TrashIcon } from "@/components/icons";

export interface ActiveFilter {
  id: string;
  /** Visible text of the chip, e.g. "Status: Open". */
  label: string;
  onRemove: () => void;
}

/** Removable chip describing one active filter (text, never colour-only). */
export function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  const t = useTranslations("Ui");
  return (
    <button
      type="button"
      className="filter-chip"
      onClick={onRemove}
      aria-label={t("removeFilter", { label })}
    >
      <span>{label}</span>
      <CloseIcon aria-hidden="true" />
    </button>
  );
}

/** Matches the `@media (min-width: 768px)` breakpoint `.filter-bar__panel`
 * already switches on in globals.css. `matchMedia` is unavailable in
 * jsdom (and during SSR), so this always resolves to `false` there --
 * every existing FilterBar test keeps exercising the desktop inline
 * panel unchanged; only a real narrow browser viewport switches the
 * panel to the sheet below. */
const NARROW_QUERY = "(max-width: 767px)";

function useIsNarrowViewport(query: string = NARROW_QUERY): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(query).matches
      : false,
  );
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

/**
 * Narrow-viewport filter panel: a bottom-sheet overlay instead of the
 * inline accordion the desktop panel uses. Reuses the exact modal
 * mechanics `ConfirmDialog` already established for this codebase --
 * focus trapped inside, the rest of the app made `inert`, page scroll
 * locked, Escape/backdrop close it, and focus returns to whatever opened
 * it -- rather than inventing a second pattern, since a filter sheet is
 * the same class of problem (a temporary overlay stacked above
 * everything else). Selecting a filter inside never closes the sheet;
 * only Escape, the backdrop or the explicit close button do (point 7).
 */
function FilterSheet({
  id,
  open,
  title,
  count,
  closeLabel,
  onClose,
  children,
}: {
  id: string;
  open: boolean;
  title: string;
  count: number;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const body = document.body;
    const previousOverflow = body.style.overflow;
    body.style.overflow = "hidden";
    const background = Array.from(body.children).filter(
      (el): el is HTMLElement =>
        el instanceof HTMLElement && el !== backdropRef.current && el.tagName !== "SCRIPT",
    );
    const restore = background.map((el) => ({
      el,
      inert: el.hasAttribute("inert"),
      ariaHidden: el.getAttribute("aria-hidden"),
    }));
    for (const el of background) {
      el.setAttribute("inert", "");
      el.setAttribute("aria-hidden", "true");
    }

    closeRef.current?.focus();
    return () => {
      body.style.overflow = previousOverflow;
      for (const { el, inert, ariaHidden } of restore) {
        if (!inert) el.removeAttribute("inert");
        if (ariaHidden === null) el.removeAttribute("aria-hidden");
        else el.setAttribute("aria-hidden", ariaHidden);
      }
      const openerUsable =
        previouslyFocused?.isConnected &&
        !(previouslyFocused as HTMLButtonElement).disabled &&
        previouslyFocused !== document.body;
      if (openerUsable) previouslyFocused.focus?.();
    };
  }, [open]);

  if (!open) return null;

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !panelRef.current?.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !panelRef.current?.contains(active))) {
      event.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div
      ref={backdropRef}
      className="filter-sheet__backdrop"
      onKeyDown={handleKeyDown}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div id={id} className="filter-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={panelRef}>
        <div className="filter-sheet__header">
          <h2 id={titleId} className="filter-sheet__title">
            {title}
            {count > 0 ? <span className="filter-bar__count">{count}</span> : null}
          </h2>
          <button
            type="button"
            className="button button--ghost button--icon filter-sheet__close"
            onClick={onClose}
            aria-label={closeLabel}
            ref={closeRef}
          >
            <CloseIcon />
          </button>
        </div>
        <div className="filter-sheet__body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

/** Compact filter toolbar: an optional `search` slot, the filter
 * controls (`children`, native selects/segmented controls), removable
 * chips for active filters, a "Clear filters" action shown only when
 * something is active, and a polite live result count. The controls panel
 * collapses behind a toggle at every width; only search + `primary`
 * controls stay in the compact top row. On narrow viewports the panel
 * opens as a bottom sheet overlay instead of an inline accordion (see
 * `FilterSheet` above). */
export function FilterBar({
  search,
  children,
  activeFilters = [],
  onClear,
  resultCount,
  resultText,
  primary,
  panelActiveCount,
  sort,
}: {
  search?: ReactNode;
  /** Always-visible controls beside the search (e.g. the Course select). */
  primary?: ReactNode;
  /** How many active filters live inside the collapsible panel (badge on the
   * toggle, and whether the panel starts open). Defaults to every chip. */
  panelActiveCount?: number;
  /** Collapsible panel content (secondary filters). */
  children?: ReactNode;
  activeFilters?: ActiveFilter[];
  onClear?: () => void;
  resultCount?: number;
  /** Ready-made result text (e.g. "12 of 32 training days"); wins over `resultCount`. */
  resultText?: string;
  /** Sort-by control shown on the same row as the result count (e.g. the
   * Training Days list's card-view-only Sort-by) -- matching the approved
   * reference, where the two sit on one line above the results. */
  sort?: ReactNode;
}) {
  const t = useTranslations("Ui");
  const panelId = useId();
  const count = panelActiveCount ?? activeFilters.length;
  // Open on first render only when a panel filter is already active (URL);
  // afterwards the user owns the toggle.
  const [open, setOpen] = useState(count > 0);
  const isNarrow = useIsNarrowViewport();

  return (
    <div className="filter-bar">
      <div className="filter-bar__top">
        {search ? <div className="filter-bar__search">{search}</div> : null}
        {primary ? <div className="filter-bar__primary">{primary}</div> : null}
        {children ? (
          <button
            type="button"
            className="button button--secondary filter-bar__toggle"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((o) => !o)}
          >
            <FilterIcon />
            <span>{t("filters")}</span>
            {count > 0 ? <span className="filter-bar__count">{count}</span> : null}
            <ChevronDownIcon className="filter-bar__toggle-chevron" />
          </button>
        ) : null}
      </div>
      {children && isNarrow ? (
        <FilterSheet
          id={panelId}
          open={open}
          title={t("filters")}
          count={count}
          closeLabel={t("close")}
          onClose={() => setOpen(false)}
        >
          <div className="filter-bar__controls">{children}</div>
        </FilterSheet>
      ) : null}
      {children && !isNarrow ? (
        <div id={panelId} className="filter-bar__panel" data-open={open}>
          <div className="filter-bar__panel-inner">
            <div className="filter-bar__controls">{children}</div>
          </div>
        </div>
      ) : null}
      {activeFilters.length > 0 ? (
        <div className="filter-bar__active">
          <ul className="filter-bar__chips" aria-label={t("activeFiltersList")}>
            {activeFilters.map((f) => (
              <li key={f.id}>
                <FilterChip label={f.label} onRemove={f.onRemove} />
              </li>
            ))}
          </ul>
          {onClear ? (
            <button type="button" className="button button--ghost filter-bar__clear" onClick={onClear}>
              <TrashIcon aria-hidden="true" />
              {t("clearFilters")}
            </button>
          ) : null}
        </div>
      ) : null}
      {resultText !== undefined || resultCount !== undefined || sort ? (
        <div className="filter-bar__results-row">
          <p className="filter-bar__results" aria-live="polite" aria-atomic="true">
            {resultText ?? t("resultCount", { count: resultCount ?? 0 })}
          </p>
          {sort ? <div className="filter-bar__sort">{sort}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
