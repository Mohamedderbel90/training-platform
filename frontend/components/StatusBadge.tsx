import type { ReactNode } from "react";

export type StatusTone = "neutral" | "success" | "warning" | "danger" | "info";

const TONE_CLASS: Record<StatusTone, string> = {
  neutral: "badge",
  success: "badge badge--success",
  warning: "badge badge--warning",
  danger: "badge badge--danger",
  info: "badge badge--info",
};

/** The single status pill. It always renders its text (`children`), so
 * meaning never depends on colour; the built-in dot and the optional
 * `icon` glyph are decorative and aria-hidden. `ariaLabel` lets a caller
 * give the badge a fuller accessible name (e.g. "Day Status: Open")
 * without showing that caption visibly -- used where a separate visible
 * label was removed for a leaner card but the context must still reach
 * screen readers. */
export function StatusBadge({
  tone = "neutral",
  icon,
  ariaLabel,
  className,
  children,
}: {
  tone?: StatusTone;
  icon?: ReactNode;
  ariaLabel?: string;
  /** Extra class appended to the badge's own tone class, e.g. to position
   * it (see `.day-card__status` in DayCard.tsx) without a second wrapper
   * element. */
  className?: string;
  children: ReactNode;
}) {
  return (
    <span className={`${TONE_CLASS[tone]}${className ? ` ${className}` : ""}`} aria-label={ariaLabel}>
      {children}
      {icon ? <span aria-hidden="true">{icon}</span> : null}
    </span>
  );
}
