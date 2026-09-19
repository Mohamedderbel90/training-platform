"use client";

import { Suspense, useEffect, useId, useState, type SubmitEvent } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link, useRouter, usePathname } from "@/i18n/navigation";
import { routing, type AppLocale } from "@/i18n/routing";
import { DIRECTION_BY_LOCALE } from "@/i18n/direction";
import { useAuth } from "@/lib/auth/AuthContext";
import { getRoleHome } from "@/lib/auth/roleHome";
import { ApiError } from "@/lib/api/client";
import { ApiErrorView } from "@/components/ApiErrorView";
import { LoadingState } from "@/components/StateViews";
import {
  ArrowIcon,
  EyeIcon,
  EyeOffIcon,
  GlobeIcon,
  LockIcon,
  MailIcon,
} from "@/components/icons";

const REMEMBERED_LOGIN_KEY = "noor.rememberedLogin";

function isSafeReturnPath(path: string | null): path is string {
  return Boolean(path) && path!.startsWith("/") && !path!.startsWith("//");
}

/**
 * Approved visual design: see noor-login/README.md and
 * approved-login-reference.png. `background-login.png` is a single
 * pre-composed background asset (photo + emerald panel + subtle gold
 * pattern, no baked-in text) applied once via CSS on `.auth-page` --
 * see `.auth-page` in globals.css. It is deliberately NOT built from
 * separate photo/panel/pattern layers the way earlier iterations of
 * this page were; the form and the hadith quote are the only real
 * HTML/CSS on top of it.
 *
 * The image's dark decorative content sits on its physical left and
 * its plain light area on its physical right in BOTH languages (the
 * approved reference shows this same fixed composition for Arabic
 * too), so the quote overlay and the form panel are positioned with
 * physical CSS (`inset-inline-start`/`margin-left`), not logical
 * properties, and each still carries a real `dir={locale direction}`
 * for its own text content -- see the matching comment in
 * globals.css.
 */
function AuthPageShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations("Auth");
  const tc = useTranslations("Common");
  const locale = useLocale() as AppLocale;
  const pathname = usePathname();
  const dir = DIRECTION_BY_LOCALE[locale];
  const year = new Date().getFullYear();

  return (
    <div className="auth-page">
      <nav className="auth-page__lang-switch" aria-label={tc("languageSwitchLabel")}>
        <GlobeIcon />
        {routing.locales.map((candidate) => (
          <Link
            key={candidate}
            href={pathname}
            locale={candidate}
            aria-current={candidate === locale}
          >
            {tc(`locale.${candidate}`)}
          </Link>
        ))}
      </nav>

      <div className="auth-hero-overlay" dir={dir}>
        <blockquote className="auth-hero__quote">
          <p>{t("hadithQuote")}</p>
          <footer>
            <cite>{t("hadithSource")}</cite>
          </footer>
        </blockquote>
        <p className="auth-hero__footer">
          <Image
            src="/noor-login/icon-fleur.png"
            alt=""
            width={24}
            height={16}
            className="auth-hero__footer-icon"
          />
          <span>{t("heroFooterTagline")}</span>
        </p>
      </div>

      <div className="auth-page__form-panel" dir={dir}>
        <div className="auth-card">
          <div className="auth-card__brand">
            <Image
              src="/noor-login/noor-logo-symbol-approx.png"
              alt=""
              width={72}
              height={57}
              className="auth-card__logo"
            />
            <p className="auth-card__brand-name">{tc("appName")}</p>
            <p className="auth-card__tagline">{t("tagline")}</p>
          </div>
          <div className="auth-card__divider" aria-hidden="true">
            <span />
            <Image
              src="/noor-login/icon-fleur.png"
              alt=""
              width={30}
              height={20}
              className="auth-card__divider-icon"
            />
            <span />
          </div>
          {children}
        </div>
        <p className="auth-page__copyright">
          {t("copyright", { year, appName: tc("appName") })}
        </p>
      </div>
    </div>
  );
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
  const forgotPasswordId = useId();

  const [loginValue, setLoginValue] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [showForgotNotice, setShowForgotNotice] = useState(false);

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
          <button
            type="button"
            className="auth-form__forgot"
            aria-expanded={showForgotNotice}
            aria-controls={forgotPasswordId}
            onClick={() => setShowForgotNotice((shown) => !shown)}
          >
            {t("forgotPassword")}
          </button>
        </div>

        {showForgotNotice ? (
          <p id={forgotPasswordId} className="field-hint" role="status">
            {t("forgotPasswordNotice")}
          </p>
        ) : null}

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
