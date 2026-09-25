import type { ReactNode } from "react";
import { useId } from "react";

/** Titled group of day cards for the role destination pages
 * (surveys / evaluations / reports). Renders nothing for an empty
 * group unless `emptyMessage` is given. */
export function DaySection({
  title,
  count,
  emptyMessage,
  children,
}: {
  title: string;
  count: number;
  emptyMessage?: string;
  children: ReactNode;
}) {
  const id = useId();
  if (count === 0 && !emptyMessage) return null;
  return (
    <section className="page-section" aria-labelledby={id}>
      <h2 className="page-section__title" id={id}>
        {title} <span className="page-section__count">({count})</span>
      </h2>
      {count === 0 ? <p className="card__meta">{emptyMessage}</p> : <div className="card-list">{children}</div>}
    </section>
  );
}
