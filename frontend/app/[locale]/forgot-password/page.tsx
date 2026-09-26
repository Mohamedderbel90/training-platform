"use client";

/**
 * PROJECT_SPEC_v1.1_BILINGUAL.md section 9 ("Shared" screens) and
 * section 10.1 (`POST /api/v1/auth/password/forgot`). The backend
 * already implements this via standard Odoo functionality only --
 * `res.users.reset_password()` (see
 * custom_addons/training_management/controllers/auth.py) -- so this
 * page is purely the missing operational-portal client for an
 * endpoint that already existed. It always shows the same generic
 * success state regardless of whether the login matched a real
 * account, mirroring the server's own "never reveal whether the
 * account exists" behavior (PROJECT_SPEC section 10.1).
 */
import { useState, type SubmitEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { DIRECTION_BY_LOCALE } from "@/i18n/direction";
import { authApi } from "@/lib/api/endpoints";
import { ApiError } from "@/lib/api/client";
import { FormError } from "@/components/FormError";
import { FormField } from "@/components/FormField";
import { SubmitButton } from "@/components/SubmitButton";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { ArrowIcon, CheckIcon, MailIcon } from "@/components/icons";

export default function ForgotPasswordPage() {
  return (
    <AuthPageShell>
      <ForgotPasswordForm />
    </AuthPageShell>
  );
}

function ForgotPasswordForm() {
  const t = useTranslations("Auth");
  const tf = useTranslations("Forms");
  const locale = useLocale() as AppLocale;
  const dir = DIRECTION_BY_LOCALE[locale];

  const [loginValue, setLoginValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [attempted, setAttempted] = useState(false);

  if (result) {
    return (
      <div className="state-view state-view--success" role="status">
        <span className="state-view__icon">
          <CheckIcon />
        </span>
        <p className="state-view__title">{t("forgotSuccessTitle")}</p>
        <p className="state-view__message">{result}</p>
        <Link href="/login" className="button button--secondary">
          {t("backToLogin")}
        </Link>
      </div>
    );
  }

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAttempted(true);
    if (!loginValue.trim()) {
      document.getElementById("forgot-login-field")?.focus();
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const response = await authApi.forgotPassword(loginValue, locale);
      setResult(response.message);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <h1>{t("forgotTitle")}</h1>
      <p className="auth-card__subtitle">{t("forgotSubtitle")}</p>

      <FormError error={error} />

      <form onSubmit={handleSubmit} noValidate aria-busy={submitting || undefined}>
        <FormField
          id="forgot-login-field"
          label={t("loginLabel")}
          required
          error={
            (touched || attempted ? (loginValue.trim() ? null : tf("required")) : null) ??
            error?.fields?.login?.join(" ") ??
            null
          }
          dir={dir}
          icon={<MailIcon className="field__icon" />}
        >
          {(control) => (
            <input
              {...control}
              className="field__input"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="send"
              placeholder={t("loginPlaceholder")}
              value={loginValue}
              onChange={(event) => setLoginValue(event.target.value)}
              onBlur={() => setTouched(true)}
            />
          )}
        </FormField>

        <div className="button-row">
          <SubmitButton
            className="button auth-submit"
            loading={submitting}
            loadingLabel={t("forgotSubmitting")}
            icon={<ArrowIcon className="auth-submit__icon" />}
          >
            {t("forgotSubmit")}
          </SubmitButton>
        </div>
        <div className="button-row">
          <Link href="/login" className="auth-form__forgot">
            {t("backToLogin")}
          </Link>
        </div>
      </form>
    </>
  );
}
