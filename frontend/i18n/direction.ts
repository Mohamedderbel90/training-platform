import type { AppLocale } from "@/i18n/routing";

/**
 * PROJECT_SPEC_v1.1_BILINGUAL.md section 2A: Arabic (ar) is RTL,
 * English (en) is LTR, decided dynamically from the active locale --
 * never hard-coded to a single direction. Shared by the root locale
 * layout (sets `<html dir>`) and any client component that needs to
 * know the real per-locale direction for its own markup (e.g. the
 * login page's hero/card panels, which pin their physical left/right
 * order regardless of locale and must re-declare the true direction
 * for their own text content -- see the `.auth-split` comment in
 * globals.css).
 */
export const DIRECTION_BY_LOCALE: Record<AppLocale, "rtl" | "ltr"> = {
  ar: "rtl",
  en: "ltr",
};
