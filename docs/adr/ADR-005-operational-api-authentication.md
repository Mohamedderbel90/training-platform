# ADR-005: Operational API Foundation and Authentication

- **Status:** Accepted
- **Date:** 2026-09-15
- **Milestone:** M4 (Operational API foundation, session authentication)
- **Related:** ADR-001, ADR-002, ADR-003, ADR-004

## Context

M4 exposes a narrow, operational-only HTTP API (`/api/v1/*`) that a
Next.js frontend uses for trainee/supervisor/trainer workflows. Admin
CRUD, the survey builder, and the M3 day-workflow actions
(`action_open`/`close`/`reopen`/`postpone`/`cancel`) remain exclusively
in Odoo Back-office — this API never exposes them. This ADR records
the authentication architecture, the verified Odoo 19 runtime behavior
it relies on, and the API-wide conventions (envelope, request
correlation, locale, DTOs, idempotency).

## 1. Why Odoo-Native Session Authentication (Not a Custom JWT)

Odoo 19's own session mechanism (`request.session`, the `session_id`
cookie, `ir.http._authenticate`/`_auth_method_user`) already provides
everything an operational SPA session needs: login, logout, expiry,
and per-request user/company/context resolution — all backed by Odoo's
own `ir.rule`/ACL enforcement, which must stay authoritative regardless
of which HTTP layer sits in front of it. Introducing a parallel JWT/
token store would duplicate that state, create a second source of
truth for "who is this user," and add an entire class of bugs (token
revocation, refresh, drift between the two auth systems) for no
capability this project actually needs. Nothing verified about the
Odoo 19 runtime (see below) makes sessions unsuitable, so no custom
scheme was built.

## 2. Verified Odoo 19 Session/Cookie Behavior

Verified directly against `odoo/http.py` in the vendored Odoo 19 source
(`.odoo-core/odoo/http.py`), not assumed:

- **Cookie:** name `session_id`, set via
  `future_response.set_cookie('session_id', sid, max_age=..., httponly=True)`.
  Only `HttpOnly` is set by Odoo itself — **no `Secure`, no
  `SameSite`** attribute is added by the framework.
