import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { BookIcon, CheckSmallIcon, ChevronDownIcon } from "@/components/icons";
import { formatProgramRange } from "@/lib/dashboard/format";
import type { DashboardProgramDto, DashboardProgramOptionDto } from "@/lib/api/types";

/** Header "current program" box (M5 point 3 HEADER). With more than one
 * program to choose from (`programs`) and an `onSelect`, it is a dropdown
 * that switches the program the Dashboard and Training Days show; with a
 * single program it stays a plain, informational box (no chevron, nothing
 * to switch to). `topbar` selects the approved header's own variant
 * (no icon tile; the chevron appears only when switching is possible);
 * the plain variant (icon tile) is kept for any non-header reuse. */
export function ProgramInfoBox({
  program,
  topbar,
  programs = [],
  onSelect,
}: {
  program: DashboardProgramDto | null;
  topbar?: boolean;
  programs?: DashboardProgramOptionDto[];
  onSelect?: (programId: number) => void;
}) {
  const t = useTranslations("Dashboard");
  const locale = useLocale();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const switchable = Boolean(topbar && onSelect && programs.length > 1);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open]);

  if (!program) return null;

  const className = `program-info-box${topbar ? " program-info-box--topbar" : ""}`;
  const body = (
    <>
      {topbar ? null : (
        <span className="program-info-box__icon">
          <BookIcon />
        </span>
      )}
      <span className="program-info-box__text">
        <span className="program-info-box__label">{t("programCurrentLabel")}</span>
        <span className="program-info-box__name">{program.name}</span>
        <span className="program-info-box__dates">
          {formatProgramRange(program.start_date, program.end_date, locale)}
        </span>
      </span>
      {switchable ? (
        <ChevronDownIcon className="program-info-box__chevron" aria-hidden="true" />
      ) : null}
    </>
  );

  if (!switchable) return <div className={className}>{body}</div>;

  const choose = (id: number) => {
    setOpen(false);
    triggerRef.current?.focus();
    if (id !== program.id) onSelect?.(id);
  };

  const openList = () => {
    setActive(Math.max(0, programs.findIndex((p) => p.id === program.id)));
    setOpen(true);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === "Escape" && open) {
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return openList();
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (i + step + programs.length) % programs.length);
    } else if ((e.key === "Enter" || e.key === " ") && open) {
      e.preventDefault();
      choose(programs[active].id);
    }
  };

  return (
    <div className="program-switcher" ref={rootRef} onKeyDown={onKeyDown}>
      <button
        type="button"
        ref={triggerRef}
        className={`${className} program-switcher__trigger`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={t("programSwitcherLabel")}
        onClick={() => (open ? setOpen(false) : openList())}
      >
        {body}
      </button>
      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="program-switcher__list"
          aria-label={t("programSwitcherLabel")}
          aria-activedescendant={`${listId}-${programs[active].id}`}
          tabIndex={-1}
        >
          {programs.map((option, index) => (
            <li
              key={option.id}
              id={`${listId}-${option.id}`}
              role="option"
              aria-selected={option.id === program.id}
              className={`program-switcher__option${index === active ? " is-active" : ""}`}
              onMouseEnter={() => setActive(index)}
              onClick={() => choose(option.id)}
            >
              <span className="program-switcher__text">
                <span className="program-switcher__name">{option.name}</span>
                <span className="program-switcher__dates">
                  {formatProgramRange(option.start_date, option.end_date, locale)}
                </span>
              </span>
              {option.id === program.id ? <CheckSmallIcon aria-hidden="true" /> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
