"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { ChevronDownIcon } from "@/components/icons";

export interface SortOption {
  value: string;
  label: string;
}

/** Labelled native select for choosing a sort order. */
export function SortControl({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SortOption[];
  label?: string;
}) {
  const t = useTranslations("Ui");
  const id = useId();
  return (
    <div className="control-select">
      <label htmlFor={id} className="control-select__label">
        {label ?? t("sortBy")}
      </label>
      <span className="control-select__wrap">
        <select
          id={id}
          className="control-select__field"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span className="control-select__chevron" aria-hidden="true">
          <ChevronDownIcon />
        </span>
      </span>
    </div>
  );
}
