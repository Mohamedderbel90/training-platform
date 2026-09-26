"use client";

import type { ReactNode } from "react";

/** Primary action button with an inline spinner while `loading`. The
 * label swaps to `loadingLabel`, the button is disabled and marked
 * `aria-busy`. `type` defaults to submit; pass `button` for handlers. */
export function SubmitButton({
  loading = false,
  loadingLabel,
  children,
  icon,
  className = "button",
  type = "submit",
  disabled,
  onClick,
}: {
  loading?: boolean;
  loadingLabel: string;
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
  type?: "submit" | "button";
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      className={className}
      disabled={loading || disabled}
      aria-busy={loading || undefined}
      onClick={onClick}
    >
      {loading ? <span className="button__spinner" aria-hidden="true" /> : null}
      {loading ? loadingLabel : children}
      {!loading ? icon : null}
    </button>
  );
}
