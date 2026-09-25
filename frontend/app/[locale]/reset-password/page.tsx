"use client";

/**
 * PROJECT_SPEC_v1.1_BILINGUAL.md section 9 ("Shared" screens) and
 * section 10.1 (`POST /api/v1/auth/password/reset`). Consumes the
 * standard Odoo signup-token flow via `res.users.signup()` (see
 * custom_addons/training_management/controllers/auth.py's
 * `password_reset`) -- no parallel token store on either side.
 */
import { Suspense, useState, type SubmitEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { DIRECTION_BY_LOCALE } from "@/i18n/direction";
import { authApi } from "@/lib/api/endpoints";
import { ApiError } from "@/lib/api/client";
import { ApiErrorView } from "@/components/ApiErrorView";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { EmptyState, LoadingState } from "@/components/StateViews";
import { ArrowIcon, CheckIcon, EyeIcon, EyeOffIcon, LockIcon } from "@/components/icons";

// useSearchParams() (for the reset token) requires its own Suspense
// boundary during static generation -- same requirement/pattern as
// /login (see that page's comment).
export default function ResetPasswordPage() {
  const t = useTranslations("Auth");
  return (
    <AuthPageShell>
      <Suspense fallback={<LoadingState label={t("checkingSession")} />}>
        <ResetPasswordForm />
      </Suspense>
    </AuthPageShell>
  );
}

function ResetPasswordForm() {
  const t = useTranslations("Auth");
  const locale = useLocale() as AppLocale;
  const dir = DIRECTION_BY_LOCALE[locale];
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [mismatch, setMismatch] = useState(false);
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <>
        <EmptyState title={t("invalidLinkTitle")} message={t("invalidLinkMessage")} />
        <div className="button-row">
          <Link href="/forgot-password" className="button">
            {t("requestNewLink")}
          </Link>
        </div>
      </>
    );
  }

  if (done) {
    return (
      <div className="state-view state-view--success">
        <span className="state-view__icon">
          <CheckIcon />
        </span>
        <p className="state-view__title">{t("resetSuccessTitle")}</p>
        <p className="state-view__message">{t("resetSuccessMessage")}</p>
        <Link href="/login" className="button">
          {t("backToLogin")}
        </Link>
      </div>
    );
  }

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMismatch(false);
    if (password !== confirmPassword) {
      setMismatch(true);
      return;
    }
    setSubmitting(true);
    try {
      await authApi.resetPassword(token, password, locale);
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const passwordFieldErrors = error?.fields?.password ?? [];

  return (
    <>
      <h1>{t("resetTitle")}</h1>
      <p className="auth-card__subtitle">{t("resetSubtitle")}</p>

      {error ? <ApiErrorView error={error} /> : null}

      <form onSubmit={handleSubmit} noValidate>
        <div className="field field--icon" data-invalid={Boolean(passwordFieldErrors.length)}>
          <div className="field__control">
            <LockIcon className="field__icon" />
            <div className="field__control-body" dir={dir}>
              <label htmlFor="new-password-field">{t("newPasswordLabel")}</label>
              <input
                id="new-password-field"
                className="field__input"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
            <button
              type="button"
              className="field__toggle"
              onClick={() => setShowPassword((show) => !show)}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              <span className="visually-hidden">
                {showPassword ? t("hidePassword") : t("showPassword")}
              </span>
            </button>
          </div>
          {passwordFieldErrors.length ? (
            <p className="field-error">{passwordFieldErrors.join(" ")}</p>
          ) : null}
        </div>

        <div className="field field--icon" data-invalid={mismatch}>
          <div className="field__control">
            <LockIcon className="field__icon" />
            <div className="field__control-body" dir={dir}>
              <label htmlFor="confirm-password-field">{t("confirmPasswordLabel")}</label>
              <input
                id="confirm-password-field"
                className="field__input"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                aria-describedby={mismatch ? "confirm-password-error" : undefined}
                required
              />
            </div>
          </div>
          {mismatch ? (
            <p className="field-error" id="confirm-password-error">
              {t("passwordMismatch")}
            </p>
          ) : null}
        </div>

        <div className="button-row">
          <button type="submit" className="button auth-submit" disabled={submitting}>
            {submitting ? t("resetSubmitting") : t("resetSubmit")}
            <ArrowIcon className="auth-submit__icon" />
          </button>
        </div>
      </form>
    </>
  );
}
