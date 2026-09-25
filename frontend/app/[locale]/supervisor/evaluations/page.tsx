"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";
import { useDashboardSummary } from "@/lib/dashboard/useDashboardSummary";
import { LoadingState, EmptyState } from "@/components/StateViews";
import { ApiErrorView } from "@/components/ApiErrorView";
import { DayCard, SurveyAvailabilityBadge } from "@/components/DayCard";
import { DaySection } from "@/components/DaySection";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ROLE_HOME } from "@/lib/auth/roleHome";
import type { DashboardEntryDto } from "@/lib/api/types";

/** Presentation grouping only: a day is "complete" when the backend's
 * own attendance.complete flag is set and the survey is submitted. */
function isComplete(day: DashboardEntryDto): boolean {
  return !!day.attendance?.complete && day.survey?.response?.state === "submitted";
}

function SupervisorEvaluationsContent() {
  const t = useTranslations("Dashboard");
  const p = useTranslations("Pages");
  const nav = useTranslations("Nav");
  const { data, status, error, reload } = useDashboardSummary("supervisor");

  const groups = useMemo(() => {
    const days = data?.days ?? [];
    return { pending: days.filter((d) => !isComplete(d)), done: days.filter(isComplete) };
  }, [data]);

  if (status === "loading") return <LoadingState label={t("loading")} />;
  if (status === "error" && error) return <ApiErrorView error={error} onRetry={reload} />;

  const renderCard = (entry: DashboardEntryDto) => (
    <DayCard key={entry.training_day_id} entry={entry}>
      <p className="card__meta card__meta--inline">
        {t("attendanceProgress", {
          recorded: entry.attendance?.recorded_count ?? 0,
          total: entry.attendance?.total_enrolled ?? 0,
        })}
        {entry.attendance?.complete ? (
          <span className="badge badge--success">{t("attendanceComplete")}</span>
        ) : null}
      </p>
      <div className="button-row button-row--tight">
        <Link
          className="button button--secondary"
          href={`/supervisor/${entry.training_day_id}/attendance`}
        >
          {t("manageAttendance")}
        </Link>
        <span aria-label={p("supervisorSurveyLabel")}>
          <SurveyAvailabilityBadge availability={entry.survey} />
        </span>
        <Link
          className="button button--secondary"
          href={`/supervisor/${entry.training_day_id}/survey`}
        >
          {entry.survey?.response?.state === "submitted" ? t("viewSurvey") : t("openSurvey")}
        </Link>
      </div>
    </DayCard>
  );

  const days = data?.days ?? [];
  return (
    <div>
      <Breadcrumbs homeHref={ROLE_HOME.supervisor} items={[{ label: nav("attendanceEvaluation") }]} />
      <PageHeader title={<h1>{p("evaluationsTitle")}</h1>} subtitle={p("evaluationsSubtitle")} />
      {days.length === 0 ? (
        <EmptyState title={t("emptyTitle")} message={t("emptySupervisorMessage")} />
      ) : (
        <>
          <DaySection title={p("evaluationsPending")} count={groups.pending.length}>
            {groups.pending.map(renderCard)}
          </DaySection>
          <DaySection title={p("evaluationsDone")} count={groups.done.length}>
            {groups.done.map(renderCard)}
          </DaySection>
        </>
      )}
    </div>
  );
}

export default function SupervisorEvaluationsPage() {
  return (
    <ProtectedRoute role="supervisor">
      <SupervisorEvaluationsContent />
    </ProtectedRoute>
  );
}
