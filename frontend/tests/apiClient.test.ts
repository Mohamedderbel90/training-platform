import { describe, it, expect, vi, afterEach } from "vitest";
import { apiFetch, ApiError } from "@/lib/api/client";

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

describe("apiFetch (envelope/error handling)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns data on a success envelope", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          { data: { id: 1 }, meta: { request_id: "req_abc" }, error: null },
          { headers: { "Content-Type": "application/json", "X-Request-ID": "req_abc" } },
        ),
      ),
    );
    const result = await apiFetch<{ id: number }>("/auth/me");
    expect(result).toEqual({ id: 1 });
  });

  it("sends Accept-Language derived from the given locale, never a hardcoded value", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ data: {}, meta: { request_id: "r" }, error: null }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await apiFetch("/auth/me", { locale: "ar" });
    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Record<string, string>)["Accept-Language"]).toBe("ar");
  });

  it("throws ApiError with the server's code/message/fields on an error envelope", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            data: null,
            meta: { request_id: "req_1" },
            error: { code: "VALIDATION_ERROR", message: "login and password are required.", fields: { login: ["This field is required."] } },
          },
          { status: 422 },
        ),
      ),
    );
    await expect(apiFetch("/auth/login", { method: "POST" })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      status: 422,
      fields: { login: ["This field is required."] },
    });
  });

  it("maps a 401 UNAUTHENTICATED error envelope to ApiError with that code", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            data: null,
            meta: { request_id: "req_2" },
            error: { code: "UNAUTHENTICATED", message: "Your session has expired.", fields: null },
          },
          { status: 401 },
        ),
      ),
    );
    let caught: unknown;
    try {
      await apiFetch("/auth/me");
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).code).toBe("UNAUTHENTICATED");
    expect((caught as ApiError).status).toBe(401);
  });

  it("maps a 403 FORBIDDEN error envelope to ApiError with that code", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            data: null,
            meta: { request_id: "req_3" },
            error: { code: "FORBIDDEN", message: "You do not have permission to access this resource.", fields: null },
          },
          { status: 403 },
        ),
      ),
    );
    await expect(apiFetch("/dashboard/trainer")).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });

  it("produces a NETWORK_ERROR ApiError when fetch itself rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(apiFetch("/auth/me")).rejects.toMatchObject({ code: "NETWORK_ERROR" });
  });

  it("produces a BAD_RESPONSE ApiError when the response body isn't valid JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("<html>not json</html>", { status: 502 })),
    );
    await expect(apiFetch("/auth/me")).rejects.toMatchObject({ code: "BAD_RESPONSE", status: 502 });
  });

  it("surfaces the request ID from the response header for diagnostics", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          { data: null, meta: { request_id: "req_body" }, error: { code: "NOT_FOUND", message: "x", fields: null } },
          { status: 404, headers: { "Content-Type": "application/json", "X-Request-ID": "req_header" } },
        ),
      ),
    );
    let caught: ApiError | undefined;
    try {
      await apiFetch("/x");
    } catch (err) {
      caught = err as ApiError;
    }
    expect(caught?.requestId).toBe("req_header");
  });
});
