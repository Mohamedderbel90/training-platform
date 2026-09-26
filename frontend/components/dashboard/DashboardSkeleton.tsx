import { Skeleton } from "@/components/Skeleton";

/** Loading placeholders shaped like the real dashboards (banner, hero +
 * tasks, stat tiles, progress cards) so content replaces them without
 * layout shift. One polite status announcement carries `label`; every
 * shape is aria-hidden. Reuses the shared `.skeleton` primitives and the
 * real grid classes, so responsive stacking matches the loaded page. */
export function DashboardSkeleton({ label }: { label: string }) {
  return (
    <div className="dashboard--skeleton" role="status" aria-busy="true">
      <span className="visually-hidden">{label}</span>
      <div aria-hidden="true" className="dashboard dashboard--static">
        <div className="welcome-banner welcome-banner--skeleton">
          <div className="welcome-banner__body">
            <Skeleton height="1.8rem" width="55%" />
            <Skeleton height="1rem" width="75%" />
            <Skeleton height="2.4rem" width="12rem" />
          </div>
        </div>
        <div className="dashboard-grid">
          <div className="skeleton-card skeleton-card--tall">
            <Skeleton height="1.1rem" width="40%" />
            <div className="skeleton-hero">
              <Skeleton height="7.5rem" width="8rem" />
              <div className="skeleton-hero__info">
                <Skeleton height="1.2rem" width="70%" />
                <Skeleton height="0.85rem" width="45%" />
                <Skeleton height="0.85rem" width="55%" />
              </div>
            </div>
            <Skeleton height="2.75rem" width="100%" />
          </div>
          <div className="skeleton-card skeleton-card--tall">
            <Skeleton height="1.1rem" width="35%" />
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} height="3.6rem" width="100%" />
            ))}
          </div>
        </div>
        <StatGridSkeleton />
        <div className="dashboard-grid dashboard-grid--three">
          {Array.from({ length: 3 }, (_, i) => (
            <div className="skeleton-card" key={i}>
              <Skeleton height="1.05rem" width="50%" />
              <Skeleton height="0.85rem" width="100%" />
              <Skeleton height="0.85rem" width="70%" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatGridSkeleton() {
  return (
    <div className="stats-section">
      <div className="stat-grid">
      {Array.from({ length: 4 }, (_, i) => (
        <div className="stat-card skeleton-stat" key={i}>
          <Skeleton circle width="3.25rem" height="3.25rem" />
          <div className="skeleton-stat__text">
            <Skeleton height="1.6rem" width="40%" />
            <Skeleton height="0.8rem" width="70%" />
          </div>
        </div>
      ))}
      </div>
    </div>
  );
}

/** Skeleton for the trainee program page: program card, stat tiles and
 * the course list. */
export function ProgramSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-busy="true">
      <span className="visually-hidden">{label}</span>
      <div aria-hidden="true">
        <div className="skeleton-card skeleton-card--program">
          <Skeleton height="1.2rem" width="45%" />
          <Skeleton height="0.85rem" width="30%" />
        </div>
        <StatGridSkeleton />
        <div className="course-list skeleton-course-list">
          {Array.from({ length: 3 }, (_, i) => (
            <div className="skeleton-card" key={i}>
              <Skeleton height="1rem" width="50%" />
              <Skeleton height="0.8rem" width="70%" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
