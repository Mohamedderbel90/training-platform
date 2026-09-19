import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ClipboardIcon } from "@/components/icons";
import type { DashboardTask } from "@/lib/dashboard/derive";

/** "Current tasks" block (M5 point 5E). Every entry is derived from a
 * real per-day survey/report status already returned by the dashboard
 * endpoint (see lib/dashboard/derive.ts) -- there is no announcement/
 * content model in the backend, so this never shows an invented "new
 * update" item, only actionable or soon-to-open items. */
export function TaskList({
  tasks,
  viewAllHref,
}: {
  tasks: DashboardTask[];
  viewAllHref: string;
}) {
  const t = useTranslations("Dashboard");

  return (
    <section className="card task-list">
      <div className="task-list__header">
        <Link className="task-list__view-all" href={viewAllHref}>
          {t("tasksViewAll")}
        </Link>
        <h2 className="card__title">
          <ClipboardIcon /> {t("tasksTitle")}
        </h2>
      </div>
      {tasks.length === 0 ? (
        <p className="card__meta">{t("tasksEmptyMessage")}</p>
      ) : (
        <ul className="task-list__items">
          {tasks.map((task) => (
            <li key={task.id} className="task-list__item">
              <Link href={task.href} className="task-list__link">
                <span className={`badge badge--${task.badge === "required" ? "warning" : "info"}`}>
                  {t(task.badge === "required" ? "taskRequiredBadge" : "taskUpcomingBadge")}
                </span>
                <span className="task-list__text">
                  <span className="task-list__label">{t(task.labelKey)}</span>
                  <span className="task-list__course">{task.courseName}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
