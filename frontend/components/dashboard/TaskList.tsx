"use client";

import { useId } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ArrowIcon, ChevronIcon, ClockIcon, DocumentIcon } from "@/components/icons";
import { EmptyState } from "@/components/StateViews";
import { StatusBadge } from "@/components/StatusBadge";
import { useAuth } from "@/lib/auth/AuthContext";
import { formatDate, formatTimeRange } from "@/lib/dashboard/format";
import type { DashboardTask } from "@/lib/dashboard/derive";

/** "Current tasks" block (M5 point 5E). Every entry is derived from a
 * real per-day survey/report/attendance status already returned by the
 * dashboard endpoint (see lib/dashboard/derive.ts) and arrives
 * urgency-ordered -- there is no announcement/content model in the
 * backend, so this never shows an invented "new update" item. Each row
 * separates: what to do (label), which course, when (date/time), its
 * status (text badge) and exactly one action (the row link).
 * `hasDays=false` distinguishes "nothing scheduled yet" from the
 * positive "all caught up" empty state. */
export function TaskList({
  tasks,
  viewAllHref,
  hasDays = true,
}: {
  tasks: DashboardTask[];
  viewAllHref: string;
  hasDays?: boolean;
}) {
  const t = useTranslations("Dashboard");
  const locale = useLocale();
  const { profile } = useAuth();
  const headingId = useId();

  return (
    <section className="card task-list" aria-labelledby={headingId}>
      <div className="task-list__header">
        <h2 className="card__title" id={headingId}>
          <span className="card__title-icon" aria-hidden="true">
            <DocumentIcon />
          </span>
          {t("tasksTitle")}
        </h2>
        <Link className="task-list__view-all" href={viewAllHref}>
          {t("tasksViewAll")}
          <ArrowIcon aria-hidden="true" />
        </Link>
      </div>
      {tasks.length === 0 ? (
        hasDays ? (
          <EmptyState
            variant="positive"
            title={t("tasksEmptyTitle")}
            message={t("tasksEmptyMessage")}
          />
        ) : (
          <EmptyState title={t("tasksNoDaysTitle")} message={t("tasksNoDaysMessage")} />
        )
      ) : (
        <ul className="task-list__items">
          {tasks.map((task) => {
            const time = formatTimeRange(task.startDatetime, task.endDatetime, locale, profile?.tz);
            const when = [task.date ? formatDate(task.date, locale) : null, time]
              .filter(Boolean)
              .join(" · ");
            const required = task.badge === "required";
            return (
              <li key={task.id} className="task-list__item">
                <Link href={task.href} className="task-list__link">
                  <span className="task-list__icon" aria-hidden="true">
                    <DocumentIcon />
                  </span>
                  <span className="task-list__text">
                    <span className="task-list__label">{t(task.labelKey)}</span>
                    <span className="task-list__course" title={task.courseName}>
                      {task.courseName}
                    </span>
                    {when ? (
                      <span className="task-list__when">
                        <ClockIcon aria-hidden="true" /> {when}
                      </span>
                    ) : null}
                  </span>
                  <span className="task-list__aside">
                    <StatusBadge tone={required ? "warning" : "info"}>
                      {t(required ? "taskRequiredBadge" : "taskUpcomingBadge")}
                    </StatusBadge>
                    <span className="task-list__action">
                      {t(required ? `taskAction.${task.kind}` : "taskAction.view")}
                      <ChevronIcon className="icon-next" aria-hidden="true" />
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
