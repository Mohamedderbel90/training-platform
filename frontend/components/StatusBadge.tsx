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
 * `icon` glyph are decorative and aria-hidden. */
export function StatusBadge({
  tone = "neutral",
  icon,
  children,
}: {
  tone?: StatusTone;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <span className={TONE_CLASS[tone]}>
      {children}
      {icon ? <span aria-hidden="true">{icon}</span> : null}
    </span>
  );
}
