import { describe, expect, it } from "vitest";
import { formatTimeRange } from "@/lib/dashboard/format";

const START = "2026-09-20 08:00:00";
const END = "2026-09-20 10:00:00";

describe("formatTimeRange", () => {
  it("converts UTC instants into the user's IANA zone", () => {
    expect(formatTimeRange(START, END, "en", "Asia/Riyadh")).toBe("11:00 – 13:00");
    expect(formatTimeRange(START, END, "en", "UTC")).toBe("08:00 – 10:00");
  });

  it("uses Western digits in Arabic", () => {
    expect(formatTimeRange(START, END, "ar", "Asia/Riyadh")).toBe("11:00 – 13:00");
  });

  it("falls back to the browser zone when tz is unset, never throwing", () => {
    expect(formatTimeRange(START, END, "en", null)).toMatch(/^\d{2}:\d{2} – \d{2}:\d{2}$/);
    expect(formatTimeRange(START, END, "en")).toMatch(/^\d{2}:\d{2} – \d{2}:\d{2}$/);
  });

  it("degrades on an invalid stored zone instead of throwing a RangeError", () => {
    expect(() => formatTimeRange(START, END, "en", "Not/AZone")).not.toThrow();
  });

  it("returns null when either bound is missing", () => {
    expect(formatTimeRange(null, END, "en", "UTC")).toBeNull();
    expect(formatTimeRange(START, null, "en", "UTC")).toBeNull();
  });
});
