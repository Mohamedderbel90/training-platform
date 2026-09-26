"use client";

import { useId, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ChevronDownIcon, CloseIcon, FilterIcon } from "@/components/icons";

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

/** Compact filter toolbar: an optional `search` slot, the filter
 * controls (`children`, native selects/segmented controls), removable
 * chips for active filters, a "Clear filters" action shown only when
 * something is active, and a polite live result count. The controls panel
 * collapses behind a toggle at every width; only search + `primary`
 * controls stay in the compact top row. */
export function FilterBar({
  search,
  children,
  activeFilters = [],
  onClear,
  resultCount,
  resultText,
  primary,
  panelActiveCount,
}: {
  search?: ReactNode;
  /** Always-visible controls beside the search (e.g. the sort select). */
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
}) {
  const t = useTranslations("Ui");
  const panelId = useId();
  const count = panelActiveCount ?? activeFilters.length;
  // Open on first render only when a panel filter is already active (URL);
  // afterwards the user owns the toggle.
  const [open, setOpen] = useState(count > 0);

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
      {children ? (
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
              {t("clearFilters")}
            </button>
          ) : null}
        </div>
      ) : null}
      {resultText !== undefined || resultCount !== undefined ? (
        <p className="filter-bar__results" aria-live="polite" aria-atomic="true">
          {resultText ?? t("resultCount", { count: resultCount ?? 0 })}
        </p>
      ) : null}
    </div>
  );
}
