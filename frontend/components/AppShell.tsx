"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useTranslations, useLocale } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { routing, type AppLocale } from "@/i18n/routing";
import { useAuth } from "@/lib/auth/AuthContext";
import { getPrimaryRole } from "@/lib/auth/roleHome";
import { ACCOUNT_NAV, FOOTER_NAV, isNavItemActive, ROLE_NAV, type RoleNavKey } from "@/lib/auth/roleNav";
import { useDashboardSummary } from "@/lib/dashboard/useDashboardSummary";
import { useProgramSelection } from "@/lib/dashboard/ProgramSelection";
import type { OperationalRole } from "@/lib/api/types";
import { BrandMark } from "@/components/BrandMark";
import { ProgramInfoBox } from "@/components/dashboard/ProgramInfoBox";
import {
  BellIcon,
  CalendarIcon,
  ClipboardIcon,
  DocumentIcon,
  GlobeIcon,
  HomeIcon,
  InfoIcon,
  LockIcon,
  LogoutIcon,
  MenuIcon,
  PersonIcon,
  UsersIcon,
} from "@/components/icons";

const ROLE_ICON: Record<OperationalRole, typeof HomeIcon> = {
  trainee: HomeIcon,
  supervisor: UsersIcon,
  trainer: ClipboardIcon,
};

/** Icon per nav item; a role's own dashboard item uses ROLE_ICON above
 * instead so existing per-role dashboard icons stay unchanged. */
const NAV_ICON: Record<RoleNavKey, typeof HomeIcon> = {
  dashboard: HomeIcon,
  trainingDays: CalendarIcon,
  profile: PersonIcon,
  help: InfoIcon,
  terms: DocumentIcon,
  privacy: LockIcon,
};

/** Public, unauthenticated screens that render their own full-bleed
 * AuthPageShell chrome (brand, language switch, footer) and must never
 * get the authenticated app's topbar/sidebar/footer layered on top. */
const BARE_CHROME_PATHS = new Set(["/login", "/forgot-password", "/reset-password"]);

/** Also used by the /profile page (PROJECT_SPEC section 9 "Shared"
 * screens) for its own, larger avatar -- kept as a single
 * implementation rather than a second copy. */
export function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

