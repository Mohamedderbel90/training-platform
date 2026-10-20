"use client";

import { use, useCallback, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";
import { useAuth } from "@/lib/auth/AuthContext";
import { traineeApi } from "@/lib/api/endpoints";
import { ApiError } from "@/lib/api/client";
import { useApiResource } from "@/lib/api/useApiResource";
import { LoadingState, EmptyState } from "@/components/StateViews";
import { ApiErrorView } from "@/components/ApiErrorView";
import { SurveyForm } from "@/components/SurveyForm";
import { PageHeader } from "@/components/PageHeader";
import { SubmittedState } from "@/components/SubmittedState";
import { DayContextHeader } from "@/components/dashboard/DayContextHeader";
import { useSurveyDefinition } from "@/lib/api/useSurveyDefinition";
import { useSubmittedResponse } from "@/lib/api/useSubmittedResponse";
import { formatDateTime } from "@/lib/dashboard/format";
import type { SurveyAnswerDto } from "@/lib/api/types";

export function TraineeSurveyContent({ dayId }: { dayId: number }) {
  const t = useTranslations("Survey");
  const locale = useLocale();
  const { refresh, profile } = useAuth();

  const statusFetcher = useCallback(
    (loc: string) => traineeApi.getSurveyStatus(dayId, loc),
    [dayId],
  );
  const { data: availability, status, error, reload } = useApiResource(statusFetcher);

  const [submitBusy, setSubmitBusy] = useState(false);
  const [submitError, setSubmitError] = useState<ApiError | null>(null);
  const [justSubmitted, setJustSubmitted] = useState<string | null>(null);

  const alreadySubmitted = availability?.response?.state === "submitted";
  const needsDefinition = status === "success" && availability?.configured && !alreadySubmitted;

  const definitionFetcher = useCallback(
    (loc: string) => traineeApi.getSurvey(dayId, loc),
    [dayId],
  );
  const { definition, error: definitionError, retry: retryDefinition } = useSurveyDefinition(
    definitionFetcher,
    Boolean(needsDefinition),
  );

  const responseFetcher = useCallback(
    (loc: string) => traineeApi.getMyResponse(dayId, loc),
    [dayId],
  );
  const {
    response: submittedResponse,
    error: responseError,
    retry: retryResponse,
  } = useSubmittedResponse(responseFetcher, Boolean(alreadySubmitted && !justSubmitted));

  const context = <DayContextHeader role="trainee" dayId={dayId} trainingDaysHref="/trainee/days" />;

  if (status === "loading") {
    return (
      <div>
        {context}
        <LoadingState label={t("loadingSurvey")} variant="skeleton" count={2} />
      </div>
    );
  }
  if (status === "error" && error) {
    return (
      <div>
        {context}
        <ApiErrorView headingLevel={1} error={error} onRetry={reload} />
      </div>
    );
  }
  if (!availability?.configured) {
    return (
      <div>
        {context}
        <EmptyState headingLevel={1} title={t("notConfiguredTitle")} message={t("notConfiguredMessage")} />
      </div>
    );
  }
  if (justSubmitted) {
    return (
      <div>
        {context}
        <SubmittedState headingLevel={1} submittedAt={justSubmitted} />
      </div>
    );
  }
  if (alreadySubmitted) {
    // "View Survey": the trainee's own saved answers, read-only (OPD-01).
    // SurveyForm in readOnly mode disables every input and renders no
    // save/submit actions; `onSubmit` is never reachable.
    if (responseError) {
      return (
        <div>
          {context}
          <ApiErrorView headingLevel={1} error={responseError} onRetry={retryResponse} />
        </div>
      );
    }
    if (!submittedResponse) {
      return (
        <div>
          {context}
          <LoadingState label={t("loadingSurvey")} variant="skeleton" count={2} />
        </div>
      );
    }
    const submittedAt = submittedResponse.status.submitted_at;
    return (
      <div>
        {context}
        <PageHeader
          title={<h1>{submittedResponse.definition.title}</h1>}
          subtitle={
            submittedAt
              ? t("submittedAt", { date: formatDateTime(submittedAt, locale, profile?.tz) })
              : undefined
          }
        />
        <SurveyForm
          definition={submittedResponse.definition}
          initialAnswers={submittedResponse.answers}
          readOnly
          onSubmit={() => undefined}
        />
      </div>
    );
  }
  if (!availability.can_submit) {
    return (
      <div>
        {context}
        <EmptyState
          headingLevel={1}
          title={t("unavailableTitle")}
          message={
            availability.reason === "not_configured"
              ? t("notConfiguredMessage")
              : (availability.reason ?? t("unavailableMessage"))
          }
        />
      </div>
    );
  }
  if (definitionError) {
    return (
      <div>
        {context}
        <ApiErrorView headingLevel={1} error={definitionError} onRetry={retryDefinition} />
      </div>
    );
  }
  if (!definition) {
    return (
      <div>
        {context}
        <LoadingState label={t("loadingSurvey")} variant="skeleton" count={2} />
      </div>
    );
  }

  const handleSubmit = async (answers: SurveyAnswerDto[]) => {
    setSubmitBusy(true);
    setSubmitError(null);
    try {
      const result = await traineeApi.submitSurvey(dayId, answers, locale);
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
      {context}
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

export default function TraineeSurveyPage({
  params,
}: {
  params: Promise<{ dayId: string }>;
}) {
  const { dayId } = use(params);
  return (
    <ProtectedRoute role="trainee">
      <TraineeSurveyContent dayId={Number(dayId)} />
    </ProtectedRoute>
  );
}
