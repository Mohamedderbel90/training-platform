/**
 * Centralized Operational API client (M5). Every call in the app goes
 * through `apiFetch()` -- no component/page calls `fetch()` directly
 * against `/api/v1/*`. This is the one place that:
 *  - unwraps the `{data, meta, error}` envelope (ADR-005 section 7),
 *  - turns a non-2xx / `error` response into a typed `ApiError`,
 *  - generates a client-side `X-Request-ID` and surfaces whichever ID
 *    (client-generated or server-echoed/replaced) ends up on the
 *    response, for diagnostic display,
 *  - sends `Accept-Language` derived from the caller's current
 *    next-intl locale, never the browser's OS language.
 *
 * Requests are always same-origin (relative `/api/v1/...` paths),
 * proxied to Odoo by next.config.ts's rewrites() -- see
 * docs/adr/ADR-006-nextjs-operational-ui.md.
 */

const API_PREFIX = "/api/v1";

export interface ApiErrorPayload {
  code: string;
  message: string;
  fields: Record<string, string[]> | null;
}

/** Thrown for every non-success API outcome: a mapped Odoo exception,
 * a network failure, or an unparseable response. `code` is the stable
 * machine error code (never translated) from ADR-005 section 7; use it
 * for branching logic, and `message` (translated server-side per the
 * caller's locale) for user-facing display. */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly fields: Record<string, string[]> | null;
  readonly requestId: string | null;

  constructor(payload: ApiErrorPayload, status: number, requestId: string | null) {
    super(payload.message);
    this.name = "ApiError";
    this.code = payload.code;
    this.status = status;
    this.fields = payload.fields;
    this.requestId = requestId;
  }
}

interface Envelope<T> {
  data: T | null;
  meta: { request_id: string | null } | null;
  error: ApiErrorPayload | null;
}

function generateRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `req_${crypto.randomUUID().replace(/-/g, "")}`;
  }
  return `req_${Date.now().toString(16)}${Math.random().toString(16).slice(2, 10)}`;
}

export type ApiMethod = "GET" | "POST" | "PUT" | "DELETE";

export interface ApiRequestOptions {
  method?: ApiMethod;
  body?: unknown;
  /** Current UI locale ("ar" | "en"); forwarded as Accept-Language so
   * server-side message translation follows the UI, not the OS. */
  locale?: string;
  signal?: AbortSignal;
}

export async function apiFetch<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { method = "GET", body, locale, signal } = options;
  const requestId = generateRequestId();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Request-ID": requestId,
  };
  if (locale) {
    headers["Accept-Language"] = locale;
  }

  let response: Response;
  try {
    response = await fetch(`${API_PREFIX}${path}`, {
      method,
      headers,
      credentials: "same-origin",
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch {
    throw new ApiError(
      {
        code: "NETWORK_ERROR",
        message:
          "Unable to reach the server. Check your connection and try again.",
        fields: null,
      },
      0,
      requestId,
    );
  }

  let envelope: Envelope<T> | null = null;
  try {
    envelope = (await response.json()) as Envelope<T>;
  } catch {
    // Client-side-only outcome (never a server-localized message): the
    // response body wasn't valid JSON at all, e.g. a raw error page
    // from an intermediary in front of Next.js. Distinct code from
    // INTERNAL_ERROR (which IS a real, already-translated server
    // outcome) so callers/UI never treat this as localized text.
    throw new ApiError(
      {
        code: "BAD_RESPONSE",
        message: "The server returned an unexpected response.",
        fields: null,
      },
      response.status,
      response.headers.get("X-Request-ID") ?? requestId,
    );
  }

  const responseRequestId =
    response.headers.get("X-Request-ID") ?? envelope.meta?.request_id ?? requestId;

  if (!response.ok || envelope.error) {
    throw new ApiError(
      envelope.error ?? {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred.",
        fields: null,
      },
      response.status,
      responseRequestId,
    );
  }

  return envelope.data as T;
}
