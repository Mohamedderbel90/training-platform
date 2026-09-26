/** Thin done/total progress bar. Exposed as a real `progressbar` with
 * min/max/now and a plain-language `valueText` (e.g. "3 of 10 completed")
 * so its meaning never depends on the fill. The fill is a transform
 * (no layout animation) that grows from the inline-start edge in both
 * directions; the entrance is disabled under reduced motion. Callers
 * must not render it when `total` is 0 -- there is nothing to measure. */
export function ProgressBar({
  done,
  total,
  label,
  valueText,
  className,
}: {
  done: number;
  total: number;
  label: string;
  valueText: string;
  className?: string;
}) {
  const clamped = Math.min(Math.max(done, 0), total);
  const fraction = total > 0 ? clamped / total : 0;
  return (
    <div
      className={`progress${className ? ` ${className}` : ""}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={clamped}
      aria-valuetext={valueText}
    >
      <span className="progress__fill" style={{ transform: `scaleX(${fraction})` }} />
    </div>
  );
}
