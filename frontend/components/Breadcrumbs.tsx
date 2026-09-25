"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { DIRECTION_BY_LOCALE } from "@/i18n/direction";
import type { AppLocale } from "@/i18n/routing";
import { useAuth } from "@/lib/auth/AuthContext";
import { getRoleHome } from "@/lib/auth/roleHome";
import { ChevronIcon } from "@/components/icons";

export interface BreadcrumbItem {
  label: string;
  /** Omitted on the current (last) crumb; it renders as plain text with
   * aria-current="page" either way. */
  href?: string;
}

/**
 * Accessible breadcrumb trail (`<nav aria-label>` + `<ol>`), matching
 * the approved reference: "Home > Parent > Current", the current page
 * in bold and not a link.
 *
 * A "Home" crumb is prepended automatically. It links to `homeHref`
 * when given (a role-specific page's own role home), otherwise to the
 * signed-in user's primary role home (`getRoleHome`), the same place
 * login lands them.
 *
 * The separator chevron points from the parent crumb toward the next
 * one in reading order: right in English (LTR), left in Arabic (RTL).
 * It is mirrored per locale direction via `data-direction`, not by
 * reversing the list order, so DOM, reading and tab order stay the
 * same in both languages.
 */
export function Breadcrumbs({
  items,
  homeHref,
}: {
  items: BreadcrumbItem[];
  homeHref?: string;
}) {
  const t = useTranslations("Breadcrumbs");
  const locale = useLocale() as AppLocale;
  const { roles } = useAuth();
  const direction = DIRECTION_BY_LOCALE[locale] ?? "ltr";

  const trail: BreadcrumbItem[] = [
    { label: t("home"), href: homeHref ?? getRoleHome(roles) },
    ...items,
  ];

  return (
    <nav className="breadcrumbs" aria-label={t("ariaLabel")}>
      <ol className="breadcrumbs__list">
        {trail.map((item, index) => {
          const isCurrent = index === trail.length - 1;
          return (
            <li className="breadcrumbs__item" key={`${index}-${item.label}`}>
              {index > 0 ? (
                <span
                  className="breadcrumbs__sep"
                  data-direction={direction}
                  aria-hidden="true"
                >
                  <ChevronIcon />
                </span>
              ) : null}
              {isCurrent ? (
                <span className="breadcrumbs__current" aria-current="page">
                  {item.label}
                </span>
              ) : item.href ? (
                <Link href={item.href} className="breadcrumbs__link">
                  {item.label}
                </Link>
              ) : (
                <span className="breadcrumbs__text">{item.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
