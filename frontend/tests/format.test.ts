import { describe, expect, it } from "vitest";
import { createTranslator } from "next-intl";
import { formatTimeRange } from "@/lib/dashboard/format";
import enMessages from "@/messages/en.json";
import arMessages from "@/messages/ar.json";

const START = "2026-09-20 08:00:00";
const END = "2026-09-20 10:00:00";

// Real translators built from the actual message files -- the same
// "Dashboard" namespace every caller (DayCard, UpcomingSessionCard,
// DayContextHeader, TaskList) passes in, so these tests exercise the
// real `timeRange` templates, not a stand-in.
const tEn = createTranslator({ locale: "en", messages: enMessages, namespace: "Dashboard" });
const tAr = createTranslator({ locale: "ar", messages: arMessages, namespace: "Dashboard" });

describe("formatTimeRange", () => {
  it("converts UTC instants into the user's IANA zone", () => {
    expect(formatTimeRange(START, END, "en", "Asia/Riyadh", tEn)).toBe("11:00 – 13:00");
    expect(formatTimeRange(START, END, "en", "UTC", tEn)).toBe("08:00 – 10:00");
  });

  it("uses Western digits in Arabic", () => {
    expect(formatTimeRange(START, END, "ar", "Asia/Riyadh", tAr)).toContain("11:00");
  });

  it("joins Arabic with explicit 'من ... إلى ...' wording, not a bare dash (avoids RTL/bidi digit reordering)", () => {
    expect(formatTimeRange(START, END, "ar", "Asia/Riyadh", tAr)).toBe("من 11:00 إلى 13:00");
  });

  it("falls back to the browser zone when tz is unset, never throwing", () => {
    expect(formatTimeRange(START, END, "en", null, tEn)).toMatch(/^\d{2}:\d{2} – \d{2}:\d{2}$/);
    expect(formatTimeRange(START, END, "en", undefined, tEn)).toMatch(/^\d{2}:\d{2} – \d{2}:\d{2}$/);
  });

  it("degrades on an invalid stored zone instead of throwing a RangeError", () => {
    expect(() => formatTimeRange(START, END, "en", "Not/AZone", tEn)).not.toThrow();
  });

  it("returns null when either bound is missing", () => {
    expect(formatTimeRange(null, END, "en", "UTC", tEn)).toBeNull();
    expect(formatTimeRange(START, null, "en", "UTC", tEn)).toBeNull();
  });
});
