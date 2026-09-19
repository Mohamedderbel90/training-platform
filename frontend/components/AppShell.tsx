"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { routing, type AppLocale } from "@/i18n/routing";
import { useAuth } from "@/lib/auth/AuthContext";
import { getPrimaryRole, ROLE_HOME } from "@/lib/auth/roleHome";
import { useDashboardSummary } from "@/lib/dashboard/useDashboardSummary";
import type { OperationalRole } from "@/lib/api/types";
import { BrandMark } from "@/components/BrandMark";
import { ProgramInfoBox } from "@/components/dashboard/ProgramInfoBox";
import {
  CalendarIcon,
  ClipboardIcon,
  HomeIcon,
  LogoutIcon,
  MenuIcon,
  UsersIcon,
} from "@/components/icons";

const ROLE_ICON: Record<OperationalRole, typeof HomeIcon> = {
  trainee: HomeIcon,
  supervisor: UsersIcon,
  trainer: ClipboardIcon,
};

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

/** Global app shell (M5 point 3): brand, role-based nav ("Dashboard" +
 * "Training Days" per operational role the user holds, plus Logout),
 * the shared header (current-program box, locale switch, user
 * identity), and the sidebar's decorative bottom illustration. Mounted
 * once in the locale layout so every authenticated page gets
 * consistent chrome; the approved Login page (see noor-login/README.md)
 * opts out entirely via the bare branch below and is never touched by
 * anything here. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations("Common");
  const tNav = useTranslations("Nav");
  const locale = useLocale() as AppLocale;
  const pathname = usePathname();
  const router = useRouter();
  const { status, profile, roles, logout } = useAuth();
  const [navOpen, setNavOpen] = useState(false);

  const hasNav = status === "authenticated" && roles.length > 0;
  const primaryRole = getPrimaryRole(roles);
  const { data: dashboard } = useDashboardSummary(hasNav ? primaryRole : null);

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  // The approved login design (see noor-login/README.md) is a fully
  // immersive, edge-to-edge page with no app chrome of its own -- it
  // builds its own language switcher and footer. Showing the normal
  // topbar above it would duplicate both. `pathname` here is already
  // locale-agnostic (matches the plain "/trainee"-style hrefs above).
  if (pathname === "/login") {
    return (
      <div className="app-shell">
        <a className="skip-link" href="#main-content">
          {t("skipToContent")}
        </a>
        <main id="main-content" className="app-main--bare">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className={`app-shell${hasNav ? " app-shell--with-sidebar" : ""}`}>
      <a className="skip-link" href="#main-content">
        {t("skipToContent")}
      </a>

      {hasNav && navOpen ? (
        <button
          type="button"
          className="sidebar-scrim"
          aria-hidden="true"
          tabIndex={-1}
          onClick={() => setNavOpen(false)}
        />
      ) : null}

      {hasNav ? (
        <aside className="app-sidebar" data-open={navOpen}>
          <div className="app-sidebar__content">
            <div className="app-sidebar__brand">
              <span className="app-sidebar__brand-mark">
                <BrandMark />
              </span>
              <span className="app-sidebar__brand-name">{t("appName")}</span>
              <span className="app-sidebar__brand-tagline">{t("appTagline")}</span>
            </div>
            <nav
              id="app-nav"
              className="app-sidebar__nav"
              aria-label={tNav("primaryNavigation")}
            >
              {roles.map((role) => {
                const RoleIcon = ROLE_ICON[role];
                const home = ROLE_HOME[role];
                const roleLabel = roles.length > 1 ? tNav(`roleLabel.${role}`) : null;
                return (
                  <div className="app-sidebar__nav-group" key={role}>
                    <Link
                      href={home}
                      className="nav-link"
                      aria-current={pathname === home ? "page" : undefined}
                      onClick={() => setNavOpen(false)}
                    >
                      <RoleIcon className="nav-link__icon" />
                      {roleLabel ? `${tNav("dashboard")} · ${roleLabel}` : tNav("dashboard")}
                    </Link>
                    <Link
                      href={`${home}/days`}
                      className="nav-link"
                      aria-current={pathname === `${home}/days` ? "page" : undefined}
                      onClick={() => setNavOpen(false)}
                    >
                      <CalendarIcon className="nav-link__icon" />
                      {roleLabel ? `${tNav("trainingDays")} · ${roleLabel}` : tNav("trainingDays")}
                    </Link>
                  </div>
                );
              })}
            </nav>
            <button type="button" className="nav-link nav-link--action" onClick={handleLogout}>
              <LogoutIcon className="nav-link__icon" />
              {t("logout")}
            </button>
          </div>
          <div className="app-sidebar__decor" aria-hidden="true" />
        </aside>
      ) : null}

      <div className="app-content-column">
        <header className="app-topbar">
          <div className="app-topbar__start">
            {hasNav ? (
              <button
                type="button"
                className="app-nav-toggle button button--ghost button--icon"
                aria-expanded={navOpen}
                aria-controls="app-nav"
                onClick={() => setNavOpen((open) => !open)}
              >
                <MenuIcon />
                <span className="visually-hidden">{t("menu")}</span>
              </button>
            ) : (
              <span className="brand">
                <span className="brand__mark">
                  <BrandMark />
                </span>
                <span className="brand__name">{t("appName")}</span>
              </span>
            )}
            <nav className="locale-switch" aria-label={t("languageSwitchLabel")}>
              {routing.locales.map((candidate) => (
                <Link
                  key={candidate}
                  href={pathname}
                  locale={candidate}
                  aria-current={candidate === locale}
                >
                  {t(`locale.${candidate}`)}
                </Link>
              ))}
            </nav>
            {status === "authenticated" && profile ? (
              <div className="user-menu">
                <span className="user-menu__avatar" aria-hidden="true">
                  {initialsOf(profile.name)}
                </span>
                <span className="user-menu__details">
                  <span className="user-menu__name">{profile.name}</span>
                  {primaryRole ? (
                    <span className="user-menu__role">{tNav(`roleLabel.${primaryRole}`)}</span>
                  ) : null}
                </span>
              </div>
            ) : null}
          </div>

          <div className="app-topbar__end">
            <ProgramInfoBox program={dashboard?.program ?? null} />
          </div>
        </header>
        <main id="main-content" className="app-main">
          {children}
        </main>
        <footer className="app-footer">{t("footerNote")}</footer>
      </div>
    </div>
  );
}
