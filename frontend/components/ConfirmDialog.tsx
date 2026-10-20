"use client";

import { useEffect, useId, useRef, type KeyboardEvent, type RefObject } from "react";
import { createPortal } from "react-dom";

/** Exported so other modal-like overlays (e.g. the Training Days filter
 * sheet on narrow viewports, see FilterBar.tsx) can reuse the same
 * focus-trap query instead of redefining it. */
export const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/** Accessible modal confirmation (no library): `role="dialog"` +
 * `aria-modal`, focus moves inside on open (to Cancel -- the safe
 * choice for an irreversible action), Tab is trapped, Escape and a
 * backdrop click cancel, and focus returns to the element that opened
 * it. The entrance is a short fade (see `.confirm-dialog` in CSS,
 * disabled under reduced motion). */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  busy = false,
  onConfirm,
  onCancel,
  returnFocusFallbackRef,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** Where focus goes on close when the opener can no longer take it (e.g.
   * it became disabled/busy or was removed). Give it a `tabIndex={-1}`
   * element such as the form container or heading. */
  returnFocusFallbackRef?: RefObject<HTMLElement | null>;
}) {
  const titleId = useId();
  const messageId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const fallbackEl = returnFocusFallbackRef?.current;

    // Modal: lock page scroll and take the rest of the app out of the
    // accessibility tree / tab order (siblings of the portal node).
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

    cancelRef.current?.focus();
    return () => {
      body.style.overflow = previousOverflow;
      for (const { el, inert, ariaHidden } of restore) {
        if (!inert) el.removeAttribute("inert");
        if (ariaHidden === null) el.removeAttribute("aria-hidden");
        else el.setAttribute("aria-hidden", ariaHidden);
      }
      // Focus can only return to an enabled, still-mounted opener; otherwise
      // fall back rather than dropping focus onto <body>.
      const openerUsable =
        previouslyFocused?.isConnected &&
        !(previouslyFocused as HTMLButtonElement).disabled &&
        previouslyFocused !== document.body;
      if (openerUsable) previouslyFocused.focus?.();
      else fallbackEl?.focus?.();
    };
  }, [open, returnFocusFallbackRef]);

  if (!open) return null;

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      if (!busy) onCancel();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(
      panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [],
    );
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
      className="confirm-dialog__backdrop"
      onKeyDown={handleKeyDown}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <div
        className="confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        ref={panelRef}
      >
        <h2 id={titleId} className="confirm-dialog__title">
          {title}
        </h2>
        <p id={messageId} className="confirm-dialog__message">
          {message}
        </p>
        <div className="button-row confirm-dialog__actions">
          <button type="button" className="button" onClick={onConfirm} disabled={busy}>
            {confirmLabel}
          </button>
          <button
            type="button"
            className="button button--secondary"
            onClick={onCancel}
            disabled={busy}
            ref={cancelRef}
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
