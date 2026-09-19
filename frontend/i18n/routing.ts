import { defineRouting } from "next-intl/routing";

/**
 * Supported locales for the operational frontend.
 *
 * PROJECT_SPEC_v1.1_BILINGUAL.md section 2A: Arabic (ar, RTL) is the
 * default product language; English (en, LTR) is the second
 * supported locale. No third locale exists at this milestone.
 */
export const routing = defineRouting({
  locales: ["ar", "en"],
  defaultLocale: "ar",
});

export type AppLocale = (typeof routing.locales)[number];
