"use client";

import { Suspense, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";
import { dashboardApi } from "@/lib/api/endpoints";
import { useApiResource } from "@/lib/api/useApiResource";
import { LoadingState, EmptyState, ListPageFallback } from "@/components/StateViews";
import { ApiErrorView } from "@/components/ApiErrorView";
import { DayCard, SurveyStatusGroup } from "@/components/DayCard";
import { DayListNoResults, DayListPagination, DayListToolbar } from "@/components/DayListToolbar";
import { PageHeader } from "@/components/PageHeader";
import { useListControls } from "@/lib/dashboard/useListControls";

/** The full training-day list, moved here (unchanged) from what used
 * to be the trainer's only page, so `/trainer` itself can become the
 * new Dashboard home (see components/dashboard). Search / filter / sort /
 * pagination run client-side over the already-loaded days. */
function TrainerDaysContent() {
  const t = useTranslations("Dashboard");
  const fetcher = useCallback((loc: string) => dashboardApi.get("trainer", loc), []);
  const { data, status, error, reload } = useApiResource(fetcher);
  const days = useMemo(() => data?.days ?? [], [data]);
  const controls = useListControls(days, { kind: "report", paginate: true });

  if (status === "loading") {
    return <LoadingState label={t("loading")} variant="skeleton" count={4} />;
  }
  if (status === "error" && error) {
    return <ApiErrorView error={error} onRetry={reload} />;
  }

  return (
    <div>
      <PageHeader title={<h1>{t("trainerTitle")}</h1>} />
      {days.length === 0 ? (
        <EmptyState title={t("emptyTitle")} message={t("emptyTrainerMessage")} />
      ) : (
        <>
          {controls.showToolbar ? <DayListToolbar controls={controls} /> : null}
          {controls.results.length === 0 ? (
            <DayListNoResults controls={controls} />
          ) : (
            <div className="card-list">
              {controls.visible.map((entry) => (
                <DayCard key={entry.training_day_id} entry={entry}>
                  <SurveyStatusGroup
                    kind="report"
                    availability={entry.trainer_report}
                    dayStatus={entry.state}
                    href={`/trainer/${entry.training_day_id}`}
                  />
                </DayCard>
              ))}
            </div>
          )}
          <DayListPagination controls={controls} />
        </>
      )}
    </div>
  );
}

export default function TrainerDaysPage() {
  return (
    <ProtectedRoute role="trainer">
      <Suspense fallback={<ListPageFallback />}>
        <TrainerDaysContent />
      </Suspense>
    </ProtectedRoute>
  );
}
