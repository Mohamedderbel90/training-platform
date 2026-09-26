"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { CloseIcon, SearchIcon } from "@/components/icons";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

/** Labelled search box. Controlled via `value`/`onChange`; with
 * `debounceMs > 0` typing is emitted after the pause, while clearing
 * (button or Escape) always emits immediately. Filtering itself stays the
 * caller's concern. */
export function SearchInput({
  value,
  onChange,
  label,
  placeholder,
  debounceMs = 0,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  debounceMs?: number;
  className?: string;
}) {
  const t = useTranslations("Ui");
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(value);
  const [seenValue, setSeenValue] = useState(value);
  if (value !== seenValue) {
    // The parent changed the value (e.g. "Clear filters"): follow it.
    setSeenValue(value);
    setDraft(value);
  }

  const debounced = useDebouncedValue(draft, debounceMs);
  const latest = useRef({ value, onChange });
  useEffect(() => {
    latest.current = { value, onChange };
  });
  useEffect(() => {
    if (debounceMs > 0 && debounced !== latest.current.value) {
      latest.current.onChange(debounced);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const emitNow = (next: string) => {
    setDraft(next);
    onChange(next);
  };

  const handleChange = (next: string) => {
    setDraft(next);
    if (debounceMs <= 0) onChange(next);
  };

  const clear = () => {
    emitNow("");
    inputRef.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape" && draft !== "") {
      e.preventDefault();
      e.stopPropagation();
      emitNow("");
    }
  };

  const text = label ?? t("searchLabel");
  return (
    <div className={`search-input${className ? ` ${className}` : ""}`}>
      <label htmlFor={id} className="visually-hidden">
        {text}
      </label>
      <span className="search-input__icon" aria-hidden="true">
        <SearchIcon />
      </span>
      <input
        ref={inputRef}
        id={id}
        type="search"
        className="search-input__field"
        value={draft}
        placeholder={placeholder ?? t("searchPlaceholder")}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={onKeyDown}
        autoComplete="off"
      />
      {draft !== "" ? (
        <button
          type="button"
          className="search-input__clear"
          onClick={clear}
          aria-label={t("clearSearch")}
        >
          <CloseIcon />
        </button>
      ) : null}
    </div>
  );
}
