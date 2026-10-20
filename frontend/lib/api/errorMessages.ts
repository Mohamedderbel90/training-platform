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
 * message, except for the two client-only codes above.
 *
 * `variant` mirrors `friendlyMessageKey`: on a credential/form surface
 * (login, password reset, survey submit) a 401 is a fresh, never-
 * authenticated attempt -- "session expired" would be meaningless -- so
 * it gets a neutral sign-in-failed title instead. */
export function errorTitleKey(error: ApiError, variant: "page" | "form" = "page"): string {
  switch (error.code) {
    case "UNAUTHENTICATED":
      return variant === "form" ? "titleSignInFailed" : "titleUnauthenticated";
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
    case "SERVICE_UNAVAILABLE":
      return "titleUnavailable";
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

/** Translation key (under "Errors") for the friendly body text used when
 * the server's own message must not be shown verbatim: session expiry,
 * server-side failures and unknown codes. Returns null when the
 * server's already-localized message is appropriate (403/404/validation/
 * conflict/rate limit/service unavailable -- those are deliberate,
 * user-facing messages). */
export function friendlyMessageKey(error: ApiError, variant: "page" | "form" = "page"): string | null {
  switch (error.code) {
    case "UNAUTHENTICATED":
      return variant === "page" ? "sessionExpiredMessage" : null;
    case "INTERNAL_ERROR":
      return "internalMessage";
    case "FORBIDDEN":
    case "NOT_FOUND":
    case "VALIDATION_ERROR":
    case "CONFLICT":
    case "RATE_LIMITED":
    case "SERVICE_UNAVAILABLE":
      return null;
    case "NETWORK_ERROR":
    case "BAD_RESPONSE":
      return clientOnlyMessageKey(error);
    default:
      return error.status >= 500 ? "internalMessage" : null;
  }
}
