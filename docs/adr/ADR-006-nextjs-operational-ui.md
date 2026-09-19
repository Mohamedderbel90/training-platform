# ADR-006: Next.js Operational UI (Trainee/Supervisor/Trainer)

- **Status:** Accepted
- **Date:** 2026-09-15
- **Milestone:** M5 (Next.js operational UI consuming the M4 API)
- **Related:** ADR-005 (Operational API authentication)

## Context

M5 builds the real trainee/supervisor/trainer screens in the Next.js
frontend, consuming the `/api/v1/*` Operational API delivered in M4.
ADR-005 already established that a same-origin deployment is a hard
requirement (Odoo's session cookie has no `SameSite`/`Secure`
attribute, and its CORS mechanism cannot set
`Access-Control-Allow-Credentials`, so a genuinely cross-origin browser
session is not viable). M5's first job is therefore wiring the
same-origin proxy itself, then building the UI on top of it. No admin
CRUD, survey builder, notifications, reports, or audit UI exist here —
those remain Odoo Back-office only (PROJECT_SPEC section 2.1).

## 1. Same-Origin Proxy Architecture

`frontend/next.config.ts` adds:

```ts
async rewrites() {
  return [
    { source: "/api/v1/:path*", destination: `${ODOO_INTERNAL_BASE_URL}/api/v1/:path*` },
  ];
}
```

`ODOO_INTERNAL_BASE_URL` is a **server-only** env var (no
`NEXT_PUBLIC_` prefix, set in `env/frontend.env.example` /
`frontend/.env.local`, default `http://localhost:8069`) — the browser
never sees or needs Odoo's real address. Next.js's `rewrites()` with an
external destination is documented, standard behavior (verified
against the vendored Next 16 docs at
`frontend/node_modules/next/dist/docs/.../rewrites.md`, "Rewriting to
an external URL"): the Next.js server itself forwards the full
incoming request (method, headers, body) to the destination and
streams the response back, including `Set-Cookie`. It is a true
reverse proxy at the HTTP layer, not a client-side redirect.

**Verified live** (curl through `http://localhost:3100` proxying to a
real Odoo instance on `:8069`, both against a freshly seeded dev
database):
- `POST /api/v1/auth/login` through the proxy returns Odoo's
  `Set-Cookie: session_id=...; HttpOnly; ...` header, and the cookie
  lands in the *browser's* jar scoped to the Next.js origin (verified
  with a curl cookie jar reused across requests).
- A subsequent `GET /api/v1/auth/me` through the proxy, using only that
  cookie, succeeds — proving the session round-trips correctly through
  the proxy exactly as it would through a same-origin browser fetch.
- The identical request sent **directly to Odoo's own port** (bypassing
  the proxy) with no cookie returns 401 — proving there is no
  accidental bypass and the proxy is the only path the app is designed
  to use.
- `POST .../logout` through the proxy, followed by `GET .../auth/me`
  with the same (now-invalidated) cookie, returns 401.
- A full trainee survey submit, a supervisor attendance upsert, and a
  trainer draft save were all exercised end-to-end through the proxy
  against the real API, confirming the DTO shapes documented below
  match the live backend exactly.

**Why this satisfies the M5 requirements:** the browser only ever
talks to the Next.js origin; Odoo is never exposed cross-origin to the
browser; no wildcard CORS exists anywhere (none is needed); no JWT was
introduced; `X-Request-ID` and `Accept-Language` are ordinary request
headers, forwarded by the proxy like any other header, and are
generated/set explicitly by `lib/api/client.ts` (see section 4) rather
than relying on anything proxy-specific.

