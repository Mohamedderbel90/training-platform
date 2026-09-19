import { describe, it, expect } from "vitest";
import { routing } from "@/i18n/routing";

describe("locale routing configuration", () => {
  it("supports exactly Arabic and English, with Arabic as the default (PROJECT_SPEC section 2A)", () => {
    expect(routing.locales).toEqual(["ar", "en"]);
    expect(routing.defaultLocale).toBe("ar");
  });
});
