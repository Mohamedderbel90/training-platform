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

function TraineeSurveysContent() {
  const t = useTranslations("Dashboard");
  const p = useTranslations("Pages");
  const nav = useTranslations("Nav");
  const { data, status, error, reload } = useDashboardSummary("trainee");

  const groups = useMemo(() => {
    const days = data?.days ?? [];
    const submitted = days.filter((d) => d.survey?.response?.state === "submitted");
    const available = days.filter(
      (d) => d.survey?.response?.state !== "submitted" && d.survey?.configured && d.survey.can_submit,
    );
    const unavailable = days.filter((d) => !submitted.includes(d) && !available.includes(d));
    return { submitted, available, unavailable };
  }, [data]);

  if (status === "loading") return <LoadingState label={t("loading")} />;
  if (status === "error" && error) return <ApiErrorView error={error} onRetry={reload} />;

  const days = data?.days ?? [];

  const renderCard = (entry: (typeof days)[number], action: string | null) => (
    <DayCard key={entry.training_day_id} entry={entry}>
      <SurveyAvailabilityBadge availability={entry.survey} />
      {action ? (
        <Link className="button button--secondary" href={`/trainee/${entry.training_day_id}`}>
          {action}
        </Link>
      ) : null}
    </DayCard>
  );

  return (
    <div>
      <Breadcrumbs homeHref={ROLE_HOME.trainee} items={[{ label: nav("mySurveys") }]} />
      <PageHeader title={<h1>{p("surveysTitle")}</h1>} subtitle={p("surveysSubtitle")} />
      {days.length === 0 ? (
        <EmptyState title={t("emptyTitle")} message={t("emptyTraineeMessage")} />
      ) : (
        <>
          <DaySection
            title={p("surveysAvailable")}
            count={groups.available.length}
            emptyMessage={p("surveysEmptyAvailable")}
          >
            {groups.available.map((e) => renderCard(e, t("openSurvey")))}
          </DaySection>
          <DaySection title={p("surveysSubmitted")} count={groups.submitted.length}>
            {groups.submitted.map((e) => renderCard(e, t("viewSurvey")))}
          </DaySection>
          <DaySection title={p("surveysUnavailable")} count={groups.unavailable.length}>
            {groups.unavailable.map((e) => renderCard(e, null))}
          </DaySection>
        </>
      )}
    </div>
  );
}

export default function TraineeSurveysPage() {
  return (
    <ProtectedRoute role="trainee">
      <TraineeSurveysContent />
    </ProtectedRoute>
  );
}
