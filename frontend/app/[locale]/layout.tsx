import type { Metadata } from "next";
import { Inter, Tajawal } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { hasLocale } from "use-intl";
import { notFound } from "next/navigation";
import { routing, type AppLocale } from "@/i18n/routing";
import { DIRECTION_BY_LOCALE } from "@/i18n/direction";
import { AuthProvider } from "@/lib/auth/AuthContext";
import { AppShell } from "@/components/AppShell";
import { ProgramSelectionProvider } from "@/lib/dashboard/ProgramSelection";
import "../globals.css";

// Two locale-appropriate type families sharing one design system
// (design direction: elegant/calm/professional, Latin + Arabic given
// equal typographic care). Both are exposed as CSS custom properties
// rather than a single `className`, so globals.css can pick the
// correct one per `dir` while still keeping the other as a fallback
// for any mixed-script text (a trainee's name inside an Arabic
// sentence, etc.).
const latinFont = Inter({
  subsets: ["latin"],
  variable: "--font-latin",
  display: "swap",
});

// Tajawal is a static (non-variable) family published in weights
// 200/300/400/500/700/800/900 -- there is no 600. The app's CSS uses
// 400 (body default), 500 and 600 (many headings/labels) and 700
// (strong emphasis). Rather than hand-adjust every font-weight: 600
// rule for the Arabic context, we rely on standard CSS font-weight
// matching: a request for 600 against a family that only declares
// 400/500/700/800/900 resolves to the nearest heavier declared
// weight, i.e. 700. Visually this reads as intended (a semibold/bold
// distinction collapses into "bold"), so only 400/500/700 need to be
// downloaded -- keeps the payload lean instead of shipping all 7 cuts.
const arabicFont = Tajawal({
  subsets: ["arabic"],
  weight: ["400", "500", "700"],
  variable: "--font-arabic",
  display: "swap",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Common" });
  return {
    title: t("appName"),
    description: t("footerNote"),
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Enables static rendering for this request's locale.
  setRequestLocale(locale);

  const messages = await getMessages();

  return (
    <html
      lang={locale}
      dir={DIRECTION_BY_LOCALE[locale as AppLocale]}
      className={`${latinFont.variable} ${arabicFont.variable}`}
    >
      <body>
        <NextIntlClientProvider messages={messages}>
          <AuthProvider>
            <ProgramSelectionProvider>
              <AppShell>{children}</AppShell>
            </ProgramSelectionProvider>
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
