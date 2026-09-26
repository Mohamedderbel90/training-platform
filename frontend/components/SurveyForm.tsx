"use client";

/**
 * Shared, fully dynamic survey renderer used by the trainee, supervisor,
 * and trainer flows (M5 points 4/5/6/8). The set of sections/questions
 * is unknown at compile time -- it comes entirely from the API's
 * SurveyDefinitionDto -- so this is a small hand-rolled controlled-form
 * component rather than a schema-driven library like React Hook Form +
 * Zod: there is no static schema to validate against, only "is this
 * required question answered," which this component checks directly.
 * See docs/adr/ADR-006-nextjs-operational-ui.md for why this approach
 * was chosen over adding a form library for a single dynamic-form need.
 *
 * Client-side required-question checking is UX only (M5 point 8): it
 * stops an obviously-incomplete submit before a round trip, but the
 * server's own mandatory-answer check (ADR-003) remains authoritative,
 * and any server VALIDATION_ERROR is always surfaced via `apiError`.
 */
import { useEffect, useId, useMemo, useRef, useState, type MouseEvent } from "react";
import { useTranslations } from "next-intl";
import type {
  SurveyAnswerDto,
  SurveyDefinitionDto,
  SurveyQuestionDto,
} from "@/lib/api/types";
import type { ApiError } from "@/lib/api/client";
import { ConfirmDialog } from "./ConfirmDialog";
import { FormError } from "./FormError";
import { FormField } from "./FormField";
import { LockIcon } from "./icons";
import { ProgressBar } from "./ProgressBar";
import { SubmitButton } from "./SubmitButton";

type AnswerMap = Record<number, SurveyAnswerDto>;

function toAnswerMap(answers: SurveyAnswerDto[] | null | undefined): AnswerMap {
  const map: AnswerMap = {};
  for (const answer of answers ?? []) {
    map[answer.question_id] = answer;
  }
  return map;
}

function isAnswered(question: SurveyQuestionDto, answer: SurveyAnswerDto | undefined): boolean {
  if (!answer) return false;
  switch (question.question_type) {
    case "simple_choice":
      return answer.answer_option_id !== undefined;
    case "multiple_choice":
      return Boolean(answer.answer_option_ids && answer.answer_option_ids.length > 0);
    case "char_box":
    case "text_box":
      return Boolean(answer.text && answer.text.trim().length > 0);
    case "numerical_box":
    case "scale":
      return answer.value !== undefined;
    default:
      return false;
  }
}

interface SurveyFormProps {
  definition: SurveyDefinitionDto;
  initialAnswers?: SurveyAnswerDto[] | null;
  readOnly: boolean;
  busy?: boolean;
  apiError?: ApiError | null;
  onRetry?: () => void;
  onSubmit: (answers: SurveyAnswerDto[]) => Promise<void> | void;
  onSaveDraft?: (answers: SurveyAnswerDto[]) => Promise<void> | void;
}

