import { describe, it, expect, vi } from "vitest";
import enMessages from "@/messages/en.json";
import arMessages from "@/messages/ar.json";
import { pageTitle } from "@/lib/pageTitle";

const bundles = { en: enMessages, ar: arMessages } as unknown as Record<string, Record<string, Record<string, string>>>;

vi.mock("next-intl/server", () => ({
  getTranslations: async ({ locale, namespace }: { locale: string; namespace: string }) =>
    (key: string) => bundles[locale][namespace][key],
}));

describe("pageTitle", () => {
  it("returns the page's own translated title per locale", async () => {
    const meta = pageTitle("Nav", "trainingDays");
    expect(await meta({ params: Promise.resolve({ locale: "en" }) })).toEqual({ title: "Training Days — Noor Al-Qiyadah" });
    expect(await meta({ params: Promise.resolve({ locale: "ar" }) })).toEqual({ title: `${arMessages.Nav.trainingDays} — ${arMessages.Common.appName}` });
  });

  it("gives different pages different titles", async () => {
    const [a, b] = await Promise.all([
      pageTitle("Nav", "dashboard")({ params: Promise.resolve({ locale: "en" }) }),
      pageTitle("Auth", "title")({ params: Promise.resolve({ locale: "en" }) }),
    ]);
    expect(a.title).not.toBe(b.title);
  });
});
