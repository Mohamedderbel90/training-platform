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

function SupervisorDashboardContent() {
  const t = useTranslations("Dashboard");
  const fetcher = useCallback((loc: string) => dashboardApi.get("supervisor", loc), []);
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
      <PageHeader title={<h1>{t("supervisorTitle")}</h1>} />
      {days.length === 0 ? (
        <EmptyState title={t("emptyTitle")} message={t("emptySupervisorMessage")} />
      ) : (
        <div className="card-list">
          {days.map((entry) => (
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
                <span>
                  <SurveyAvailabilityBadge availability={entry.survey} />
                </span>
                <Link
                  className="button button--secondary"
                  href={`/supervisor/${entry.training_day_id}/survey`}
                >
                  {entry.survey?.response?.state === "submitted"
                    ? t("viewSurvey")
                    : t("openSurvey")}
                </Link>
              </div>
            </DayCard>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SupervisorDashboardPage() {
  return (
    <ProtectedRoute role="supervisor">
      <SupervisorDashboardContent />
    </ProtectedRoute>
  );
}
