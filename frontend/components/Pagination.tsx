"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { SelectMenu } from "@/components/SelectMenu";
import { ChevronIcon } from "@/components/icons";

/** Previous/next pagination with "Page X of Y" and an optional page-size
 * select. Chevrons are mirrored by CSS from the document direction
 * (`.icon-next` / `.icon-prev`), not by reversing the row. Built for
 * genuinely long lists only; renders nothing for a single page unless a
 * page-size control was requested. */
export function Pagination({
  page,
  pageCount,
  onPageChange,
  pageSize,
  pageSizeOptions,
  onPageSizeChange,
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
  pageSizeOptions?: number[];
  onPageSizeChange?: (size: number) => void;
}) {
  const t = useTranslations("Ui");
  const sizeId = useId();
  const sizeLabelId = `${sizeId}-label`;
  const showSize = Boolean(onPageSizeChange && pageSizeOptions?.length);
  if (pageCount <= 1 && !showSize) return null;
  const current = Math.min(Math.max(page, 1), Math.max(pageCount, 1));

  return (
    <nav className="pagination" aria-label={t("paginationLabel")}>
      <div className="pagination__pager">
        <button
          type="button"
          className="button button--secondary pagination__btn"
          onClick={() => onPageChange(current - 1)}
          disabled={current <= 1}
          aria-label={t("previousPage")}
        >
          <ChevronIcon className="icon-prev" />
        </button>
        <span className="pagination__status" aria-current="page">
          {t("pageOf", { page: current, pageCount: Math.max(pageCount, 1) })}
        </span>
        <button
          type="button"
          className="button button--secondary pagination__btn"
          onClick={() => onPageChange(current + 1)}
          disabled={current >= pageCount}
          aria-label={t("nextPage")}
        >
          <ChevronIcon className="icon-next" />
        </button>
      </div>
      {showSize ? (
        <div className="pagination__size">
          <span id={sizeLabelId} className="pagination__size-label">
            {t("pageSize")}
          </span>
          <SelectMenu
            id={sizeId}
            labelledBy={sizeLabelId}
            className="control-select__field pagination__size-select"
            value={String(pageSize)}
            onChange={(v) => onPageSizeChange?.(Number(v))}
            options={(pageSizeOptions ?? []).map((n) => ({ value: String(n), label: String(n) }))}
          />
        </div>
      ) : null}
    </nav>
  );
}
