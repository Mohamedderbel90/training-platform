"use client";

import { Suspense, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth/AuthContext";
import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";
import { useDashboardSummary } from "@/lib/dashboard/useDashboardSummary";
import { LoadingState, EmptyState, ListPageFallback } from "@/components/StateViews";
import { ApiErrorView } from "@/components/ApiErrorView";
import { AttendanceStatusGroup, SurveyStatusGroup } from "@/components/DayCard";
import { TrainingDaysViewActions } from "@/components/DayListToolbar";
import { PageHeader } from "@/components/PageHeader";
import { DaySummaryCards } from "@/components/dashboard/DaySummaryCards";
import { TrainingDaysBoard, useBackToTrainingDaysHref, withReturnTo } from "@/components/dashboard/TrainingDaysBoard";
import { dayGroupOf, dayNumbersByProgram, supervisorActionAvailabilityGroupOf } from "@/lib/dashboard/listControls";
import { useListControls } from "@/lib/dashboard/useListControls";

/** The full training-day list, unified with the trainee/trainer
 * Training Days pages behind the same toolbar/card/calendar board (see
 * components/dashboard/TrainingDaysBoard.tsx). Search / filter / sort /
 * pagination run client-side over the already-loaded days; the 3-way
 * actionability filter uses `supervisorActionAvailabilityGroupOf` since
 * a supervisor has two actions per day (attendance + evaluation survey)
 * rather than the single-action default. Header shape (subtitle +
 * `DaySummaryCards`) matches the trainee page's -- the approved Training
 * Days reference -- rather than the breadcrumb-and-icon-chip treatment
 * this page carried before the three role pages were unified behind
 * this shared board; see `TraineeDaysContent`'s own doc comment. */
function SupervisorDaysContent() {
  const t = useTranslations("Dashboard");
  const nav = useTranslations("Nav");
  const { profile } = useAuth();
  const { data, status, error, reload } = useDashboardSummary("supervisor");
  const days = useMemo(() => data?.days ?? [], [data]);
  const controls = useListControls(days, {
    kind: "survey",
    role: "supervisor",
    paginate: true,
    groupOf: supervisorActionAvailabilityGroupOf,
  });
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
              {t("daysIntroSupervisor")}
            </>
          ) : undefined
        }
        leadingActions={controls.showToolbar ? <TrainingDaysViewActions controls={controls} /> : undefined}
      />
      {days.length === 0 ? (
        <EmptyState title={t("emptyTitle")} message={t("emptySupervisorMessage")} />
      ) : (
        <>
          <DaySummaryCards total={summary.total} completed={summary.completed} upcoming={summary.upcoming} />
          <TrainingDaysBoard
            controls={controls}
            showAttendance
            timeZone={profile?.tz}
            dayNumbers={dayNumbers}
            renderActions={(entry) => (
              <>
                <AttendanceStatusGroup
                  attendance={entry.attendance}
                  dayStatus={entry.state}
                  href={withReturnTo(`/supervisor/${entry.training_day_id}/attendance`, backHref)}
                />
                <SurveyStatusGroup
                showSubmittedAt={false}
                  availability={entry.survey}
                  dayStatus={entry.state}
                  dateFields={entry}
                  timeZone={profile?.tz}
                  kind="evaluation"
                  href={withReturnTo(`/supervisor/${entry.training_day_id}/survey`, backHref)}
                />
              </>
            )}
          />
        </>
      )}
    </div>
  );
}

export default function SupervisorDaysPage() {
  return (
    <ProtectedRoute role="supervisor">
      <Suspense fallback={<ListPageFallback />}>
        <SupervisorDaysContent />
      </Suspense>
    </ProtectedRoute>
  );
}
