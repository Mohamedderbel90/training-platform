import { Suspense, type ReactElement, type ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import arMessages from "@/messages/ar.json";

const MESSAGES_BY_LOCALE = { en: enMessages, ar: arMessages } as const;

/**
 * In real Next.js App Router usage, every page segment sits under an
 * implicit Suspense boundary the framework itself provides -- that's
 * what lets a client-component page safely call `use(params)` (a
 * documented pattern; see the dynamic `[dayId]` pages under
 * app/[locale]/**). A bare RTL render of the page component in
 * isolation has no such ambient boundary, so this helper adds one
 * (never in production code) purely so these tests exercise the same
 * "params resolves, then renders" flow the real router provides.
 */
export function renderWithIntl(
  ui: ReactElement,
  { locale = "en" as "en" | "ar" }: { locale?: "en" | "ar" } = {},
) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider locale={locale} messages={MESSAGES_BY_LOCALE[locale]}>
        <Suspense fallback={null}>{children}</Suspense>
      </NextIntlClientProvider>
    );
  }
  return render(ui, { wrapper: Wrapper });
}

/** Picks an option in a themed dropdown (`SelectMenu`): open the combobox
 * by its label, then click the option by its visible name. */
export async function chooseOption(user: UserEvent, label: string, option: string | RegExp) {
  await user.click(screen.getByRole("combobox", { name: label }));
  await user.click(await screen.findByRole("option", { name: option }));
}
