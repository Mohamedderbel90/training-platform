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
import { FormError } from "@/components/FormError";
import { PasswordField } from "@/components/PasswordField";
import { SubmitButton } from "@/components/SubmitButton";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { ErrorState, LoadingState } from "@/components/StateViews";
import { ArrowIcon, CheckIcon } from "@/components/icons";

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
  const tf = useTranslations("Forms");
  const locale = useLocale() as AppLocale;
  const dir = DIRECTION_BY_LOCALE[locale];
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [touched, setTouched] = useState({ password: false, confirm: false });
  const [attempted, setAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <ErrorState
        headingLevel={1}
        title={t("invalidLinkTitle")}
        message={t("invalidLinkMessage")}
        action={
          <Link href="/forgot-password" className="button">
            {t("requestNewLink")}
          </Link>
        }
      />
    );
  }

  if (done) {
    return (
      <div className="state-view state-view--success" role="status">
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

  const passwordFieldErrors = error?.fields?.password ?? [];
  const clientErrors = {
    password: password ? null : tf("required"),
    confirm: !confirmPassword
      ? tf("required")
      : password !== confirmPassword
        ? t("passwordMismatch")
        : null,
  };
  const passwordShown =
    (touched.password || attempted ? clientErrors.password : null) ??
    (passwordFieldErrors.length ? passwordFieldErrors.join(" ") : null);
  const confirmShown = touched.confirm || attempted ? clientErrors.confirm : null;

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAttempted(true);
    const firstInvalid = clientErrors.password
      ? "new-password-field"
      : clientErrors.confirm
        ? "confirm-password-field"
        : null;
    if (firstInvalid) {
      document.getElementById(firstInvalid)?.focus();
      return;
    }
    setError(null);
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

  return (
    <>
      <h1>{t("resetTitle")}</h1>
      <p className="auth-card__subtitle">{t("resetSubtitle")}</p>

      <FormError error={error} />

      <form onSubmit={handleSubmit} noValidate aria-busy={submitting || undefined}>
        <PasswordField
          id="new-password-field"
          label={t("newPasswordLabel")}
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
          onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
          error={passwordShown}
          dir={dir}
        />
        <PasswordField
          id="confirm-password-field"
          label={t("confirmPasswordLabel")}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          onBlur={() => setTouched((prev) => ({ ...prev, confirm: true }))}
          error={confirmShown}
          dir={dir}
        />

        <div className="button-row">
          <SubmitButton
            className="button auth-submit"
            loading={submitting}
            loadingLabel={t("resetSubmitting")}
            icon={<ArrowIcon className="auth-submit__icon" />}
          >
            {t("resetSubmit")}
          </SubmitButton>
        </div>
      </form>
    </>
  );
}
