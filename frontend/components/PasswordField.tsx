"use client";

import { useState, type FocusEventHandler } from "react";
import { useTranslations } from "next-intl";
import { FormField } from "@/components/FormField";
import { EyeIcon, EyeOffIcon, LockIcon } from "@/components/icons";

/** Auth-card password field with an accessible show/hide toggle. The
 * toggle is a real button (its name flips between "Show password" and
 * "Hide password"), stays in the tab order after the input, keeps
 * focus when pressed, and sits on the inline-end of the field. */
export function PasswordField({
  id,
  label,
  value,
  onChange,
  onBlur,
  autoComplete,
  error,
  dir,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: FocusEventHandler<HTMLInputElement>;
  autoComplete: "current-password" | "new-password";
  error?: string | null;
  dir?: "ltr" | "rtl";
  hint?: string;
}) {
  const t = useTranslations("Auth");
  const [show, setShow] = useState(false);
  return (
    <FormField
      id={id}
      label={label}
      required
      error={error}
      hint={hint}
      dir={dir}
      icon={<LockIcon className="field__icon" />}
      trailing={
        <button type="button" className="field__toggle" onClick={() => setShow((s) => !s)}>
          {show ? <EyeOffIcon aria-hidden="true" /> : <EyeIcon aria-hidden="true" />}
          <span className="visually-hidden">{show ? t("hidePassword") : t("showPassword")}</span>
        </button>
      }
    >
      {(control) => (
        <input
          {...control}
          className="field__input"
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint={autoComplete === "current-password" ? "go" : "done"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
        />
      )}
    </FormField>
  );
}
