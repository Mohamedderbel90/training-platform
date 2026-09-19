"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { routing, type AppLocale } from "@/i18n/routing";
import { useAuth } from "@/lib/auth/AuthContext";
import type { OperationalRole } from "@/lib/api/types";
import { BrandMark } from "@/components/BrandMark";
import { ClipboardIcon, HomeIcon, LogoutIcon, MenuIcon, UsersIcon } from "@/components/icons";

const NAV_BY_ROLE: Record<
  OperationalRole,
  { href: string; key: string; icon: typeof HomeIcon }
> = {
  trainee: { href: "/trainee", key: "trainee", icon: HomeIcon },
  supervisor: { href: "/supervisor", key: "supervisor", icon: UsersIcon },
  trainer: { href: "/trainer", key: "trainer", icon: ClipboardIcon },
};

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

/** Global app shell (M5 point 3): brand, role-based nav, locale
 * switch, and the user/session menu. Mounted once in the locale
 * layout so every page gets consistent chrome, loading affordances
 * excepted (each page renders its own body content into <main>).
 *
 * Nav links exist exactly once in the DOM (`.app-sidebar`); CSS
 * alone repositions that single element as a persistent sidebar on
 * desktop and as an off-canvas drawer (driven by `navOpen`/`data-open`)
 * on narrow viewports, avoiding duplicated links/landmarks. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations("Common");
  const tNav = useTranslations("Nav");
  const locale = useLocale() as AppLocale;
  const pathname = usePathname();
  const router = useRouter();
  const { status, profile, roles, logout } = useAuth();
  const [navOpen, setNavOpen] = useState(false);

  const navItems = roles.map((role) => NAV_BY_ROLE[role]).filter(Boolean);
  const hasNav = status === "authenticated" && navItems.length > 0;

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
          <div className="app-sidebar__brand">
            <span className="brand">
              <span className="brand__mark">
                <BrandMark />
              </span>
              <span className="brand__name">{t("appName")}</span>
            </span>
          </div>
          <nav
            id="app-nav"
            className="app-sidebar__nav"
            aria-label={tNav("primaryNavigation")}
          >
            {navItems.map((item) => {
              const ItemIcon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="nav-link"
                  aria-current={pathname === item.href ? "page" : undefined}
                  onClick={() => setNavOpen(false)}
                >
                  <ItemIcon className="nav-link__icon" />
                  {tNav(item.key)}
                </Link>
              );
            })}
          </nav>
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
          </div>

          <div className="app-topbar__actions">
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
                <span className="user-menu__name">{profile.name}</span>
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={handleLogout}
                >
                  <LogoutIcon />
                  {t("logout")}
                </button>
              </div>
            ) : null}
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
