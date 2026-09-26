"use client";

import { Suspense, useMemo } from "react";
import { useTranslations } from "next-intl";
import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";
import { useDashboardSummary } from "@/lib/dashboard/useDashboardSummary";
import { LoadingState, EmptyState, ListPageFallback } from "@/components/StateViews";
import { ApiErrorView } from "@/components/ApiErrorView";
import { DayCard, AttendanceStatusGroup, SurveyStatusGroup } from "@/components/DayCard";
import { DaySection } from "@/components/DaySection";
import { PageHeader } from "@/components/PageHeader";
import { DayListNoResults, DayListToolbar } from "@/components/DayListToolbar";
import { useListControls } from "@/lib/dashboard/useListControls";
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

  const allDays = useMemo(() => data?.days ?? [], [data]);
  const controls = useListControls(allDays, { kind: "survey" });

  const groups = useMemo(() => {
    const days = controls.results;
    return { pending: days.filter((d) => !isComplete(d)), done: days.filter(isComplete) };
  }, [controls.results]);

  if (status === "loading") return <LoadingState label={t("loading")} variant="skeleton" count={4} />;
  if (status === "error" && error) return <ApiErrorView error={error} onRetry={reload} />;

  const renderCard = (entry: DashboardEntryDto) => (
    <DayCard key={entry.training_day_id} entry={entry}>
      <AttendanceStatusGroup
        attendance={entry.attendance}
        href={`/supervisor/${entry.training_day_id}/attendance`}
      />
      <SurveyStatusGroup
        availability={entry.survey}
        dayStatus={entry.state}
        href={`/supervisor/${entry.training_day_id}/survey`}
      />
    </DayCard>
  );

  return (
    <div>
      <Breadcrumbs homeHref={ROLE_HOME.supervisor} items={[{ label: nav("attendanceEvaluation") }]} />
      <PageHeader title={<h1>{p("evaluationsTitle")}</h1>} subtitle={p("evaluationsSubtitle")} />
      {allDays.length === 0 ? (
        <EmptyState title={t("emptyTitle")} message={t("emptySupervisorMessage")} />
      ) : (
        <>
          {controls.showToolbar ? <DayListToolbar controls={controls} showAttendance /> : null}
          {controls.results.length === 0 ? <DayListNoResults controls={controls} /> : null}
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
      <Suspense fallback={<ListPageFallback />}>
        <SupervisorEvaluationsContent />
      </Suspense>
    </ProtectedRoute>
  );
}
