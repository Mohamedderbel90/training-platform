"use client";

/**
 * PROJECT_SPEC_v1.1_BILINGUAL.md section 9 lists `/profile` as a
 * "Shared" screen available to any operational role. There is no
 * profile-update endpoint in the Operational API (lib/api/endpoints.ts
 * / lib/api/types.ts) -- `GET /auth/me` is read-only -- so this page
 * shows the same OperationalProfile fields AuthContext already caches
 * (name, roles, active language) rather than inventing editable
 * fields the backend can't persist.
 */
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { routing, type AppLocale } from "@/i18n/routing";
import { useAuth } from "@/lib/auth/AuthContext";
import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";
import { initialsOf } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { LoadingState } from "@/components/StateViews";
import { GlobeIcon, LogoutIcon } from "@/components/icons";

function ProfileContent() {
  const t = useTranslations("Profile");
  const tc = useTranslations("Common");
  const tNav = useTranslations("Nav");
  const locale = useLocale() as AppLocale;
  const pathname = usePathname();
  const router = useRouter();
  const { status, profile, roles, logout } = useAuth();

  const otherLocale = routing.locales.find((candidate) => candidate !== locale) ?? locale;

  if (status === "loading" || !profile) {
    return <LoadingState label={tc("loadingSession")} />;
  }

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  return (
    <div>
      <PageHeader title={<h1>{t("title")}</h1>} subtitle={t("subtitle")} />

      <div className="card">
        <div className="profile-card__identity">
          <span className="profile-card__avatar" aria-hidden="true">
            {initialsOf(profile.name)}
          </span>
          <div>
            <p className="card__title">{profile.name}</p>
            <p className="card__meta">{t("nameLabel")}</p>
          </div>
        </div>

        <div className="profile-card__row">
          <div>
            <p className="card__title">{t("rolesLabel")}</p>
            <div className="profile-card__roles">
              {roles.map((role) => (
                <span key={role} className="badge badge--info">
                  {tNav(`roleLabel.${role}`)}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="profile-card__row">
          <div>
            <p className="card__title">{t("languageLabel")}</p>
            <p className="card__meta">{tc(`locale.${locale}`)}</p>
          </div>
          <Link
            href={pathname}
            locale={otherLocale}
            className="button button--secondary"
            aria-label={t("switchLanguage", { locale: tc(`locale.${otherLocale}`) })}
          >
            <GlobeIcon aria-hidden="true" />
            {tc(`locale.${otherLocale}`)}
          </Link>
        </div>
      </div>

      <div className="button-row">
        <button type="button" className="button button--danger" onClick={handleLogout}>
          <LogoutIcon />
          {t("logout")}
        </button>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <ProtectedRoute>
      <ProfileContent />
    </ProtectedRoute>
  );
}
