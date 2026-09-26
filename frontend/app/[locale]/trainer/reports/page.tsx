"use client";

import { Suspense, useMemo } from "react";
import { useTranslations } from "next-intl";
import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";
import { useDashboardSummary } from "@/lib/dashboard/useDashboardSummary";
import { LoadingState, EmptyState } from "@/components/StateViews";
import { ApiErrorView } from "@/components/ApiErrorView";
import { DayCard, SurveyStatusGroup } from "@/components/DayCard";
import { DaySection } from "@/components/DaySection";
import { PageHeader } from "@/components/PageHeader";
import { DayListNoResults, DayListToolbar } from "@/components/DayListToolbar";
import { useListControls } from "@/lib/dashboard/useListControls";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ROLE_HOME } from "@/lib/auth/roleHome";
import type { DashboardEntryDto } from "@/lib/api/types";

function TrainerReportsContent() {
  const t = useTranslations("Dashboard");
  const p = useTranslations("Pages");
  const nav = useTranslations("Nav");
  const { data, status, error, reload } = useDashboardSummary("trainer");

  const allDays = useMemo(() => data?.days ?? [], [data]);
  const controls = useListControls(allDays, { kind: "report" });

  const groups = useMemo(() => {
    const days = controls.results;
    const submitted = days.filter((d) => d.trainer_report?.response?.state === "submitted");
    const pending = days.filter(
      (d) => !submitted.includes(d) && d.trainer_report?.configured && d.trainer_report.can_submit,
    );
    const unavailable = days.filter((d) => !submitted.includes(d) && !pending.includes(d));
    return { submitted, pending, unavailable };
  }, [controls.results]);

  if (status === "loading") return <LoadingState label={t("loading")} variant="skeleton" count={4} />;
  if (status === "error" && error) return <ApiErrorView error={error} onRetry={reload} />;

  const renderCard = (entry: DashboardEntryDto) => (
    <DayCard key={entry.training_day_id} entry={entry}>
      <SurveyStatusGroup
        kind="report"
        availability={entry.trainer_report}
        dayStatus={entry.state}
        href={`/trainer/${entry.training_day_id}`}
      />
    </DayCard>
  );

  return (
    <div>
      <Breadcrumbs homeHref={ROLE_HOME.trainer} items={[{ label: nav("myReports") }]} />
      <PageHeader title={<h1>{p("reportsTitle")}</h1>} subtitle={p("reportsSubtitle")} />
      {allDays.length === 0 ? (
        <EmptyState title={t("emptyTitle")} message={t("emptyTrainerMessage")} />
      ) : (
        <>
          {controls.showToolbar ? <DayListToolbar controls={controls} /> : null}
          {controls.results.length === 0 ? <DayListNoResults controls={controls} /> : null}
          <DaySection title={p("reportsPending")} count={groups.pending.length}>
            {groups.pending.map(renderCard)}
          </DaySection>
          <DaySection title={p("reportsSubmitted")} count={groups.submitted.length}>
            {groups.submitted.map(renderCard)}
          </DaySection>
          <DaySection title={p("reportsUnavailable")} count={groups.unavailable.length}>
            {groups.unavailable.map(renderCard)}
          </DaySection>
        </>
      )}
    </div>
  );
}

export default function TrainerReportsPage() {
  return (
    <ProtectedRoute role="trainer">
      <Suspense fallback={null}>
        <TrainerReportsContent />
      </Suspense>
    </ProtectedRoute>
  );
}