export function SurveyForm({
  definition,
  initialAnswers,
  readOnly,
  busy,
  apiError,
  onRetry,
  onSubmit,
  onSaveDraft,
}: SurveyFormProps) {
  const t = useTranslations("Survey");
  const [answers, setAnswers] = useState<AnswerMap>(() => toAnswerMap(initialAnswers));
  const [missingIds, setMissingIds] = useState<number[]>([]);
  // Counts blocked submit attempts so focus returns to the summary
  // every time, not just the first.
  const [blockedAttempts, setBlockedAttempts] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState<"draft" | "submit" | null>(null);
  const errorSummaryId = useId();
  const summaryRef = useRef<HTMLDivElement>(null);

  // Move focus to the error summary when a submit attempt is blocked,
  // so keyboard/screen-reader users land on the list of problems.
  useEffect(() => {
    if (blockedAttempts > 0) summaryRef.current?.focus();
  }, [blockedAttempts]);

  const allQuestions = useMemo(
    () => definition.sections.flatMap((section) => section.questions),
    [definition],
  );
  const requiredQuestions = useMemo(
    () => allQuestions.filter((question) => question.required),
    [allQuestions],
  );
  // Progress is derived from local answers only (UX aid, never sent).
  const answeredRequired = requiredQuestions.filter((question) =>
    isAnswered(question, answers[question.question_id]),
  ).length;

  const setAnswer = (questionId: number, patch: Partial<SurveyAnswerDto>) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], ...patch, question_id: questionId },
    }));
    setMissingIds((prev) => prev.filter((id) => id !== questionId));
  };

  const computeMissing = () =>
    requiredQuestions
      .filter((question) => !isAnswered(question, answers[question.question_id]))
      .map((question) => question.question_id);

  const handleSubmitClick = () => {
    const missing = computeMissing();
    if (missing.length > 0) {
      setMissingIds(missing);
      setBlockedAttempts((n) => n + 1);
      return;
    }
    setConfirming(true);
  };

  const confirmSubmit = async () => {
    setConfirming(false);
    setPending("submit");
    try {
      await onSubmit(Object.values(answers));
    } finally {
      setPending(null);
    }
  };

  const handleSaveDraft = async () => {
    if (!onSaveDraft) return;
    setPending("draft");
    try {
      await onSaveDraft(Object.values(answers));
    } finally {
      setPending(null);
    }
  };

  // Summary links jump to the question's first control (the bare
  // #hash target is a non-focusable wrapper).
  const focusQuestion = (event: MouseEvent<HTMLAnchorElement>, id: number) => {
    event.preventDefault();
    const wrapper = document.getElementById(`question-${id}`);
    wrapper?.scrollIntoView?.({ block: "center" });
    wrapper?.querySelector<HTMLElement>("input, textarea, select")?.focus({ preventScroll: true });
  };

  return (
    <div className={readOnly ? "survey-form survey-form--readonly" : "survey-form"}>
      <FormError error={apiError ?? null} onRetry={onRetry} />

      {!readOnly && requiredQuestions.length > 0 ? (
        <div className="survey-progress">
          <p className="survey-progress__text">
            {t("answeredProgress", { done: answeredRequired, total: requiredQuestions.length })}
          </p>
          <ProgressBar
            done={answeredRequired}
            total={requiredQuestions.length}
            label={t("progressLabel")}
            valueText={t("answeredProgress", {
              done: answeredRequired,
              total: requiredQuestions.length,
            })}
          />
          <p className="field-hint">{t("requiredLegend")}</p>
        </div>
      ) : null}

      {missingIds.length > 0 ? (
        <div className="error-summary" role="alert" id={errorSummaryId} tabIndex={-1} ref={summaryRef}>
          <h2>{t("missingRequiredTitle")}</h2>
          <ul>
            {missingIds.map((id) => {
              const question = allQuestions.find((q) => q.question_id === id);
              return (
                <li key={id}>
                  <a href={`#question-${id}`} onClick={(event) => focusQuestion(event, id)}>
                    {question?.title ?? id}
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {readOnly ? (
        <p className="readonly-notice">
          <LockIcon aria-hidden="true" />
          {t("readOnlyNotice")}
        </p>
      ) : null}

      {definition.sections.map((section) => (
        <section
          key={section.id}
          className="survey-section"
          aria-labelledby={section.title ? `section-${section.id}` : undefined}
        >
          {section.title ? (
            <h2 id={`section-${section.id}`} className="section-title">
              {section.title}
            </h2>
          ) : null}
          {section.questions.map((question) => (
            <QuestionField
              key={question.question_id}
              question={question}
              answer={answers[question.question_id]}
              invalid={missingIds.includes(question.question_id)}
              disabled={readOnly || Boolean(busy)}
              onChange={(patch) => setAnswer(question.question_id, patch)}
            />
          ))}
        </section>
      ))}

      {!readOnly ? (
        <div className="button-row survey-actions">
          {onSaveDraft ? (
            <SubmitButton
              type="button"
              className="button button--secondary"
              loading={Boolean(busy) && pending === "draft"}
              loadingLabel={t("savingDraft")}
              disabled={busy}
              onClick={handleSaveDraft}
            >
              {t("saveDraft")}
            </SubmitButton>
          ) : null}
          <SubmitButton
            type="button"
            loading={Boolean(busy) && pending === "submit"}
            loadingLabel={t("submitting")}
            disabled={busy}
            onClick={handleSubmitClick}
          >
            {t("submit")}
          </SubmitButton>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirming}
        title={t("confirmTitle")}
        message={t("confirmMessage")}
        confirmLabel={t("confirmYes")}
        cancelLabel={t("confirmCancel")}
        busy={busy}
        onConfirm={confirmSubmit}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}

function QuestionField({
  question,
  answer,
  invalid,
  disabled,
  onChange,
}: {
  question: SurveyQuestionDto;
  answer: SurveyAnswerDto | undefined;
  invalid: boolean;
  disabled: boolean;
  onChange: (patch: Partial<SurveyAnswerDto>) => void;
}) {
  const t = useTranslations("Survey");
  // Choice questions are a group of inputs, not one labelable control.
  const isGroup =
    question.question_type === "simple_choice" || question.question_type === "multiple_choice";

  return (
    <FormField
      id={`question-${question.question_id}-input`}
      wrapperId={`question-${question.question_id}`}
      label={question.title}
      required={question.required}
      group={isGroup}
      error={invalid ? t("questionRequiredError") : null}
    >
      {(control) => (
        <QuestionInput
          question={question}
          answer={answer}
          disabled={disabled}
          inputId={control.id}
          labelId={control.labelId}
          describedBy={control["aria-describedby"]}
          invalid={invalid}
          onChange={onChange}
        />
      )}
    </FormField>
  );
}

function QuestionInput({
  question,
  answer,
  disabled,
  inputId,
  labelId,
  describedBy,
  invalid,
  onChange,
}: {
  question: SurveyQuestionDto;
  answer: SurveyAnswerDto | undefined;
  disabled: boolean;
  inputId: string;
  labelId: string;
  describedBy?: string;
  invalid: boolean;
  onChange: (patch: Partial<SurveyAnswerDto>) => void;
}) {
  switch (question.question_type) {
    case "simple_choice":
      return (
        <div className="option-list" role="radiogroup" aria-labelledby={labelId} aria-describedby={describedBy}>
          {(question.options ?? []).map((option) => (
            <label className="option-item" key={option.id} htmlFor={`${inputId}-${option.id}`}>
              <input
                id={`${inputId}-${option.id}`}
                type="radio"
                name={inputId}
                disabled={disabled}
                checked={answer?.answer_option_id === option.id}
                onChange={() => onChange({ answer_option_id: option.id })}
              />
              {option.label}
            </label>
          ))}
        </div>
      );
    case "multiple_choice": {
      const selected = new Set(answer?.answer_option_ids ?? []);
      return (
        <div className="option-list" role="group" aria-labelledby={labelId} aria-describedby={describedBy}>
          {(question.options ?? []).map((option) => (
            <label className="option-item" key={option.id} htmlFor={`${inputId}-${option.id}`}>
              <input
                id={`${inputId}-${option.id}`}
                type="checkbox"
                disabled={disabled}
                checked={selected.has(option.id)}
                onChange={(event) => {
                  const next = new Set(selected);
                  if (event.target.checked) {
                    next.add(option.id);
                  } else {
                    next.delete(option.id);
                  }
                  onChange({ answer_option_ids: Array.from(next) });
                }}
              />
              {option.label}
            </label>
          ))}
        </div>
      );
    }
    case "text_box":
      return (
        <textarea
          id={inputId}
          disabled={disabled}
          aria-describedby={describedBy}
          aria-invalid={invalid ? true : undefined}
          value={answer?.text ?? ""}
          onChange={(event) => onChange({ text: event.target.value })}
        />
      );
    case "numerical_box":
    case "scale":
      return (
        <input
          id={inputId}
          type="number"
          step={question.question_type === "scale" ? 1 : "any"}
          min={question.question_type === "scale" ? (question.scale_min ?? undefined) : undefined}
          max={question.question_type === "scale" ? (question.scale_max ?? undefined) : undefined}
          inputMode={question.question_type === "scale" ? "numeric" : "decimal"}
          disabled={disabled}
          aria-describedby={describedBy}
          aria-invalid={invalid ? true : undefined}
          value={answer?.value ?? ""}
          onChange={(event) =>
            onChange({ value: event.target.value === "" ? undefined : Number(event.target.value) })
          }
        />
      );
    case "char_box":
    default:
      return (
        <input
          id={inputId}
          type="text"
          disabled={disabled}
          aria-describedby={describedBy}
          aria-invalid={invalid ? true : undefined}
          value={answer?.text ?? ""}
          onChange={(event) => onChange({ text: event.target.value })}
        />
      );
  }
}
