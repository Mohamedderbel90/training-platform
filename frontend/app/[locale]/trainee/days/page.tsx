"use client";

import { Suspense, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth/AuthContext";
import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";
import { useDashboardSummary } from "@/lib/dashboard/useDashboardSummary";
import { LoadingState, EmptyState, ListPageFallback } from "@/components/StateViews";
import { ApiErrorView } from "@/components/ApiErrorView";
import { SurveyStatusGroup } from "@/components/DayCard";
import { PageHeader } from "@/components/PageHeader";
import { TrainingDaysViewActions } from "@/components/DayListToolbar";
import { DaySummaryCards } from "@/components/dashboard/DaySummaryCards";
import { TrainingDaysBoard, useBackToTrainingDaysHref, withReturnTo } from "@/components/dashboard/TrainingDaysBoard";
import { dayGroupOf, dayNumbersByProgram } from "@/lib/dashboard/listControls";
import { useListControls } from "@/lib/dashboard/useListControls";

/** The full training-day list (M5 point 5), unified with the supervisor
 * and trainer Training Days pages behind the same toolbar/card/calendar
 * board (components/dashboard/TrainingDaysBoard.tsx): search / filter /
 * sort / pagination run client-side over the already-loaded days (see
 * useListControls). Visually matches the approved Training Days
 * reference: a summary-cards row, the shared toolbar, and restyled
 * DayCard entries -- everything sourced from the real dashboard
 * response, nothing hard-coded. */
function TraineeDaysContent() {
  const t = useTranslations("Dashboard");
  const nav = useTranslations("Nav");
  const { profile } = useAuth();
  const { data, status, error, reload } = useDashboardSummary("trainee");
  const days = useMemo(() => data?.days ?? [], [data]);
  const controls = useListControls(days, { kind: "survey", role: "trainee", paginate: true });
  const dayNumbers = useMemo(() => dayNumbersByProgram(days), [days]);
  const backHref = useBackToTrainingDaysHref();

  const summary = useMemo(() => {
    let completed = 0;
    let upcoming = 0;
    for (const day of days) {
      const group = dayGroupOf(day.state);
      if (group === "completed") completed += 1;
      else if (group === "upcoming") upcoming += 1;
    }
    return { total: days.length, completed, upcoming };
  }, [days]);

  if (status === "loading") {
    return <LoadingState label={t("loading")} variant="skeleton" count={4} />;
  }
  if (status === "error" && error) {
    return <ApiErrorView error={error} onRetry={reload} />;
  }

  return (
    <div className="training-days-page">
      <PageHeader
        title={<h1>{nav("trainingDays")}</h1>}
        subtitle={
          days.length > 0 ? (
            <>
              {t("daysSubtitleCount", { count: days.length })}
              <br />
              {t("daysIntroTrainee")}
            </>
          ) : undefined
        }
        leadingActions={controls.showToolbar ? <TrainingDaysViewActions controls={controls} /> : undefined}
      />
      {days.length === 0 ? (
        <EmptyState title={t("emptyTitle")} message={t("emptyTraineeMessage")} />
      ) : (
        <>
          <DaySummaryCards total={summary.total} completed={summary.completed} upcoming={summary.upcoming} />
          <TrainingDaysBoard
            controls={controls}
            timeZone={profile?.tz}
            dayNumbers={dayNumbers}
            renderActions={(entry) => (
              <SurveyStatusGroup
                showSubmittedAt={false}
                availability={entry.survey}
                dayStatus={entry.state}
                dateFields={entry}
                timeZone={profile?.tz}
                href={withReturnTo(`/trainee/${entry.training_day_id}`, backHref)}
              />
            )}
          />
        </>
      )}
    </div>
  );
}

export default function TraineeDaysPage() {
  return (
    <ProtectedRoute role="trainee">
      <Suspense fallback={<ListPageFallback />}>
        <TraineeDaysContent />
      </Suspense>
    </ProtectedRoute>
  );
}
