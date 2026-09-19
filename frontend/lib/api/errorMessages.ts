import { ApiError } from "./client";

/** Codes that never come from a server response, so their `message`
 * is a hardcoded literal in client.ts (there's nothing to localize
 * server-side because the server was never reached, or its response
 * couldn't even be parsed). The UI always overrides these two with a
 * translated string; every other code's `message` is already
 * localized by the server per Accept-Language (ADR-005 section 8) and
 * shown as-is. */
const CLIENT_ONLY_CODES = new Set(["NETWORK_ERROR", "BAD_RESPONSE"]);

export function isClientOnlyError(error: ApiError): boolean {
  return CLIENT_ONLY_CODES.has(error.code);
}

/** Translation key (under the "Errors" namespace) for a given error's
 * *title*. The body text is the server's own (already localized)
 * message, except for the two client-only codes above. */
export function errorTitleKey(error: ApiError): string {
  switch (error.code) {
    case "UNAUTHENTICATED":
      return "titleUnauthenticated";
    case "FORBIDDEN":
      return "titleForbidden";
    case "NOT_FOUND":
      return "titleNotFound";
    case "VALIDATION_ERROR":
      return "titleValidation";
    case "CONFLICT":
      return "titleConflict";
    case "RATE_LIMITED":
      return "titleRateLimited";
    case "NETWORK_ERROR":
      return "titleNetwork";
    case "BAD_RESPONSE":
    case "INTERNAL_ERROR":
      return "titleInternal";
    default:
      return "titleGeneric";
  }
}

/** Translation key (under "Errors") for a client-only error's body
 * text. Never called for a server-origin error -- use its own
 * `message` instead. */
export function clientOnlyMessageKey(error: ApiError): string {
  return error.code === "NETWORK_ERROR" ? "network" : "badResponse";
}