- **Login:** `request.session.authenticate(env, credential)` with
  `credential = {"login": ..., "password": ..., "type": "password"}`;
  a bad credential raises `AccessDenied` (mapped to 401
  `UNAUTHENTICATED` here, not Odoo's default handling).
  `res.users._assert_can_auth`'s built-in login-cooldown throttling
  applies unconditionally underneath — no separate rate limiting was
  added for M4.
- **Logout:** `request.session.logout(keep_db=True)`.
- **Expiry:** an `auth="user"` route with no/expired session raises
  `SessionExpiredException` from `ir.http._auth_method_user` — **during
  Odoo's own pre-dispatch authentication, before the routed controller
  method or any decorator wrapping it ever runs.** Odoo's own
  `http_status` for this exception is 403 (`HTTPStatus.FORBIDDEN`);
  this API deliberately remaps it to 401 `UNAUTHENTICATED`, the more
  conventional REST meaning for "no/expired session," and what
  PROJECT_SPEC's error-code list expects.

**Consequence for this project's design:** because pre-dispatch
authentication failures never reach a controller, no controller-level
decorator (`@handle_api_errors`) can catch them. This is why
`models/ir_http.py` overrides `ir.http._handle_error` — the only hook
Odoo provides that sees these exceptions — to route them through the
same `{data, meta, error}` envelope as every other error. Without this
override, an unauthenticated request to any `auth="user"` route falls
through to Odoo's default `Json2Dispatcher` error handling, which
returns a raw `serialize_exception()` body **including a full Python
traceback in a `"debug"` key** — verified live via curl during
implementation. This would have leaked internal file paths and
implementation details to any anonymous caller; it is fixed by the
override, and `test_me_without_session_returns_clean_401` /
`test_unauthenticated_with_bare_language_header_returns_clean_401`
assert no `"debug"`/`"Traceback"` ever appears in an API response.

## 3. Locale in the Pre-Dispatch Error Path (Runtime Finding)

A second, related runtime behavior was found live and had to be
designed around: Odoo's own `Request.default_lang()`
(`odoo/http.py`) computes a *default* context language for a
not-yet-authenticated request directly from the raw `Accept-Language`
header, using `babel.core.parse_locale`/`babel.core.LOCALE_ALIASES` —
**before any of this project's own code runs.** A bare `"ar"` header is
expanded by babel to `"ar_SY"`, not `"ar_001"` (the only Arabic locale
this project actually installs). Merely *reading* `request.env.lang`
in that state raises `UserError("Invalid language code: ar_SY")`
(`odoo/orm/environments.py`), and since the global `_()` translation
helper reads `request.env.lang` internally
(`odoo/tools/translate.py:_get_lang`), this exception can fire **while
building the very error envelope for a pre-dispatch authentication
failure** — reproducing the same traceback-leak problem the
`ir.http._handle_error` override exists to prevent, via a different
trigger.

**Fix:** `apply_request_locale()` (`api_common.py`) is unconditional,
never a no-op: it always ends by setting the request context's `lang`
to an installed, active language — the mapped `ar_001`/`en_US` for a
recognized `Accept-Language`, or `en_US` (Odoo's own base language,
always installed) for anything unrecognized or not currently
active/installed — rather than ever leaving whatever Odoo's own
request layer guessed in place. `IrHttp._handle_error` calls it before
`build_error_response()`, exactly like the `@handle_api_errors`
decorator does for the controller path, so both error-producing paths
resolve locale identically.
`test_unauthenticated_with_bare_language_header_returns_clean_401` and
`test_unauthenticated_with_unrecognized_language_header_returns_clean_401`
cover this directly.

## 4. CSRF

Verified: `validate_csrf()` is only ever called inside
`HttpDispatcher.dispatch()`, i.e. for `type="http"` (form-encoded)
routes. It is never invoked by `Json2Dispatcher` or
`JsonRPCDispatcher`. Every route in this API uses `type="json2"`
(Odoo 19's plain-JSON dispatcher, distinct from the older
JSON-RPC-2.0-enveloped `type="jsonrpc"`), so **Odoo's CSRF token
mechanism is architecturally irrelevant to this API** — there is no
token to generate, send, or validate, and no route disables CSRF
protection globally or otherwise, because there is nothing to disable
for these routes. Protection against cross-site request forgery for
this API instead comes from same-origin deployment (below) plus the
browser's own preflight behavior for `application/json` requests.

## 5. CORS and the Same-Origin Deployment Requirement

Verified: Odoo's `cors` route parameter only ever sets
`Access-Control-Allow-Origin` / `Access-Control-Allow-Methods`; it
never sets `Access-Control-Allow-Credentials`. A credentialed
cross-origin request (one that needs the session cookie) cannot work
through Odoo's built-in CORS mechanism regardless of configuration.
Combined with the cookie having no `SameSite` attribute (section 2),
true cross-origin cookie auth is not a safe or even fully functional
option here.

**Decision:** no route in this API sets `cors=`. The required
deployment shape is **same-origin**: Next.js reverse-proxies
`/api/v1/*` to Odoo (e.g. `next.config.ts` rewrites, or an
edge/reverse-proxy in front of both), so the browser only ever talks
to one origin. Under same-origin, the cookie's browser-default
`SameSite=Lax` is sufficient, and no CORS configuration is needed at
all. **This is a documented deployment assumption, not yet wired up in
this milestone** — M4 delivers the Odoo-side API only; the Next.js
proxy configuration is unresolved work for a later milestone (see
"Unresolved items for M5").

## 6. Request Correlation

`api_common.get_or_create_request_id()`: accepts an incoming
`X-Request-ID` header if it matches `^[A-Za-z0-9._-]{1,128}$`;
otherwise generates `req_<32 hex chars>`. The same ID is returned in
`meta.request_id`, echoed back as the `X-Request-ID` response header,
and included in the one `_logger.exception(...)` call for unmapped
errors — one shared utility, used by every controller via
`handle_api_errors` (and by `IrHttp._handle_error` for the pre-dispatch
path). An invalid/unsafe incoming value is never echoed back
unsanitized; a fresh ID is generated instead
(`test_request_id_generated_when_invalid`).

## 7. Response Envelope and Error Mapping

Every response is `{"data": ..., "meta": {"request_id": ...}, "error": null}`
on success or `{"data": null, "meta": {...}, "error": {"code", "message", "fields"}}`
on failure. `build_error_response()` maps:

| Exception | HTTP status | code |
|---|---|---|
| `SessionExpiredException` | 401 (remapped from Odoo's 403) | `UNAUTHENTICATED` |
| `ValidationError` | 422 | `VALIDATION_ERROR` |
| `LockError` | 409 | `CONFLICT` |
| `MissingError` | 404 | `NOT_FOUND` |
| `AccessError` / `AccessDenied` | 403 | `FORBIDDEN` |
| `UserError` (generic) | 400 (deliberate business-decision remap, not Odoo's 422) | `BAD_REQUEST` |
| `werkzeug.exceptions.HTTPException` (unmatched route, bad method) | its own code | mapped via `_HTTP_STATUS_TO_CODE` |
| anything else | 500 | `INTERNAL_ERROR` |

No stack trace or internal ORM detail is ever included. A second,
narrower runtime finding drove one more rule: Odoo's own `ir.rule`
-denial `AccessError` carries a long, whimsically worded,
multi-paragraph default message that names the internal Odoo model
(verified live: a supervisor requesting an unassigned day got a
multi-line message naming `training.day`). `build_error_response`
therefore replaces any `AccessError` message containing a newline or
exceeding 200 characters with a generic translated message, while
passing this project's own short, single-line `AccessError` messages
(e.g. "You are not enrolled in this training day's program.") through
verbatim — they're useful and don't leak anything.

## 8. Locale (Accept-Language)

`Accept-Language: ar` / `en` (primary subtag only, case-insensitive) is
mapped to Odoo's `ar_001` / `en_US` and applied via
`request.update_context(lang=...)`, which the global `_()` picks up
automatically (verified via `odoo/tools/translate.py:_get_lang`, which
checks `request.env.lang` even inside plain functions with no `self`).
This only affects translated *message text*; it never affects stored
data, `rating_value` mappings, or any other business calculation
(ADR-004). See section 3 for why this resolution is unconditional
rather than conditional on recognizing the header.

All user-facing strings across the whole addon — not just M4's new
code — were swept and wrapped in `_()` for this milestone, including
two pre-existing gaps from M1 (`training_program.py`,
`training_course.py`, `training_enrollment.py`, `training_attendance.py`
each had at least one unwrapped literal). `models.Constraint(...)`
messages were deliberately **not** wrapped in Python `_()`: Odoo core
defines `ir.model.constraint.message` as a `translate=True` field
(`odoo/addons/base/models/ir_model.py`), meaning these messages go
through Odoo's own field-translation infrastructure (translated per
the module's `.po` file against the stored `ir.model.constraint`
record), not a Python-level call evaluated once at class-definition
time — wrapping them in `_()` would be incorrect there.

## 9. Role and Capability Resolution

`res.users._get_operational_roles()` (`models/res_users.py`) derives
roles **only** from Odoo group membership (`has_group()` against
`group_training_{trainee,supervisor,trainer,admin,assistant_admin}`).
No endpoint accepts or trusts a client-supplied role; every controller
calls `_require_<role>()`/`_require_role(role)` which checks group
membership server-side before doing anything else — verified by
`test_client_supplied_role_is_ignored` style checks in
`test_operational_api_security.py`. `_get_operational_capabilities()`
maps each role to a small, fixed capability-tag list
(`CAPABILITIES_BY_ROLE`) for the frontend's own routing/rendering
decisions; `admin`/`assistant_admin` intentionally have no capability
tags here since those roles work from Odoo Back-office, not this API.

## 10. Endpoints Implemented

All under `/api/v1`, all `type="json2"`:

- **Auth:** `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`.
  Password recovery was **not** implemented — deferred (see
  "Unresolved items for M5"): no verified, safe-to-thin-wrap standard
  Odoo recovery flow was confirmed suitable for this API's constraints
  in the time available for this milestone, and building a new one
  from scratch was out of scope for M4.
- **Dashboards:** `GET /dashboard/trainee`, `GET /dashboard/supervisor`,
  `GET /dashboard/trainer`. No admin dashboard route exists.
- **Trainee:** `GET .../my-survey`, `GET .../my-survey/status`,
  `POST .../my-survey/submit`.
- **Supervisor:** `GET`/`PUT .../attendance`, `GET .../supervisor-survey`,
  `POST .../supervisor-survey/submit`.
- **Trainer:** `GET .../trainer-report`, `PUT .../trainer-report/draft`,
  `POST .../trainer-report/submit`.

No generic ORM endpoint exists (no client-supplied model name/domain
is ever accepted), no admin CRUD endpoint exists (programs, courses,
training-day config, users, enrollments, survey builder, notification
settings, report approval, audit), and none of M3's day-workflow
actions (`action_open`/`close`/`reopen`/`postpone`/`cancel`) are
exposed — all confirmed absent (404) by
`test_operational_api_security.py`.

## 11. DTO / Serializer Layer

Every endpoint returns an explicit DTO built by a dedicated
`_get_*_dto()` method — never a raw `model.read()`. Documented
frontend-vs-Odoo name mappings:

| API name | Odoo field/state |
|---|---|
| `state: "not_started" / "in_progress" / "submitted"` | `survey.user_input.state: "new" / "in_progress" / "done"` |
| `trainee_id` (in attendance DTOs) | `training.attendance.enrollment_id` (a `training.enrollment` id, **not** `res.partner.id`) |
| `answer_option_id` | `survey.user_input.line.suggested_answer_id` |

`training.day.get_dashboard(role)` relies entirely on the M1 record
rules on `training.day` (assigned-only for supervisor/trainer,
enrolled-program-only for trainee) to scope the list — no duplicate
ownership filtering exists in the dashboard method itself. Supervisor
and trainer dashboard entries never include `answers`; only the
trainee's own survey endpoints and the trainer's own report endpoint
ever return answer content, and only for that same user's own
response (`test_supervisor_cannot_view_detailed_trainee_responses`,
`test_trainer_cannot_view_detailed_trainee_responses`).

## 12. Idempotency

Chosen strategy (per M4 point 14): **robust server-side
uniqueness/state**, not an `Idempotency-Key` header.
`training.day.submit_survey_response(role, answers, user)` first looks
up the existing `(training_day_id, respondent_role, partner_id)`
response (unique per ADR-003); if it is already `state == "done"`, it
is returned **unchanged**, without re-applying the submitted answers
and without raising a conflict. Verified live: a second submit call
with different answers than the first did not alter the stored final
response. The same uniqueness constraint that ADR-003 already enforces
at the database level is what makes this safe under concurrent
retries, not application-level locking.

## 13. Analytics Exposure

No general admin analytics endpoint exists. Only the minimal aggregate
status already authorized for a role's own dashboard
(`_get_attendance_summary`'s `recorded_count`/`total_enrolled`/
`complete`, and each role's own `get_survey_status`) is exposed; no
controller calls `training.analytics` directly or re-derives any KPI
formula — that module (ADR-004) remains exclusively a Back-office
reporting concern in this milestone.

## 14. Security Test Coverage

`test_operational_api_security.py`,
`test_operational_api_{auth,dashboards,trainee,supervisor,trainer}.py`
cover: unauthenticated → 401 across endpoint types; cross-trainee /
cross-supervisor / cross-trainer access denied; wrong-role access
denied (403); supervisor/trainer access to an unassigned day denied
(403, via the underlying M1 record rule); no detailed trainee survey
answers ever reach a supervisor/trainer response; every listed
admin-CRUD path and the generic-ORM path return 404; workflow actions
are not reachable via HTTP; a trainee cannot write attendance (403
before any model-level check even runs, since role is checked first).

## Test Results

161 tests, 0 failed, 0 errors, run against a real Odoo 19 instance and
PostgreSQL database (`scripts/run_schema_smoke_test.sh`) — covering
M0 through M4 in one suite. i18n verified end-to-end: `ar.po`
regenerated for all newly-wrapped strings, loaded into a real database
via `odoo-bin i18n loadlang`/`import`, and confirmed live via curl that
`Accept-Language: ar` vs `en` now produce genuinely different,
correctly translated text (previously identical — a real bug fixed in
this milestone).
