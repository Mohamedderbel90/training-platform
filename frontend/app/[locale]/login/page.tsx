"use client";

import { Suspense, useEffect, useState, type SubmitEvent } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { DIRECTION_BY_LOCALE } from "@/i18n/direction";
import { useAuth } from "@/lib/auth/AuthContext";
import { getRoleHome } from "@/lib/auth/roleHome";
import { safeReturnTo } from "@/lib/auth/returnTo";
import { ApiError } from "@/lib/api/client";
import { FormError } from "@/components/FormError";
import { FormField } from "@/components/FormField";
import { PasswordField } from "@/components/PasswordField";
import { SubmitButton } from "@/components/SubmitButton";
import { LoadingState } from "@/components/StateViews";
import { NoRoleState } from "@/components/NoRoleState";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { ArrowIcon, MailIcon } from "@/components/icons";

const REMEMBERED_LOGIN_KEY = "noor.rememberedLogin";

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
  const tf = useTranslations("Forms");
  const locale = useLocale() as AppLocale;
  const dir = DIRECTION_BY_LOCALE[locale];
  const { status, roles, login } = useAuth();
  const router = useRouter();
  const returnTo = safeReturnTo(useSearchParams()?.get("returnTo"));
  const [loginValue, setLoginValue] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  // UX-only validation: which fields the user has left, and whether a
  // submit was attempted. The server stays authoritative.
  const [touched, setTouched] = useState({ login: false, password: false });
  const [attempted, setAttempted] = useState(false);
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
    if (status === "authenticated" && roles.length > 0) {
      router.replace(returnTo ?? getRoleHome(roles));
    }
  }, [status, roles, router, returnTo]);

  if (status === "authenticated" && roles.length === 0) {
    return <NoRoleState />;
  }

  if (status === "loading" || status === "authenticated") {
    return <LoadingState label={t("checkingSession")} />;
  }

  const fieldErrors = error?.fields ?? {};
  const clientErrors = {
    login: loginValue.trim() ? null : tf("required"),
    password: password ? null : tf("required"),
  };
  const shown = (name: "login" | "password") =>
    (touched[name] || attempted ? clientErrors[name] : null) ?? fieldErrors[name]?.join(" ") ?? null;

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAttempted(true);
    const firstInvalid = clientErrors.login ? "login-field" : clientErrors.password ? "password-field" : null;
    if (firstInvalid) {
      document.getElementById(firstInvalid)?.focus();
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      // Only the username is trimmed -- a password is sent exactly as typed.
      const username = loginValue.trim();
      const profile = await login(username, password);
      if (rememberMe) {
        window.localStorage.setItem(REMEMBERED_LOGIN_KEY, username);
      } else {
        window.localStorage.removeItem(REMEMBERED_LOGIN_KEY);
      }
      // The page the visitor originally asked for (validated same-app
      // path), else their own dashboard. A role-less account has no home;
      // the authenticated-state branch above renders NoRoleState instead
      // of navigating.
      if (profile.roles.length > 0) {
        router.replace(returnTo ?? getRoleHome(profile.roles));
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err);
        // Never keep a rejected password in the field (the username stays).
        // Focus is left on the error summary (FormError) so the failure is
        // announced.
        setPassword("");
        setAttempted(false);
        setTouched({ login: false, password: false });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <h1>{t("title")}</h1>
      <p className="auth-card__subtitle">{t("subtitle")}</p>

      <FormError error={error} />

      <form onSubmit={handleSubmit} noValidate aria-busy={submitting || undefined}>
        <FormField
          id="login-field"
          label={t("loginLabel")}
          required
          error={shown("login")}
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
              enterKeyHint="next"
              placeholder={t("loginPlaceholder")}
              value={loginValue}
              onChange={(event) => setLoginValue(event.target.value)}
              onBlur={() => setTouched((prev) => ({ ...prev, login: true }))}
            />
          )}
        </FormField>

        <PasswordField
          id="password-field"
          label={t("passwordLabel")}
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
          onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
          error={shown("password")}
          dir={dir}
        />

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
          <SubmitButton
            className="button auth-submit"
            loading={submitting}
            loadingLabel={t("signingIn")}
            icon={<ArrowIcon className="auth-submit__icon" />}
          >
            {t("signIn")}
          </SubmitButton>
        </div>
      </form>
    </>
  );
}
