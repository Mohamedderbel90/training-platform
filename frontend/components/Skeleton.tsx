import type { CSSProperties, ReactNode } from "react";

/** Structural loading placeholders with a subtle shimmer (static under
 * reduced motion). Decorative shapes are aria-hidden; pass `label` to a
 * group (or use `LoadingState variant="skeleton"`) to expose exactly one
 * polite status announcement. */

export function Skeleton({
  width,
  height,
  circle = false,
  className,
}: {
  width?: string | number;
  height?: string | number;
  circle?: boolean;
  className?: string;
}) {
  const style: CSSProperties = { inlineSize: width, blockSize: height };
  return (
    <span
      className={`skeleton${circle ? " skeleton--circle" : ""}${className ? ` ${className}` : ""}`}
      style={style}
      aria-hidden="true"
    />
  );
}

function Announced({ label, className, children }: { label?: string; className: string; children: ReactNode }) {
  if (label) {
    return (
      <div className={className} role="status" aria-busy="true">
        <span className="visually-hidden">{label}</span>
        <div aria-hidden="true" className="skeleton-group__body">
          {children}
        </div>
      </div>
    );
  }
  return (
    <div className={className} aria-hidden="true">
      {children}
    </div>
  );
}

export function SkeletonCard({ lines = 3, label }: { lines?: number; label?: string }) {
  return (
    <Announced label={label} className="skeleton-card">
      <div className="skeleton-card__head">
        <div className="skeleton-card__titles">
          <Skeleton height="1.05rem" width="55%" />
          <Skeleton height="0.8rem" width="35%" />
        </div>
        <Skeleton height="1.4rem" width="5rem" className="skeleton--pill" />
      </div>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} height="0.85rem" width={i === lines - 1 ? "60%" : "100%"} />
      ))}
    </Announced>
  );
}

export function SkeletonRows({ rows = 5, label }: { rows?: number; label?: string }) {
  return (
    <Announced label={label} className="skeleton-rows">
      {Array.from({ length: rows }, (_, i) => (
        <div className="skeleton-rows__row" key={i}>
          <Skeleton circle width="2rem" height="2rem" />
          <div className="skeleton-rows__text">
            <Skeleton height="0.9rem" width="50%" />
            <Skeleton height="0.75rem" width="30%" />
          </div>
        </div>
      ))}
    </Announced>
  );
}

export function SkeletonTable({
  rows = 5,
  columns = 4,
  label,
}: {
  rows?: number;
  columns?: number;
  label?: string;
}) {
  return (
    <Announced label={label} className="skeleton-table">
      {Array.from({ length: rows + 1 }, (_, r) => (
        <div
          className={`skeleton-table__row${r === 0 ? " skeleton-table__row--head" : ""}`}
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          key={r}
        >
          {Array.from({ length: columns }, (_, c) => (
            <Skeleton key={c} height={r === 0 ? "0.75rem" : "0.9rem"} width={c === 0 ? "80%" : "60%"} />
          ))}
        </div>
      ))}
    </Announced>
  );
}