**Not yet done:** production hardening of the proxy target (e.g.
TLS between Next.js and Odoo, or running both behind a single edge
reverse proxy instead of Next.js's own rewrite) is not addressed here
— this milestone only establishes the same-origin contract for local
development and matches ADR-005's documented assumption.

## 2. Authentication UI

- `lib/auth/AuthContext.tsx`: the **only** frontend session state.
  Holds exactly what `GET /api/v1/auth/me` returns (id, partner_id,
  name, locale, roles, capabilities) — never a password or token, so
  there is no second credential store (M5's explicit constraint).
  Bootstraps on mount (and whenever the active locale changes) by
  calling `authApi.me()`; any failure — expired session or a network
  error — is treated as `"unauthenticated"` for routing purposes.
  `login()`/`logout()` call the corresponding endpoints and update this
  same state; nothing else mutates it.
- `app/[locale]/login/page.tsx`: username/password form. Shows the
  server's own already-localized message on 401 (`Invalid login or
  password.`) and per-field messages from a 422's `fields` map. Reads
  an optional `?returnTo=` query param (validated to start with `/`
  and not `//`, to rule out an open redirect) and, on success, sends
  the user there instead of their role's default dashboard.
  `useSearchParams()` requires its own `<Suspense>` boundary during
  static generation (a real `next build` failure encountered and fixed
  during implementation, not a hypothetical) — the page's default
  export is a thin `<Suspense>` wrapper around the actual `LoginForm`.
- `lib/auth/ProtectedRoute.tsx`: wraps every trainee/supervisor/trainer
  page. `status === "unauthenticated"` → `router.replace("/login?returnTo=...")`
  with the current (locale-stripped) path. Wrong role → a "forbidden"
  state with a link to the user's own dashboard, never the page's real
  content. **This is UX only** — see section 8.
- Logout (`AppShell`'s user-menu button) calls `logout()` then
  navigates to `/login`.

## 3. Global App Shell

`components/AppShell.tsx` + `app/globals.css`: sticky header with the
app name, a role-derived nav (`trainee`/`supervisor`/`trainer` items,
only for roles the authenticated user actually has — never
client-decided), a locale switch (`ar`/`en`, each an `<a>` via
`next-intl`'s `Link` with the other locale, `aria-current` on the
active one), and a user-menu/logout button once authenticated. A
`skip-to-content` link, a `visually-hidden` utility class (CSS-clipped,
not `aria-hidden`, so screen readers still get it), and semantic
`<nav aria-label>` landmarks cover the accessibility requirements
(section 10). Mobile-first: the nav collapses behind a `Menu` toggle
under 640px (`app/globals.css`'s `@media (max-width: 640px)` block);
layout uses `flex-wrap` and relative units throughout, no fixed
pixel-width breakpints wider than the smallest supported viewport.
RTL/LTR is not a separate stylesheet: the existing M0 mechanism
(`app/[locale]/layout.tsx`'s `DIRECTION_BY_LOCALE` setting `dir` on
`<html>`) is unchanged and still the single source of truth; all of
this milestone's CSS uses logical properties (`inset-inline-start`,
`margin-inline`, `padding-inline`) so it flips automatically with
`dir`, verified live via curl (`<html lang="ar" dir="rtl">` /
`<html lang="en" dir="ltr">`, with the correct localized heading text
in each).

Loading/empty/error states are three shared components
(`components/StateViews.tsx`: `LoadingState`, `EmptyState`,
`ErrorState`) used everywhere, plus `components/ApiErrorView.tsx`,
which maps any `ApiError` to a translated title + the server's own
already-localized message + the request ID (for support/diagnostics) +
an optional retry action — see section 9.

## 4. Shared API Client

`lib/api/client.ts`'s `apiFetch()` is the **only** place any code calls
`fetch()` against `/api/v1/*`:
- Unwraps `{data, meta, error}` (ADR-005 section 7); throws a typed
  `ApiError` (`code`, `status`, `fields`, `requestId`) for any
  non-success outcome, including two client-only outcomes that never
  reach the server at all (`NETWORK_ERROR` for a failed `fetch()`,
  `BAD_RESPONSE` for a non-JSON body) — kept as distinct codes so the
  UI never treats a client-generated English literal as a
  server-localized message (see `lib/api/errorMessages.ts`).
- Generates its own `X-Request-ID` per call (`req_<hex>`) and reads
  back whichever ID the response actually carries (server may echo or
  replace it, per ADR-005 section 6), surfacing it via `ApiError.requestId`
  for the error views.
- Sends `Accept-Language` from an explicit `locale` parameter — every
  call site passes the current `next-intl` locale, never relying on
  the browser's own header.
- Uses `credentials: "same-origin"` (the default is already adequate
  under the same-origin proxy, made explicit for clarity).

`lib/api/endpoints.ts` is a 1:1 typed wrapper per controller in
`custom_addons/training_management/controllers/*.py` (`authApi`,
`dashboardApi`, `traineeApi`, `supervisorApi`, `trainerApi`) — no
component builds a URL or a request body by hand, and there is
deliberately no generic/dynamic endpoint helper, matching the API's
own "no generic ORM endpoint" design. `lib/api/types.ts` mirrors the
addon's `_get_*_dto()` shapes exactly (verified against the model code
and live responses, not guessed), including the documented
frontend-vs-Odoo name mappings from ADR-005 section 11
(`state: "submitted"` ↔ Odoo `done`, `trainee_id` ↔
`training.enrollment.id`, `answer_option_id` ↔ `suggested_answer_id`).

`lib/api/useApiResource.ts` is the shared GET-loading-state hook
(loading/success/error + `reload()`) every dashboard/detail page uses;
a discovered `UNAUTHENTICATED` error also triggers `AuthContext`'s own
re-check, so a session that expired mid-session flips the whole app to
`"unauthenticated"` and `ProtectedRoute` redirects, rather than leaving
a stale authenticated shell around a page that can no longer load data.

## 5. Trainee Flow

- `GET /api/v1/dashboard/trainee` → `app/[locale]/trainee/page.tsx`:
  one card per training day (course/program name, day state,
  survey-availability badge), linking to the day's survey page.
- `app/[locale]/trainee/[dayId]/page.tsx` (`TraineeSurveyContent`):
  calls `GET .../my-survey/status` first; if already `submitted`, shows
  a read-only "Thank you" card **without** ever fetching or rendering
  the question form (there is nothing to re-display — see the M4 gap
  noted in section 12). Otherwise fetches `GET .../my-survey` and
  renders `SurveyForm`. Final `POST .../my-survey/submit` flips
  straight to the same read-only card — no intermediate "editable"
  state exists for a submitted trainee response, matching the API
  (there is no trainee draft/save endpoint at all, only single-shot
  submit).

## 6. Supervisor Flow

- `GET /api/v1/dashboard/supervisor` → dashboard cards with an
  attendance-progress line (`recorded/total`, a "Complete" badge) and
  the supervisor's own evaluation-survey status, linking to
  `.../attendance` and `.../survey`.
- `app/[locale]/supervisor/[dayId]/attendance/page.tsx`
  (`AttendanceContent`): one row per actively enrolled trainee
  (`GET .../attendance`), a present/absent/late radio group per row, a
  late-minutes number input that only appears once "Late" is selected
  (and is reset to 0 when switching away from Late), and a single bulk
  "Save attendance" that sends every row via `PUT .../attendance` in
  one call. A 422 (e.g. an invalid enrollment or status) is shown via
  `ApiErrorView`, never swallowed.
- `app/[locale]/supervisor/[dayId]/survey/page.tsx`
  (`SupervisorSurveyContent`): same submit flow as the trainee page,
  but see section 12 for a documented API asymmetry this page has to
  work around (no dedicated status endpoint for this role).

## 7. Trainer Flow

- `GET /api/v1/dashboard/trainer` → dashboard cards with the trainer's
  own report-status badge, linking to `.../trainer-report`.
- `app/[locale]/trainer/[dayId]/page.tsx` (`TrainerReportContent`):
  the only role with a single combined endpoint
  (`GET .../trainer-report` → `{definition, status, answers}`), so this
  page needs no dashboard-lookup workaround. `answers` (when present)
  pre-fills `SurveyForm` so a previously saved draft resumes exactly
  where it was left. `PUT .../trainer-report/draft` saves without
  finalizing (still editable, "Draft saved" notice); `POST
  .../trainer-report/submit` finalizes and the page reloads into the
  read-only state with no `Save draft`/`Submit` controls. Each
  assigned trainer only ever sees and edits their own response — the
  server's own `(training_day_id, respondent_role, partner_id)`
  uniqueness (ADR-003) is what actually enforces this; the frontend
  does nothing extra to isolate co-trainers.

## 8. Form Architecture

**No form library (React Hook Form + Zod) was added.** The one
genuinely complex form in this app — a survey — has no static schema
at build time: its shape (sections, questions, types, options,
required flags) comes entirely from the API's
`SurveyDefinitionDto` at runtime. A schema-first validation library
like Zod is built around validating against a schema known ahead of
time; using it here would mean either generating a schema from the
DTO at runtime (adding real complexity for no behavioral gain) or not
actually using its type-safety benefit at all. `components/SurveyForm.tsx`
is instead a small, hand-rolled controlled-component form: one
`Record<question_id, answer>` state map, a `computeMissing()` check
against each question's own `required` flag, and one submit
confirmation step. This is intentionally the **same** approach used
for the one static form in the app (`login/page.tsx`'s
username/password fields) — consistency was chosen over introducing a
library for only part of the app. Client-side required-question
checking is UX only: it stops an obviously-incomplete submit before a
round trip, but every submit still goes through the server's own
mandatory-answer check (ADR-003), and any resulting server
`VALIDATION_ERROR` is always shown via `ApiErrorView`/the error
summary — never silently discarded.

## 9. UI Behavior / Error Handling

Every data-fetching page distinguishes, and never silently
swallows: `loading` (`LoadingState`), `success`, and `error`
(`ApiErrorView`, with a `retry` action wired to the same fetch). Within
`error`, the specific code drives what's shown: `UNAUTHENTICATED` also
triggers `AuthContext.refresh()` (→ redirect via `ProtectedRoute`),
`FORBIDDEN`/`NOT_FOUND`/`CONFLICT`/`VALIDATION_ERROR` all render with
their own translated title and the server's own message body.
"Already submitted" is not a distinct error path in this API (ADR-005
section 12's idempotent-submit design means a repeat submit returns
the existing final response, not a 409) — the UI reflects this by
simply re-rendering the same read-only state, not by handling a
conflict error. `Attendance`/`Survey` empty states (`EmptyState`) cover
"no enrolled trainees" and "no training days" without ever presenting
a blank page with no explanation.

## 10. Accessibility

Every form control has a real `<label htmlFor>` (or `aria-label` for
a grouped radio/checkbox set); required questions are marked with an
`aria-hidden` visual `*` **plus** a non-`aria-hidden`,
visually-hidden "(required)" text so the accessible name itself states
the requirement, not just a color/glyph. Missing-required-answer
submission produces an `role="alert"` error summary listing each
unanswered question as a same-page anchor link (`#question-<id>`), the
standard "accessible error summary" pattern. All interactive controls
are native `<button>`/`<input>`/`<label>` elements (no `<div
onClick>`), so keyboard operation and focus order come for free from
the browser; `:focus-visible` gets an explicit, high-contrast outline
in `globals.css` rather than relying on (or suppressing) the browser
default. Layout uses logical CSS properties throughout so it is
RTL-safe without a parallel RTL stylesheet (section 3).

## 11. Frontend Security Boundary

The frontend enforces nothing on its own authority — `ProtectedRoute`'s
role check is UX only, exactly as M5 point 11 requires. It exists so
an unauthorized user sees a clear "you don't have access" message
instead of a page that immediately errors out control-by-control, not
because the frontend is a trust boundary. The real boundary is
unchanged from ADR-005: Odoo's own group membership, `ir.rule` record
rules, and the API's own DTO serializers (which already scope every
response to the caller — a supervisor's dashboard entry has no
`answers` field to accidentally render, for instance). No admin
endpoint, generic ORM path, or client-supplied role is ever
constructed or trusted by any frontend code (verified by
`tests/AppShell.test.tsx`'s role-based nav-visibility test and by this
project's continued reliance on M4's own
`test_operational_api_security.py`, unchanged by this milestone).

## 12. M4 API Gaps Discovered During UI Implementation

Two real asymmetries in the M4 API surface were found while building
the UI against it (not previously visible from the controller code
alone, since M4 had no consuming frontend to expose them):

1. **No dedicated `.../supervisor-survey/status` endpoint.** The
   trainee flow has both `GET .../my-survey` (definition) and
   `GET .../my-survey/status` (availability/state), and the trainer
   flow has a single combined `GET .../trainer-report` returning both.
   The supervisor flow has only `GET .../supervisor-survey`
   (definition) and `POST .../submit` — no way to ask "what's the
   current status of my evaluation for this day" without either
   attempting a submit or independently re-deriving it. This page
   (`SupervisorSurveyContent`) works around the gap by reusing
   `GET /api/v1/dashboard/supervisor` and looking up the matching
   day's `survey` field — documented in-code and here, not silently
   worked around. A future milestone should add a
   `GET .../supervisor-survey/status` endpoint mirroring the trainee
   one, so a direct link/bookmark/refresh to the supervisor survey page
   doesn't need this workaround.
2. **No way for a trainee to retrieve their own already-submitted
   answers.** Unlike the trainer's `GET .../trainer-report` (which
   includes `answers` for resuming a draft or reviewing a final
   submission), the trainee API has no endpoint that ever returns
   answer content back to the trainee — `my-survey/status` returns only
   `{response_id, state, submitted_at, editable}`. This is why the
   trainee's post-submit screen is a plain "Thank you, submitted at …"
   card rather than a read-only rendering of the actual answers: there
   is genuinely nothing to render. If read-only self-review of a
   submitted response becomes a real product requirement, M4's trainee
   controller needs a new endpoint (or `my-survey/status` needs to grow
   an optional `answers` field) — not something this milestone's UI
   can work around on its own, since the data simply never leaves
   Odoo.

Both are scoping gaps in the already-shipped M4 API, not defects in
M4's own delivered scope (M4's brief never asked for supervisor status
or trainee answer review) — flagged here for M6+ prioritization.
