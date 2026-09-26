"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { AlertIcon } from "@/components/icons";

/** Props a control must spread on its input so the label, helper text
 * and inline error are wired up for assistive tech. */
export interface FieldControlProps {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
  required?: boolean;
}

/** Inline field error: icon + text (never colour-only), linked to its
 * control by `id` via aria-describedby. Fades in briefly; the fade is
 * disabled under reduced motion. */
export function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p className="field-error" id={id}>
      <AlertIcon className="field-error__icon" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

/** Shared field anatomy: label, required marker (with visually-hidden
 * text), helper text and inline error. Two layouts:
 *  - default: stacked label + control (survey questions, plain forms);
 *  - `icon`: the approved auth-screen "field card" (leading icon,
 *    label above value, optional trailing control such as the
 *    show/hide-password toggle). Auth cards keep the approved look,
 *    so they omit the visible "*" and rely on `required`.
 * Validation is UX-only; the server stays authoritative. */
export function FormField({
  id,
  label,
  required = false,
  hint,
  error,
  icon,
  trailing,
  group = false,
  wrapperId,
  dir,
  children,
}: {
  id: string;
  label: ReactNode;
  required?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  icon?: ReactNode;
  trailing?: ReactNode;
  /** The control is a group (radios/checkboxes): the label names the
   * group instead of pointing at one input. */
  group?: boolean;
  /** Optional id on the field wrapper (e.g. an anchor target). */
  wrapperId?: string;
  dir?: "ltr" | "rtl";
  children: (control: FieldControlProps & { labelId: string }) => ReactNode;
}) {
  const t = useTranslations("Forms");
  const labelId = `${id}-label`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ");
  const control = children({
    id,
    "aria-describedby": describedBy || undefined,
    "aria-invalid": error ? true : undefined,
    required: required || undefined,
    labelId,
  });
  const showMarker = required && !icon;
  const labelNode = (
    <label id={labelId} htmlFor={group ? undefined : id}>
      {label}
      {showMarker ? (
        <span className="required-marker" aria-hidden="true">
          *
        </span>
      ) : null}
      {showMarker ? <span className="visually-hidden">{t("requiredLabel")}</span> : null}
    </label>
  );
  const messages = (
    <>
      {hint ? (
        <p className="field-hint" id={hintId}>
          {hint}
        </p>
      ) : null}
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
    </>
  );

  if (icon) {
    return (
      <div className="field field--icon" data-invalid={Boolean(error)}>
        <div className="field__control">
          {icon}
          <div className="field__control-body" dir={dir}>
            {labelNode}
            {control}
          </div>
          {trailing}
        </div>
        {messages}
      </div>
    );
  }
  return (
    <div className="field" data-invalid={Boolean(error)} id={wrapperId}>
      {labelNode}
      {control}
      {messages}
    </div>
  );
}
