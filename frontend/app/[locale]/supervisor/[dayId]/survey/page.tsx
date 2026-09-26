"use client";

import { use, useCallback, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";
import { useAuth } from "@/lib/auth/AuthContext";
import { supervisorApi } from "@/lib/api/endpoints";
import { ApiError } from "@/lib/api/client";
import { useApiResource } from "@/lib/api/useApiResource";
import { LoadingState, EmptyState } from "@/components/StateViews";
import { ApiErrorView } from "@/components/ApiErrorView";
import { SurveyForm } from "@/components/SurveyForm";
import { PageHeader } from "@/components/PageHeader";
import { SubmittedState } from "@/components/SubmittedState";
import { useSurveyDefinition } from "@/lib/api/useSurveyDefinition";
import type { SurveyAnswerDto } from "@/lib/api/types";

/**
 * Mirrors TraineeSurveyContent's shape (M6): GET .../supervisor-survey/status
 * for availability/state, then GET .../supervisor-survey for the question
 * definition only once a submit is actually possible. Before M6 this page
 * had no dedicated status endpoint to call and instead re-fetched the whole
 * supervisor dashboard to look up its own day entry -- see
 * docs/adr/ADR-006-nextjs-operational-ui.md section 12 and
 * docs/adr/ADR-007-supervisor-survey-status-endpoint.md for why that
 * workaround was removed.
 */
export function SupervisorSurveyContent({ dayId }: { dayId: number }) {
  const t = useTranslations("Survey");
  const locale = useLocale();
  const { refresh } = useAuth();

  const statusFetcher = useCallback(
    (loc: string) => supervisorApi.getSurveyStatus(dayId, loc),
    [dayId],
  );
  const { data: availability, status, error, reload } = useApiResource(statusFetcher);

  const [submitBusy, setSubmitBusy] = useState(false);
  const [submitError, setSubmitError] = useState<ApiError | null>(null);
  const [justSubmitted, setJustSubmitted] = useState<string | null>(null);

  const alreadySubmitted = availability?.response?.state === "submitted";
  const needsDefinition = status === "success" && availability?.configured && !alreadySubmitted;

  const definitionFetcher = useCallback(
    (loc: string) => supervisorApi.getSurvey(dayId, loc),
    [dayId],
  );
  const { definition, error: definitionError, retry: retryDefinition } = useSurveyDefinition(
    definitionFetcher,
    Boolean(needsDefinition),
  );

  if (status === "loading") {
    return <LoadingState label={t("loadingSurvey")} variant="skeleton" count={2} />;
  }
  if (status === "error" && error) {
    return <ApiErrorView error={error} onRetry={reload} />;
  }
  if (!availability?.configured) {
    return <EmptyState title={t("notConfiguredTitle")} message={t("notConfiguredMessage")} />;
  }
  if (alreadySubmitted || justSubmitted) {
    return (
      <SubmittedState headingLevel={1} submittedAt={justSubmitted ?? availability?.response?.submitted_at} />
    );
  }
  if (!availability.can_submit) {
    return (
      <EmptyState
        title={t("unavailableTitle")}
        message={
          availability.reason === "not_configured"
            ? t("notConfiguredMessage")
            : (availability.reason ?? t("unavailableMessage"))
        }
      />
    );
  }
  if (definitionError) {
    return <ApiErrorView error={definitionError} onRetry={retryDefinition} />;
  }
  if (!definition) {
    return <LoadingState label={t("loadingSurvey")} variant="skeleton" count={2} />;
  }

  const handleSubmit = async (answers: SurveyAnswerDto[]) => {
    setSubmitBusy(true);
    setSubmitError(null);
    try {
      const result = await supervisorApi.submitSurvey(dayId, answers, locale);
      setJustSubmitted(result.submitted_at ?? new Date().toISOString());
    } catch (err) {
      if (err instanceof ApiError) {
        setSubmitError(err);
        if (err.code === "UNAUTHENTICATED") refresh();
      }
    } finally {
      setSubmitBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title={<h1>{definition.title}</h1>} />
      <SurveyForm
        definition={definition}
        readOnly={false}
        busy={submitBusy}
        apiError={submitError}
        onSubmit={handleSubmit}
      />
    </div>
  );
}

export default function SupervisorSurveyPage({
  params,
}: {
  params: Promise<{ dayId: string }>;
}) {
  const { dayId } = use(params);
  return (
    <ProtectedRoute role="supervisor">
      <SupervisorSurveyContent dayId={Number(dayId)} />
    </ProtectedRoute>
  );
}
