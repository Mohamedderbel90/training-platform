"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { CheckSmallIcon, ChevronDownIcon } from "@/components/icons";

export interface SelectMenuOption {
  value: string;
  label: string;
}

/**
 * Themed single-choice dropdown replacing the native `<select>` (WAI-ARIA
 * "select-only combobox"): the trigger keeps focus the whole time and
 * points at the highlighted option via `aria-activedescendant`, so it
 * also works inside the mobile filter sheet's focus trap.
 *
 * Keyboard: Enter/Space/ArrowDown/ArrowUp open; arrows, Home/End move the
 * highlight; typing jumps to a matching option; Enter/Space selects;
 * Escape closes (and stops propagating, so it never also closes a parent
 * sheet); Tab closes and moves on.
 *
 * The list renders in a portal with fixed positioning because the filter
 * panel clips its overflow (it animates its height). RTL needs no special
 * casing: option rows use logical properties and the menu is aligned to
 * the trigger's own edges, whichever side they are on.
 */
export function SelectMenu({
  id,
  value,
  onChange,
  options,
  labelledBy,
  className = "",
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectMenuOption[];
  /** Id of the visible/visually-hidden label element naming this control. */
  labelledBy: string;
  className?: string;
}) {
  const listId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typeahead = useRef({ text: "", timer: 0 });
  const [open, setOpen] = useState(false);
  const selectedIndex = Math.max(0, options.findIndex((o) => o.value === value));
  const [active, setActive] = useState(selectedIndex);
  const [rect, setRect] = useState<{ left: number; top: number; width: number; flip: boolean } | null>(null);
  const selected = options[selectedIndex];

  const place = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const menuHeight = Math.min(listRef.current?.scrollHeight ?? 0, 288) + 8;
    const flip = r.bottom + menuHeight > window.innerHeight && r.top > menuHeight;
    setRect({ left: r.left, top: flip ? r.top - 4 : r.bottom + 4, width: r.width, flip });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || listRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onMove = () => place();
    document.addEventListener("mousedown", onPointer);
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView?.({ block: "nearest" });
  }, [open, active]);

  const openMenu = (index = selectedIndex) => {
    setActive(index);
    setOpen(true);
  };

  const choose = (index: number) => {
    const option = options[index];
    setOpen(false);
    triggerRef.current?.focus();
    if (option && option.value !== value) onChange(option.value);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const last = options.length - 1;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (!open) openMenu();
        else setActive((i) => Math.min(last, i + 1));
        return;
      case "ArrowUp":
        event.preventDefault();
        if (!open) openMenu();
        else setActive((i) => Math.max(0, i - 1));
        return;
      case "Home":
        if (open) {
          event.preventDefault();
          setActive(0);
        }
        return;
      case "End":
        if (open) {
          event.preventDefault();
          setActive(last);
        }
        return;
      case "Enter":
      case " ":
        if (event.key === " " && typeahead.current.text) break;
        event.preventDefault();
        if (open) choose(active);
        else openMenu();
        return;
      case "Escape":
        if (open) {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
        }
        return;
      case "Tab":
        setOpen(false);
        return;
    }
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const state = typeahead.current;
      window.clearTimeout(state.timer);
      state.text += event.key.toLocaleLowerCase();
      state.timer = window.setTimeout(() => (state.text = ""), 600);
      const from = open ? active : selectedIndex;
      const ordered = [...options.keys()].map((_, n) => (from + 1 + n) % options.length);
      const hit = ordered.find((i) => options[i].label.toLocaleLowerCase().startsWith(state.text));
      if (hit !== undefined) {
        if (open) setActive(hit);
        else if (options[hit].value !== value) onChange(options[hit].value);
      }
    }
  };

  const optionId = (i: number) => `${listId}-opt-${i}`;

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        className={`select-menu__trigger ${className}`.trim()}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-labelledby={labelledBy}
        aria-activedescendant={open ? optionId(active) : undefined}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKeyDown}
        onBlur={(e) => {
          if (!listRef.current?.contains(e.relatedTarget as Node)) setOpen(false);
        }}
      >
        <span className="select-menu__value">{selected?.label}</span>
        <span className="select-menu__chevron" aria-hidden="true">
          <ChevronDownIcon />
        </span>
      </button>
      {open && rect
        ? createPortal(
            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              aria-labelledby={labelledBy}
              tabIndex={-1}
              className={`select-menu__list${rect.flip ? " select-menu__list--up" : ""}`}
              style={{
                left: rect.left,
                top: rect.flip ? undefined : rect.top,
                bottom: rect.flip ? window.innerHeight - rect.top : undefined,
                minInlineSize: rect.width,
              }}
              onMouseDown={(e) => e.preventDefault()}
            >
              {options.map((o, i) => (
                <li
                  key={o.value}
                  id={optionId(i)}
                  role="option"
                  data-index={i}
                  aria-selected={o.value === value}
                  data-active={i === active}
                  className="select-menu__option"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(i)}
                >
                  <span className="select-menu__option-label">{o.label}</span>
                  {o.value === value ? <CheckSmallIcon className="select-menu__check" aria-hidden="true" /> : null}
                </li>
              ))}
            </ul>,
            document.body,
          )
        : null}
    </>
  );
}
