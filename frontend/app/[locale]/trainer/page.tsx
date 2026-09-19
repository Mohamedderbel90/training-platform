"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";
import { dashboardApi } from "@/lib/api/endpoints";
import { useApiResource } from "@/lib/api/useApiResource";
import { LoadingState, EmptyState } from "@/components/StateViews";
import { ApiErrorView } from "@/components/ApiErrorView";
import { DayCard, SurveyAvailabilityBadge } from "@/components/DayCard";
import { PageHeader } from "@/components/PageHeader";

function TrainerDashboardContent() {
  const t = useTranslations("Dashboard");
  const fetcher = useCallback((loc: string) => dashboardApi.get("trainer", loc), []);
  const { data, status, error, reload } = useApiResource(fetcher);

  if (status === "loading") {
    return <LoadingState label={t("loading")} />;
  }
  if (status === "error" && error) {
    return <ApiErrorView error={error} onRetry={reload} />;
  }
  const days = data?.days ?? [];

  return (
    <div>
      <PageHeader title={<h1>{t("trainerTitle")}</h1>} />
      {days.length === 0 ? (
        <EmptyState title={t("emptyTitle")} message={t("emptyTrainerMessage")} />
      ) : (
        <div className="card-list">
          {days.map((entry) => (
            <DayCard key={entry.training_day_id} entry={entry}>
              <SurveyAvailabilityBadge availability={entry.trainer_report} />
              <Link className="button button--secondary" href={`/trainer/${entry.training_day_id}`}>
                {entry.trainer_report?.response?.state === "submitted"
                  ? t("viewReport")
                  : t("openReport")}
              </Link>
            </DayCard>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TrainerDashboardPage() {
  return (
    <ProtectedRoute role="trainer">
      <TrainerDashboardContent />
    </ProtectedRoute>
  );
}
