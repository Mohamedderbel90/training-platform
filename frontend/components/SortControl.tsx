"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { Tooltip } from "@/components/Tooltip";
import { SelectMenu } from "@/components/SelectMenu";
import { InfoIcon } from "@/components/icons";

export interface SortOption {
  value: string;
  label: string;
}

/** Labelled native select for choosing a sort order (and reused for
 * several other single-choice list filters, e.g. Day/Evaluation/Survey
 * Status -- see DayListToolbar.tsx). */
export function SortControl({
  value,
  onChange,
  options,
  label,
  hint,
  compact = false,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SortOption[];
  label?: string;
  /** Optional clarifying text shown via an inline info icon next to the
   * label (hover and keyboard focus, see `Tooltip`) -- for a label whose
   * meaning isn't self-evident at a glance, e.g. "Evaluation Status"
   * meaning action-availability rather than the record's own lifecycle
   * state (see `ACTION_AVAILABILITY_GROUPS` in listControls.ts). */
  hint?: string;
  /** Visually hides the label (still in the DOM, still associated via
   * `htmlFor`, so it stays announced to screen readers) and renders a
   * smaller, low-chrome inline select -- used to place Sort-by compactly
   * next to the Training Days results count (see `.filter-bar__sort` in
   * globals.css), matching the approved reference's single-line
   * treatment. Every other caller is unaffected (defaults to false). */
  compact?: boolean;
}) {
  const t = useTranslations("Ui");
  const id = useId();
  const labelId = `${id}-label`;
  const text = label ?? t("sortBy");
  return (
    <div className="control-select">
      <span className="control-select__label-row">
        <label id={labelId} htmlFor={id} className={compact ? "visually-hidden" : "control-select__label"}>
          {text}
        </label>
        {hint ? (
          <Tooltip content={hint} placement="bottom">
            {(trigger) => (
              <button type="button" className="control-select__hint" aria-label={hint} {...trigger}>
                <InfoIcon aria-hidden="true" />
              </button>
            )}
          </Tooltip>
        ) : null}
      </span>
      <span className="control-select__wrap">
        <SelectMenu id={id} labelledBy={labelId} value={value} onChange={onChange} options={options} className="control-select__field" />
      </span>
    </div>
  );
}
