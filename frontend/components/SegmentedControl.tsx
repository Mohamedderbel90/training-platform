"use client";

import { useId } from "react";

export interface SegmentedOption {
  value: string;
  label: string;
}

/** Accessible radio-group styled as pill segments (e.g. "All / Upcoming /
 * Completed"). Built on native radio inputs so keyboard behaviour,
 * labelling and `:focus-visible` come for free; the pill/dot look is
 * pure CSS on the visible label. Used where a page needs a simpler,
 * single-choice grouping than the full `FilterBar` panel (e.g. the
 * trainee Training Days page). */
export function SegmentedControl({
  name,
  value,
  onChange,
  options,
  ariaLabel,
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: SegmentedOption[];
  ariaLabel: string;
}) {
  const id = useId();
  return (
    <div className="segmented" role="radiogroup" aria-label={ariaLabel}>
      {options.map((option) => {
        const optionId = `${id}-${option.value || "all"}`;
        return (
          <span className="segmented__option" key={option.value}>
            <input
              type="radio"
              id={optionId}
              name={name}
              className="segmented__input"
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <label className="segmented__pill" htmlFor={optionId}>
              {option.label}
            </label>
          </span>
        );
      })}
    </div>
  );
}
