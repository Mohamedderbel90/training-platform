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
import { useId, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type {
  SurveyAnswerDto,
  SurveyDefinitionDto,
  SurveyQuestionDto,
} from "@/lib/api/types";
import type { ApiError } from "@/lib/api/client";
import { ApiErrorView } from "./ApiErrorView";

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
  const [confirming, setConfirming] = useState(false);
  const errorSummaryId = useId();

  const allQuestions = useMemo(
    () => definition.sections.flatMap((section) => section.questions),
    [definition],
  );

  const setAnswer = (questionId: number, patch: Partial<SurveyAnswerDto>) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], ...patch, question_id: questionId },
    }));
    setMissingIds((prev) => prev.filter((id) => id !== questionId));
  };

  const computeMissing = () =>
    allQuestions
      .filter(
        (question) => question.required && !isAnswered(question, answers[question.question_id]),
      )
      .map((question) => question.question_id);

  const handleSubmitClick = () => {
    const missing = computeMissing();
    if (missing.length > 0) {
      setMissingIds(missing);
      return;
    }
    setConfirming(true);
  };

  const confirmSubmit = async () => {
    setConfirming(false);
    await onSubmit(Object.values(answers));
  };

  const handleSaveDraft = async () => {
    if (onSaveDraft) {
      await onSaveDraft(Object.values(answers));
    }
  };

  return (
    <div>
      {apiError ? <ApiErrorView error={apiError} onRetry={onRetry} /> : null}

      {missingIds.length > 0 ? (
        <div className="error-summary" role="alert" id={errorSummaryId} tabIndex={-1}>
          <h2>{t("missingRequiredTitle")}</h2>
          <ul>
            {missingIds.map((id) => {
              const question = allQuestions.find((q) => q.question_id === id);
              return (
                <li key={id}>
                  <a href={`#question-${id}`}>{question?.title ?? id}</a>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {readOnly ? <p className="readonly-notice">{t("readOnlyNotice")}</p> : null}

      {definition.sections.map((section) => (
        <section key={section.id} aria-labelledby={`section-${section.id}`}>
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
        confirming ? (
          <div className="card" role="alertdialog" aria-label={t("confirmTitle")}>
            <p className="card__title">{t("confirmTitle")}</p>
            <p>{t("confirmMessage")}</p>
            <div className="button-row">
              <button type="button" className="button" onClick={confirmSubmit} disabled={busy}>
                {t("confirmYes")}
              </button>
              <button
                type="button"
                className="button button--secondary"
                onClick={() => setConfirming(false)}
                disabled={busy}
              >
                {t("confirmCancel")}
              </button>
            </div>
          </div>
        ) : (
          <div className="button-row">
            {onSaveDraft ? (
              <button
                type="button"
                className="button button--secondary"
                onClick={handleSaveDraft}
                disabled={busy}
              >
                {busy ? t("savingDraft") : t("saveDraft")}
              </button>
            ) : null}
            <button type="button" className="button" onClick={handleSubmitClick} disabled={busy}>
              {busy ? t("submitting") : t("submit")}
            </button>
          </div>
        )
      ) : null}
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
  const fieldId = `question-${question.question_id}`;
  const errorId = `${fieldId}-error`;

  return (
    <div className="field" data-invalid={invalid} id={fieldId}>
      <label htmlFor={`${fieldId}-input`}>
        {question.title}
        {question.required ? (
          <span className="required-marker" aria-hidden="true">
            *
          </span>
        ) : null}
        {question.required ? <span className="visually-hidden">{t("requiredLabel")}</span> : null}
      </label>

      <QuestionInput
        question={question}
        answer={answer}
        disabled={disabled}
        inputId={`${fieldId}-input`}
        describedBy={invalid ? errorId : undefined}
        onChange={onChange}
      />

      {invalid ? (
        <p className="field-error" id={errorId}>
          {t("questionRequiredError")}
        </p>
      ) : null}
    </div>
  );
}

function QuestionInput({
  question,
  answer,
  disabled,
  inputId,
  describedBy,
  onChange,
}: {
  question: SurveyQuestionDto;
  answer: SurveyAnswerDto | undefined;
  disabled: boolean;
  inputId: string;
  describedBy?: string;
  onChange: (patch: Partial<SurveyAnswerDto>) => void;
}) {
  switch (question.question_type) {
    case "simple_choice":
      return (
        <div className="option-list" role="radiogroup" aria-labelledby={inputId} aria-describedby={describedBy}>
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
        <div className="option-list" aria-describedby={describedBy}>
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
          disabled={disabled}
          aria-describedby={describedBy}
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
          value={answer?.text ?? ""}
          onChange={(event) => onChange({ text: event.target.value })}
        />
      );
  }
}
