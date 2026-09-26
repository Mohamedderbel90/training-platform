"use client";

import { useLocale, useTranslations } from "next-intl";
import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";
import { useDashboardSummary } from "@/lib/dashboard/useDashboardSummary";
import { formatProgramRange } from "@/lib/dashboard/format";
import { closedDaysRatio, completedCoursesRatio, daysForProgram } from "@/lib/dashboard/derive";
import { EmptyState } from "@/components/StateViews";
import { ProgramSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { ProgressBar } from "@/components/ProgressBar";
import { StatusBadge } from "@/components/StatusBadge";
import { ApiErrorView } from "@/components/ApiErrorView";
import { StatCards } from "@/components/dashboard/StatCards";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ROLE_HOME } from "@/lib/auth/roleHome";

function TraineeProgramContent() {
  const t = useTranslations("Dashboard");
  const p = useTranslations("Pages");
  const nav = useTranslations("Nav");
  const locale = useLocale();
  const { data, status, error, reload } = useDashboardSummary("trainee");

  if (status === "loading") return <ProgramSkeleton label={t("loading")} />;
  if (status === "error" && error) return <ApiErrorView error={error} onRetry={reload} />;

  const program = data?.program ?? null;
  const courses = [...(program?.courses ?? [])].sort((a, b) => a.sequence - b.sequence);
  const programDays = daysForProgram(data?.days ?? [], program?.id);

  return (
    <div>
      <Breadcrumbs homeHref={ROLE_HOME.trainee} items={[{ label: nav("program") }]} />
      <PageHeader title={<h1>{p("programTitle")}</h1>} subtitle={p("programSubtitle")} />
      {!program ? (
        <EmptyState title={p("programEmptyTitle")} message={p("programEmptyMessage")} />
      ) : (
        <>
          <article className="card">
            <div className="card__title-row">
              <div>
                <h2 className="card__title">{program.name}</h2>
                <p className="card__meta">
                  {formatProgramRange(program.start_date, program.end_date, locale)}
                </p>
              </div>
              {program.state ? (
                <dl className="status-line">
                  <dt>{p("programStatusLabel")}</dt>
                  <dd>
                    <StatusBadge tone={program.state === "active" ? "success" : "neutral"}>
                      {p(`programState.${program.state}`)}
                    </StatusBadge>
                  </dd>
                </dl>
              ) : null}
            </div>
          </article>
          <StatCards
            stats={data?.stats ?? null}
            daysRatio={closedDaysRatio(programDays)}
            coursesRatio={completedCoursesRatio(programDays)}
          />
          <section className="page-section" aria-labelledby="program-courses">
            <h2 className="page-section__title" id="program-courses">
              {p("programCoursesTitle")}{" "}
              <span className="page-section__count">({courses.length})</span>
            </h2>
            {courses.length === 0 ? (
              <EmptyState title={p("programCoursesEmptyTitle")} message={p("programCoursesEmpty")} />
            ) : (
              <ul className="course-list">
                {courses.map((course) => (
                  <li className="card" key={course.id}>
                    <p className="card__title course-list__name" title={course.name}>
                      {course.name}
                    </p>
                    <div className="course-list__meta">
                      <span>{p("courseDays", { count: course.training_days_count })}</span>
                      <span>{p("courseClosedDays", { count: course.closed_days_count })}</span>
                      <span>{p("courseHours", { count: course.training_hours })}</span>
                    </div>
                    {course.training_days_count > 0 ? (
                      <ProgressBar
                        done={course.closed_days_count}
                        total={course.training_days_count}
                        label={course.name}
                        valueText={t("statRatioValue", {
                          done: course.closed_days_count,
                          total: course.training_days_count,
                        })}
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

export default function TraineeProgramPage() {
  return (
    <ProtectedRoute role="trainee">
      <TraineeProgramContent />
    </ProtectedRoute>
  );
}
