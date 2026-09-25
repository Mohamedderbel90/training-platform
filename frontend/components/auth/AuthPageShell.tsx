"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { routing, type AppLocale } from "@/i18n/routing";
import { DIRECTION_BY_LOCALE } from "@/i18n/direction";
import { GlobeIcon } from "@/components/icons";

/**
 * Shared visual chrome for every unauthenticated/public auth screen
 * (login, forgot-password, reset-password): approved design -- see
 * noor-login/README.md and approved-login-reference.png.
 * `background-login.png` is a single pre-composed background asset
 * (photo + emerald panel + subtle gold pattern, no baked-in text)
 * applied once via CSS on `.auth-page` -- see `.auth-page` in
 * globals.css. Extracted out of app/[locale]/login/page.tsx (M-follow-
 * up: forgot/reset password screens) so all three screens share
 * exactly one implementation of the hero/quote/brand/copyright frame
 * instead of duplicating it.
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
export function AuthPageShell({ children }: { children: React.ReactNode }) {
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