/** Global app shell (M5 point 3): brand, role-based nav (the per-role
 * item list from lib/auth/roleNav.ts for each operational role the user
 * holds, then Profile and Logout),
 * the shared header (current-program box, locale switch, user
 * identity), and the sidebar's decorative bottom illustration. Mounted
 * once in the locale layout so every authenticated page gets
 * consistent chrome; the approved Login page (see docs/README.md (noor-login/ row))
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
  const [notifOpen, setNotifOpen] = useState(false);
  const navToggleRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const notifRef = useRef<HTMLSpanElement>(null);

  const hasNav = status === "authenticated" && roles.length > 0;
  const primaryRole = getPrimaryRole(roles);
  const { data: dashboard, error: dashboardError } = useDashboardSummary(
    hasNav ? primaryRole : null,
  );
  const { selectedProgramId, setSelectedProgramId } = useProgramSelection();

  // A remembered program the user is no longer assigned in (another account on
  // this browser, or an assignment that ended) is refused by the backend:
  // fall back to the current program instead of showing an error.
  useEffect(() => {
    if (selectedProgramId !== null && dashboardError?.code === "FORBIDDEN") {
      setSelectedProgramId(null);
    }
  }, [dashboardError, selectedProgramId, setSelectedProgramId]);
  const otherLocale = routing.locales.find((candidate) => candidate !== locale) ?? locale;

  // Escape dismisses the mobile drawer / notifications popover.
  useEffect(() => {
    if (!navOpen && !notifOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setNavOpen(false);
        setNotifOpen(false);
        // Hand focus back to the bell so keyboard users keep their place.
        if (notifRef.current?.contains(document.activeElement)) {
          notifRef.current.querySelector<HTMLElement>("button")?.focus();
        }
      }
    };
    // Clicking/tapping outside the notifications popover dismisses it.
    const onPointerDown = (event: PointerEvent) => {
      if (notifOpen && !notifRef.current?.contains(event.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [navOpen, notifOpen]);

  // Off-canvas drawer focus management: opening moves focus to the first
  // nav link; closing (Escape, scrim, link) returns focus to the menu
  // button when focus was inside the drawer, so keyboard users never lose
  // their place. Never runs on desktop, where the drawer is a static sidebar.
  useEffect(() => {
    if (!navOpen) return;
    const sidebar = sidebarRef.current;
    const toggle = navToggleRef.current;
    sidebar?.querySelector<HTMLElement>("a[href]")?.focus();
    return () => {
      if (sidebar?.contains(document.activeElement) || document.activeElement === document.body) {
        toggle?.focus();
      }
    };
  }, [navOpen]);

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  // The approved login design (see docs/README.md (noor-login/ row)) is a fully
  // immersive, edge-to-edge page with no app chrome of its own -- it
  // builds its own language switcher and footer. Showing the normal
  // topbar above it would duplicate both. The forgot/reset-password
  // screens are the same unauthenticated public flow and reuse the
  // identical AuthPageShell (see components/auth/AuthPageShell.tsx),
  // so they opt out of app chrome the same way. `pathname` here is
  // already locale-agnostic (matches the plain "/trainee"-style hrefs
  // above).
  if (BARE_CHROME_PATHS.has(pathname)) {
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
        <aside className="app-sidebar" data-open={navOpen} ref={sidebarRef}>
          <div className="app-sidebar__content">
            <div className="app-sidebar__brand">
              <span className="app-sidebar__brand-mark" aria-hidden="true">
                {/* Real brand mark (dome + open book emblem), matching the
                 * approved reference -- see docs/README.md (noor-login/ row); this is
                 * the same asset already used on the login page, not the
                 * abstract star glyph. */}
                <Image
                  src="/noor-login/noor-logo-symbol-approx.png"
                  alt=""
                  width={624}
                  height={496}
                  priority
                />
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
                const roleLabel = roles.length > 1 ? tNav(`roleLabel.${role}`) : null;
                return (
                  <div className="app-sidebar__nav-group" key={role}>
                    {ROLE_NAV[role].map((item) => {
                      const ItemIcon =
                        item.key === "dashboard" ? ROLE_ICON[role] : NAV_ICON[item.key];
                      const label = tNav(item.key);
                      return (
                        <Link
                          key={item.key}
                          href={item.href}
                          className="nav-link"
                          aria-current={isNavItemActive(item, pathname) ? "page" : undefined}
                          onClick={() => setNavOpen(false)}
                        >
                          <ItemIcon className="nav-link__icon" />
                          {roleLabel ? `${label} · ${roleLabel}` : label}
                        </Link>
                      );
                    })}
                  </div>
                );
              })}
              <div className="app-sidebar__nav-group">
                {ACCOUNT_NAV.map((item) => {
                  const ItemIcon = NAV_ICON[item.key];
                  return (
                    <Link
                      key={item.key}
                      href={item.href}
                      className="nav-link"
                      aria-current={isNavItemActive(item, pathname) ? "page" : undefined}
                      onClick={() => setNavOpen(false)}
                    >
                      <ItemIcon className="nav-link__icon" />
                      {tNav(item.key)}
                    </Link>
                  );
                })}
              </div>
            </nav>
            <button type="button" className="nav-link nav-link--action" onClick={handleLogout}>
              <LogoutIcon className="nav-link__icon" />
              {t("logout")}
            </button>
          </div>
          <div className="app-sidebar__decor" aria-hidden="true">
            <p className="app-sidebar__decor-text">
              {t("decorLine1")}
              <br />
              {t("decorLine2")}
            </p>
          </div>
        </aside>
      ) : null}

      <div className="app-content-column">
        <header className="app-topbar">
          <div className="app-topbar__start">
            {hasNav ? (
              <button
                type="button"
                ref={navToggleRef}
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
            {status === "authenticated" && profile ? (
              <Link
                href="/profile"
                className="user-menu"
                aria-current={pathname === "/profile" ? "page" : undefined}
              >
                <span className="user-menu__avatar" aria-hidden="true">
                  {initialsOf(profile.name)}
                </span>
                <span className="user-menu__details">
                  <span className="user-menu__name" title={profile.name}>
                    {profile.name}
                  </span>
                  {primaryRole ? (
                    <span className="user-menu__role">{tNav(`roleLabel.${primaryRole}`)}</span>
                  ) : null}
                </span>
              </Link>
            ) : null}
            <Link
              href={pathname}
              locale={otherLocale}
              className="button button--ghost button--icon"
              aria-label={t("switchToLocale", { locale: t(`locale.${otherLocale}`) })}
            >
              <GlobeIcon />
            </Link>
            <span className="icon-btn-wrap" ref={notifRef}>
              <button
                type="button"
                className="button button--ghost button--icon"
                aria-expanded={notifOpen}
                onClick={() => setNotifOpen((open) => !open)}
              >
                <BellIcon />
                <span className="visually-hidden">{t("notifTitle")}</span>
              </button>
              {notifOpen ? (
                <div className="notif-panel" role="dialog" aria-label={t("notifTitle")}>
                  <p className="notif-panel__title">{t("notifTitle")}</p>
                  {/* No notifications/activity-log model exists in the
                   * Operational API yet -- an honest "not available" state
                   * instead of fabricated demo notifications, matching the
                   * Dashboard's own programMessageUnavailable pattern. */}
                  <p className="card__meta">{t("notificationsUnavailable")}</p>
                </div>
              ) : null}
            </span>
          </div>

          {hasNav ? (
            <div className="app-topbar__center">
              <p className="topbar-bismillah">{t("bismillah")}</p>
              <p className="topbar-bismillah__quote">{t("topbarQuote")}</p>
            </div>
          ) : null}

          <div className="app-topbar__end">
            <ProgramInfoBox
              program={dashboard?.program ?? null}
              programs={dashboard?.programs ?? []}
              onSelect={setSelectedProgramId}
              topbar
            />
          </div>
        </header>
        {/* Phones: the header box is hidden (no room), so the same box is
         * shown as a slim strip under the header; it keeps the switcher when
         * the user has several programs. Hidden from 561px up in CSS. */}
        <div className="program-strip">
          <ProgramInfoBox
            program={dashboard?.program ?? null}
            programs={dashboard?.programs ?? []}
            onSelect={setSelectedProgramId}
            topbar
          />
        </div>
        <main id="main-content" className="app-main">
          {/* Keyed by route so the entrance runs once per navigation, never
           * on filter/search re-renders (those don't change the pathname). */}
          <div key={pathname} className="page-enter">
            {children}
          </div>
        </main>
        <footer className="app-footer">
          <nav className="app-footer__nav" aria-label={t("footerNavLabel")}>
            <ul className="app-footer__links">
              {FOOTER_NAV.map((item) => (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    className="app-footer__link"
                    aria-current={isNavItemActive(item, pathname) ? "page" : undefined}
                  >
                    {tNav(item.key)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <p className="app-footer__note">{t("footerNote")}</p>
        </footer>
      </div>
    </div>
  );
}
