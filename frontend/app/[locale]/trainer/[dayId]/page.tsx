"use client";

import { use, useCallback, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";
import { useAuth } from "@/lib/auth/AuthContext";
import { trainerApi } from "@/lib/api/endpoints";
import { ApiError } from "@/lib/api/client";
import { useApiResource } from "@/lib/api/useApiResource";
import { LoadingState, EmptyState } from "@/components/StateViews";
import { ApiErrorView } from "@/components/ApiErrorView";
import { SurveyForm } from "@/components/SurveyForm";
import { PageHeader } from "@/components/PageHeader";
import { CheckIcon } from "@/components/icons";
import type { SurveyAnswerDto } from "@/lib/api/types";

export function TrainerReportContent({ dayId }: { dayId: number }) {
  const t = useTranslations("Survey");
  const locale = useLocale();
  const { refresh } = useAuth();

  const fetcher = useCallback((loc: string) => trainerApi.getReport(dayId, loc), [dayId]);
  const { data, status, error, reload } = useApiResource(fetcher);

  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<ApiError | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);

  if (status === "loading") {
    return <LoadingState label={t("loadingSurvey")} />;
  }
  if (status === "error" && error) {
    return <ApiErrorView error={error} onRetry={reload} />;
  }
  if (!data?.status.configured || !data.definition) {
    return <EmptyState title={t("notConfiguredTitle")} message={t("notConfiguredMessage")} />;
  }

  const submitted = data.status.response?.state === "submitted";

  const handleSaveDraft = async (answers: SurveyAnswerDto[]) => {
    setBusy(true);
    setActionError(null);
    setDraftSavedAt(null);
    try {
      await trainerApi.saveDraft(dayId, answers, locale);
      setDraftSavedAt(Date.now());
    } catch (err) {
      if (err instanceof ApiError) {
        setActionError(err);
        if (err.code === "UNAUTHENTICATED") refresh();
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async (answers: SurveyAnswerDto[]) => {
    setBusy(true);
    setActionError(null);
    try {
      await trainerApi.submitReport(dayId, answers, locale);
      await reload();
    } catch (err) {
      if (err instanceof ApiError) {
        setActionError(err);
        if (err.code === "UNAUTHENTICATED") refresh();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title={<h1>{data.definition.title}</h1>} />
      {submitted ? (
        <div className="state-view state-view--success">
          <span className="state-view__icon">
            <CheckIcon />
          </span>
          <p className="state-view__title">{t("submittedTitle")}</p>
          <p className="state-view__message">{t("submittedMessage")}</p>
        </div>
      ) : null}
      {draftSavedAt && !submitted ? (
        <p className="badge badge--success" role="status">
          {t("draftSaved")}
        </p>
      ) : null}
      <SurveyForm
        definition={data.definition}
        initialAnswers={data.answers}
        readOnly={submitted}
        busy={busy}
        apiError={actionError}
        onSubmit={handleSubmit}
        onSaveDraft={submitted ? undefined : handleSaveDraft}
      />
    </div>
  );
}

export default function TrainerReportPage({
  params,
}: {
  params: Promise<{ dayId: string }>;
}) {
  const { dayId } = use(params);
  return (
    <ProtectedRoute role="trainer">
      <TrainerReportContent dayId={Number(dayId)} />
    </ProtectedRoute>
  );
}
