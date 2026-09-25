"use client";

import { Suspense, useEffect, useState, type SubmitEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link, useRouter } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { DIRECTION_BY_LOCALE } from "@/i18n/direction";
import { useAuth } from "@/lib/auth/AuthContext";
import { getRoleHome } from "@/lib/auth/roleHome";
import { ApiError } from "@/lib/api/client";
import { ApiErrorView } from "@/components/ApiErrorView";
import { LoadingState } from "@/components/StateViews";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { ArrowIcon, EyeIcon, EyeOffIcon, LockIcon, MailIcon } from "@/components/icons";

const REMEMBERED_LOGIN_KEY = "noor.rememberedLogin";

function isSafeReturnPath(path: string | null): path is string {
  return Boolean(path) && path!.startsWith("/") && !path!.startsWith("//");
}

// useSearchParams() opts a component into client-side rendering during
// static generation and must sit under its own <Suspense> boundary
// (Next.js requirement -- verified by `next build` failing to
// prerender /login without it). LoginPage stays the page's default
// export; the actual form lives in LoginForm underneath the boundary.
export default function LoginPage() {
  const t = useTranslations("Auth");
  return (
    <AuthPageShell>
      <Suspense fallback={<LoadingState label={t("checkingSession")} />}>
        <LoginForm />
      </Suspense>
    </AuthPageShell>
  );
}

function LoginForm() {
  const t = useTranslations("Auth");
  const locale = useLocale() as AppLocale;
  const dir = DIRECTION_BY_LOCALE[locale];
  const { status, roles, login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const [loginValue, setLoginValue] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  // "Remember me" only ever remembers the login identifier locally,
  // never the password and never anything server-side (the login API
  // has no such concept -- see lib/api/endpoints.ts's authApi.login).
  // This one-time read from a browser-only API can't move into a
  // `useState` lazy initializer instead: `window` doesn't exist
  // during SSR, and seeding real state on the client's first render
  // (skipping the effect) would produce a hydration mismatch against
  // the server-rendered empty input.
  useEffect(() => {
    const remembered = window.localStorage.getItem(REMEMBERED_LOGIN_KEY);
    if (remembered) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoginValue(remembered);
      setRememberMe(true);
    }
  }, []);

  // Already-authenticated visitors (e.g. back-button to /login) go
  // straight to their dashboard instead of seeing the form again.
  useEffect(() => {
    if (status === "authenticated") {
      router.replace(isSafeReturnPath(returnTo) ? returnTo : getRoleHome(roles));
    }
  }, [status, roles, returnTo, router]);

  if (status === "loading" || status === "authenticated") {
    return <LoadingState label={t("checkingSession")} />;
  }

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const profile = await login(loginValue, password);
      if (rememberMe) {
        window.localStorage.setItem(REMEMBERED_LOGIN_KEY, loginValue);
      } else {
        window.localStorage.removeItem(REMEMBERED_LOGIN_KEY);
      }
      router.replace(isSafeReturnPath(returnTo) ? returnTo : getRoleHome(profile.roles));
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const fieldErrors = error?.fields ?? {};

  return (
    <>
      <h1>{t("title")}</h1>
      <p className="auth-card__subtitle">{t("subtitle")}</p>

      {error ? <ApiErrorView error={error} /> : null}

      <form onSubmit={handleSubmit} noValidate>
        <div className="field field--icon" data-invalid={Boolean(fieldErrors.login)}>
          <div className="field__control">
            <MailIcon className="field__icon" />
            <div className="field__control-body" dir={dir}>
              <label htmlFor="login-field">{t("loginLabel")}</label>
              <input
                id="login-field"
                className="field__input"
                type="text"
                autoComplete="username"
                placeholder={t("loginPlaceholder")}
                value={loginValue}
                onChange={(event) => setLoginValue(event.target.value)}
                aria-describedby={fieldErrors.login ? "login-field-error" : undefined}
                required
              />
            </div>
          </div>
          {fieldErrors.login ? (
            <p className="field-error" id="login-field-error">
              {fieldErrors.login.join(" ")}
            </p>
          ) : null}
        </div>

        <div className="field field--icon" data-invalid={Boolean(fieldErrors.password)}>
          <div className="field__control">
            <LockIcon className="field__icon" />
            <div className="field__control-body" dir={dir}>
              <label htmlFor="password-field">{t("passwordLabel")}</label>
              <input
                id="password-field"
                className="field__input"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-describedby={fieldErrors.password ? "password-field-error" : undefined}
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
          {fieldErrors.password ? (
            <p className="field-error" id="password-field-error">
              {fieldErrors.password.join(" ")}
            </p>
          ) : null}
        </div>

        <div className="auth-form__row">
          <label className="auth-form__remember">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
            />
            {t("rememberMe")}
          </label>
          <Link href="/forgot-password" className="auth-form__forgot">
            {t("forgotPassword")}
          </Link>
        </div>

        <div className="button-row">
          <button type="submit" className="button auth-submit" disabled={submitting}>
            {submitting ? t("signingIn") : t("signIn")}
            <ArrowIcon className="auth-submit__icon" />
          </button>
        </div>
      </form>
    </>
  );
}
