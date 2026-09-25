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
import { ApiErrorView } from "@/components/ApiErrorView";
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
  const locale = useLocale() as AppLocale;
  const dir = DIRECTION_BY_LOCALE[locale];

  const [loginValue, setLoginValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [result, setResult] = useState<string | null>(null);

  if (result) {
    return (
      <div className="state-view state-view--success">
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

      {error ? <ApiErrorView error={error} /> : null}

      <form onSubmit={handleSubmit} noValidate>
        <div className="field field--icon" data-invalid={Boolean(error?.fields?.login)}>
          <div className="field__control">
            <MailIcon className="field__icon" />
            <div className="field__control-body" dir={dir}>
              <label htmlFor="forgot-login-field">{t("loginLabel")}</label>
              <input
                id="forgot-login-field"
                className="field__input"
                type="text"
                autoComplete="username"
                placeholder={t("loginPlaceholder")}
                value={loginValue}
                onChange={(event) => setLoginValue(event.target.value)}
                aria-describedby={error?.fields?.login ? "forgot-login-field-error" : undefined}
                required
              />
            </div>
          </div>
          {error?.fields?.login ? (
            <p className="field-error" id="forgot-login-field-error">
              {error.fields.login.join(" ")}
            </p>
          ) : null}
        </div>

        <div className="button-row">
          <button type="submit" className="button auth-submit" disabled={submitting}>
            {submitting ? t("forgotSubmitting") : t("forgotSubmit")}
            <ArrowIcon className="auth-submit__icon" />
          </button>
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
