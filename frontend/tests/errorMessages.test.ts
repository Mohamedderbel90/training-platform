import { describe, it, expect } from "vitest";
import { ApiError } from "@/lib/api/client";
import { errorTitleKey, isClientOnlyError, clientOnlyMessageKey } from "@/lib/api/errorMessages";

function err(code: string) {
  return new ApiError({ code, message: "x", fields: null }, 0, "req_1");
}

describe("error code -> UI mapping", () => {
  it.each([
    ["UNAUTHENTICATED", "titleUnauthenticated"],
    ["FORBIDDEN", "titleForbidden"],
    ["NOT_FOUND", "titleNotFound"],
    ["VALIDATION_ERROR", "titleValidation"],
    ["CONFLICT", "titleConflict"],
    ["RATE_LIMITED", "titleRateLimited"],
    ["NETWORK_ERROR", "titleNetwork"],
    ["BAD_RESPONSE", "titleInternal"],
    ["INTERNAL_ERROR", "titleInternal"],
    ["SOMETHING_UNKNOWN", "titleGeneric"],
  ])("maps code %s to title key %s", (code, key) => {
    expect(errorTitleKey(err(code))).toBe(key);
  });

  it("treats NETWORK_ERROR and BAD_RESPONSE as client-only (never server-localized)", () => {
    expect(isClientOnlyError(err("NETWORK_ERROR"))).toBe(true);
    expect(isClientOnlyError(err("BAD_RESPONSE"))).toBe(true);
    expect(isClientOnlyError(err("VALIDATION_ERROR"))).toBe(false);
    expect(isClientOnlyError(err("FORBIDDEN"))).toBe(false);
  });

  it("picks the right client-only message key per code", () => {
    expect(clientOnlyMessageKey(err("NETWORK_ERROR"))).toBe("network");
    expect(clientOnlyMessageKey(err("BAD_RESPONSE"))).toBe("badResponse");
  });
});
