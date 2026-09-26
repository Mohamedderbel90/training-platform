"use client";

import { Suspense, useMemo } from "react";
import { useTranslations } from "next-intl";
import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";
import { useDashboardSummary } from "@/lib/dashboard/useDashboardSummary";
import { LoadingState, EmptyState, ListPageFallback } from "@/components/StateViews";
import { ApiErrorView } from "@/components/ApiErrorView";
import { DayCard, SurveyStatusGroup } from "@/components/DayCard";
import { DaySection } from "@/components/DaySection";
import { PageHeader } from "@/components/PageHeader";
import { DayListNoResults, DayListToolbar } from "@/components/DayListToolbar";
import { useListControls } from "@/lib/dashboard/useListControls";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ROLE_HOME } from "@/lib/auth/roleHome";

function TraineeSurveysContent() {
  const t = useTranslations("Dashboard");
  const p = useTranslations("Pages");
  const nav = useTranslations("Nav");
  const { data, status, error, reload } = useDashboardSummary("trainee");

  const allDays = useMemo(() => data?.days ?? [], [data]);
  const controls = useListControls(allDays, { kind: "survey" });

  const groups = useMemo(() => {
    const days = controls.results;
    const submitted = days.filter((d) => d.survey?.response?.state === "submitted");
    const available = days.filter(
      (d) => d.survey?.response?.state !== "submitted" && d.survey?.configured && d.survey.can_submit,
    );
    const unavailable = days.filter((d) => !submitted.includes(d) && !available.includes(d));
    return { submitted, available, unavailable };
  }, [controls.results]);

  if (status === "loading") return <LoadingState label={t("loading")} variant="skeleton" count={4} />;
  if (status === "error" && error) return <ApiErrorView error={error} onRetry={reload} />;

  const renderCard = (entry: (typeof allDays)[number]) => (
    <DayCard key={entry.training_day_id} entry={entry}>
      <SurveyStatusGroup
        availability={entry.survey}
        dayStatus={entry.state}
        href={`/trainee/${entry.training_day_id}`}
      />
    </DayCard>
  );

  return (
    <div>
      <Breadcrumbs homeHref={ROLE_HOME.trainee} items={[{ label: nav("mySurveys") }]} />
      <PageHeader title={<h1>{p("surveysTitle")}</h1>} subtitle={p("surveysSubtitle")} />
      {allDays.length === 0 ? (
        <EmptyState title={t("emptyTitle")} message={t("emptyTraineeMessage")} />
      ) : (
        <>
          {controls.showToolbar ? <DayListToolbar controls={controls} /> : null}
          {controls.results.length === 0 ? <DayListNoResults controls={controls} /> : null}
          <DaySection
            title={p("surveysAvailable")}
            count={groups.available.length}
            emptyMessage={controls.results.length === 0 || controls.activeCount > 0 ? undefined : p("surveysEmptyAvailable")}
          >
            {groups.available.map(renderCard)}
          </DaySection>
          <DaySection title={p("surveysSubmitted")} count={groups.submitted.length}>
            {groups.submitted.map(renderCard)}
          </DaySection>
          <DaySection title={p("surveysUnavailable")} count={groups.unavailable.length}>
            {groups.unavailable.map(renderCard)}
          </DaySection>
        </>
      )}
    </div>
  );
}

export default function TraineeSurveysPage() {
  return (
    <ProtectedRoute role="trainee">
      <Suspense fallback={<ListPageFallback />}>
        <TraineeSurveysContent />
      </Suspense>
    </ProtectedRoute>
  );
}
