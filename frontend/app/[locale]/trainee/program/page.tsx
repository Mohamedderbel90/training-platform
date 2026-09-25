"use client";

import { useLocale, useTranslations } from "next-intl";
import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";
import { useDashboardSummary } from "@/lib/dashboard/useDashboardSummary";
import { formatProgramRange } from "@/lib/dashboard/format";
import { LoadingState, EmptyState } from "@/components/StateViews";
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

  if (status === "loading") return <LoadingState label={t("loading")} />;
  if (status === "error" && error) return <ApiErrorView error={error} onRetry={reload} />;

  const program = data?.program ?? null;
  const courses = [...(program?.courses ?? [])].sort((a, b) => a.sequence - b.sequence);

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
                <span className="badge">{p(`programState.${program.state}`)}</span>
              ) : null}
            </div>
          </article>
          <StatCards stats={data?.stats ?? null} />
          <section className="page-section" aria-labelledby="program-courses">
            <h2 className="page-section__title" id="program-courses">
              {p("programCoursesTitle")}{" "}
              <span className="page-section__count">({courses.length})</span>
            </h2>
            {courses.length === 0 ? (
              <p className="card__meta">{p("programCoursesEmpty")}</p>
            ) : (
              <ul className="course-list">
                {courses.map((course) => (
                  <li className="card" key={course.id}>
                    <p className="card__title">{course.name}</p>
                    <div className="course-list__meta">
                      <span>{p("courseDays", { count: course.training_days_count })}</span>
                      <span>{p("courseClosedDays", { count: course.closed_days_count })}</span>
                      <span>{p("courseHours", { count: course.training_hours })}</span>
                    </div>
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
