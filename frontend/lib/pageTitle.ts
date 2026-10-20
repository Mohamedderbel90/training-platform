import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

/** `generateMetadata` for a route layout: "<page title> — <app name>"
 * from existing messages, so each tab/screen-reader title is distinct.
 * The suffix is added here rather than via a root `title.template`
 * because a nested layout that sets its own title string drops the
 * inherited template for the segments below it. */
export function pageTitle(namespace: string, key: string) {
  return async function generateMetadata({
    params,
  }: {
    params: Promise<{ locale: string }>;
  }): Promise<Metadata> {
    const { locale } = await params;
    const [t, common] = await Promise.all([
      getTranslations({ locale, namespace }),
      getTranslations({ locale, namespace: "Common" }),
    ]);
    return { title: `${t(key)} — ${common("appName")}` };
  };
}
