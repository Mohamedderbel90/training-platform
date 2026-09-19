# ADR-009: Notifications and Reminder Automation

- **Status:** Accepted
- **Date:** 2026-09-16
- **Milestone:** M9 (Notifications and Reminder Automation, per `DEVELOPMENT_PLAN_v1.1_BILINGUAL.md`)
- **Related:** ADR-001, ADR-003, ADR-004, ADR-008

## Context

Before any M9 work started, the repository was checked against
`DEVELOPMENT_PLAN_v1.1_BILINGUAL.md`'s M9 section and
`PROJECT_SPEC_v1.1_BILINGUAL.md` section 16/25. No `training.notification.log`
model, no `data/` directory, no `res.config.settings` extension, and no
`ir.cron` record existed anywhere in `custom_addons/training_management/` —
M8 (per its own report) stopped at reports/approval/export. M9 is
therefore new work end to end.

PROJECT_SPEC section 25 explicitly lists the SMS provider and the
WhatsApp provider/connector as **open technical decisions**: "No
coding agent should guess provider-specific details without
configuration or an explicit decision." Combined with the current
task's own instruction ("Do not invent provider credentials or send
real messages during development. Use safe test providers or mocks"),
this milestone's entire channel-adapter design is built around a
pluggable provider *mode*, defaulting to a safe, no-network,
no-credentials "test" adapter for every non-email channel, with the
real, standard-Odoo integration path available as an explicit,
documented, opt-in production configuration that this project's own
test suite never exercises.

## 1. Why a New `training.notification.log` Model (Not Just `mail.mail`/`sms.sms`)

PROJECT_SPEC section 5 lists `training.notification.log` as "Optional
Custom -- use only if provider/mail logs cannot represent required
cross-channel delivery results." That condition is met here: `sms.sms`
(verified in `.odoo-core/addons/sms/models/sms_sms.py`) defaults to
`unlink_sent=True` in its own `send()` — it deletes itself after a
successful send, unless a mass-mailing "notification" record was
separately created — while `mail.mail` has no cross-channel concept at
all. Neither can represent one durable, retryable row per (training
day, role, respondent, channel, event) the way M9's duplicate
-prevention and retry rules need. `training.notification.log` is that
row; it links to `mail.mail` (`mail_mail_id`) for the one channel that
does have a standard, inspectable Odoo record, and stores its own
`provider_reference`/`body` for the two that do not.

A single `models.Constraint` — `unique(training_day_id,
respondent_role, partner_id, channel, event_type)` — is the actual
duplicate-prevention mechanism, at the database level, not just
application logic: `_get_or_create_log()` always looks up this exact
tuple before ever creating a row, mirroring `survey.user_input`'s own
`(training_day_id, respondent_role, partner_id)` uniqueness design
(ADR-003). A second cron run, or a retry of the same event, always
finds and updates the same row rather than ever creating a second one.

## 2. Eligibility Reuses Existing Relations, Invents No New Formula

`training.notification.log._get_pending_recipients(day)` resolves
recipients directly from the same fields M1/M2 already define
(`day.course_id.program_id.enrollment_ids` filtered to `state ==
'active'` for trainees, `day.supervisor_id`, `day.trainer_ids`) and
excludes anyone with an existing final (`state == 'done'`)
`survey.user_input` for that (day, role, partner) — the exact same
query shape `training.day.check_survey_access()` (ADR-003) already
uses to decide "has this person already submitted." PROJECT_SPEC
section 16's "Do not remind users whose required task is already
final/submitted" is satisfied by this single check, not a parallel
survey-state model.

`cron_send_reminders()` scans `training.day` for `state == 'open'` and
the current time inside `[survey_open_at, survey_close_at]` — again
the identical two conditions `check_survey_access()` already enforces
for submission itself (M2/M3), reused rather than re-derived. A role
with nothing configured (`day.trainee_survey_id` unset, etc.) is
skipped entirely, matching `check_survey_access()`'s own
"nothing configured for this role" short-circuit.

## 3. Channel Adapters: Safe by Default, Standard-First for Production

Three channels, three different levels of "standard Odoo
functionality available":

- **Email** (`_send_email()`): fully standard. `mail.template.send_mail(res_id,
  force_send=False)` queues a `mail.mail` (verified signature/behavior
  in `mail/models/mail_template.py`) without ever contacting an SMTP
  server directly from this project's own code — Odoo's own separate
  mail-queue cron is what would actually attempt delivery, and no
  outgoing mail server is configured in this development environment,
  so no real email is ever sent by running this milestone's tests or
  cron job. The one addition this project makes is a pre-flight check
  (`partner.email` must be set) that fails cleanly and logs a specific
  error before ever calling `send_mail()`, rather than letting Odoo's
  own mail pipeline discover a missing address later and less legibly.
  Unlike the "one-shot" welcome-email templates in `auth_signup`/`mail`
  (which set `auto_delete=True`), `mail_template_daily_task_reminder`
  sets `auto_delete=False` deliberately: M9 needs the resulting
  `mail.mail`'s own `state` to remain inspectable afterwards
  (`training.notification.log.mail_state`, a related field) for
  "delivery status tracking where supported" (M9 task list).
- **SMS** (`_send_sms()`): the standard `sms` module is present and
  verified on this Odoo 19 Community runtime (ADR-001), so it is
  offered as an explicit, opt-in production mode
  (`training_management.sms_provider_mode = "odoo_sms"`, `res.config.settings`),
  delegating to `sms.sms.create()` + `.send()` exactly as core does. This
  path contacts IAP over the network and is **never exercised by this
  project's automated tests** — doing so would need a real IAP
  account/credits, which the task explicitly says not to invent. The
  **default** mode (`"test"`) does no network call at all: it
  validates `partner.phone` is set (a real, meaningful failure
  condition otherwise — "Missing phone number for %s.") and, if so,
  simulates success with a `test-sms-<uuid>` reference. This is the
  mode exercised by `tests/test_training_notification.py` and the one
  active by default after installing this module.
- **WhatsApp** (`_send_whatsapp()`): no standard connector exists on
  this Community runtime — the `whatsapp` module is Enterprise-only,
  confirmed absent in ADR-001. Per PROJECT_SPEC section 16 ("otherwise
  implement a thin provider adapter"), this channel is *always* a thin
  custom adapter; there is no "standard" branch to fall back to.
  `training_whatsapp_provider_mode` therefore offers only `"test"` as a
  selectable value in `res.config.settings` — the same safe,
  no-network simulation as SMS's test mode, gated behind the same
  `partner.phone` pre-flight check. The method still defensively
  checks `config["whatsapp_provider_mode"] != "test"` and raises a
  clear "No WhatsApp provider is configured for this deployment."
  `UserError` for any other value (reachable only by directly setting
  the underlying `ir.config_parameter` to something the UI never
  offers, e.g. simulating a future real-provider integration point
  that has not actually been wired up yet) —
  `test_whatsapp_unconfigured_provider_mode_fails_cleanly` covers this
  defensive path. A real WhatsApp Business API integration remains a
  documented future extension point, not implemented here with
  invented credentials.

All three adapters share one property: a provider failure never
crashes the cron. `training.notification.log._send()` wraps the whole
dispatch in a single `try/except Exception`, converting any failure
-- a raised `UserError` from a pre-flight check, or (in production,
with the `odoo_sms` mode) a real network/IAP exception -- into
`status = 'failed'`, an `error_message`, and an incremented
`retry_count`, so one recipient's bad phone number can never stop the
rest of a cron run from reaching everyone else.

## 4. Retry Policy and Channel Fallback

`training_notification_max_retries` (`res.config.settings`, default 3)
bounds automatic retries: `_dispatch()` skips a channel once
`status == 'failed' and retry_count >= max_retries`, leaving the row
exactly as it is (still inspectable, still manually retryable via the
Back-office "Retry" button/`action_retry()`, which does not reset
`retry_count` -- the configured maximum applies across automatic and
manual attempts alike). A channel that has already reached
`status == 'sent'` is never re-attempted by the cron, satisfying
duplicate prevention for the success case too, not only for the
"don't create a second row" case.

"Channel fallback if policy enables it" (M9 test list) is a single
boolean, `training_notification_channel_fallback`, read once per
dispatch:

- **Enabled:** channels are attempted in priority order
  (`email -> sms -> whatsapp`, only the ones actually enabled), and
  `_dispatch()` returns as soon as one succeeds -- a later-priority
  channel never even gets a log row created for it if an
  earlier one already succeeded, verified by
  `test_fallback_stops_at_first_success` /
  `test_fallback_tries_next_channel_after_failure` (the latter
  disables the recipient's email address so email fails and SMS is
  attempted next, then confirms WhatsApp was never touched once SMS
  succeeded).
- **Disabled (default):** every enabled channel is attempted and
  tracked completely independently -- a recipient with SMS and
  WhatsApp both enabled gets three separate log rows, one per channel,
  each with its own retry/status lifecycle
  (`test_fallback_disabled_attempts_every_enabled_channel_independently`).

## 5. Configuration: `res.config.settings`, Never Next.js

Every policy knob (`training_notification_reminders_enabled`,
`..._sms_enabled`, `..._whatsapp_enabled`, `..._channel_fallback`,
`..._max_retries`, `training_sms_provider_mode`,
`training_whatsapp_provider_mode`) is a `res.config.settings`-backed
`ir.config_parameter`, per PROJECT_SPEC section 8's "Use
res.config.settings extension for global configuration" and section
16's explicit "Notification configuration exists in Odoo, never
Next.js." The Settings-page XML
(`views/res_config_settings_views.xml`) adds a **new, dedicated**
Settings app entry (`<app data-string="Training Management" ...>`,
gated by `group_training_admin`) rather than inserting into an
existing block -- verified against
`.odoo-core/addons/event/views/res_config_settings_views.xml`
as the correct pattern for a module that wants its own Settings
left-nav entry, as opposed to `.odoo-core/addons/sms/views/res_config_settings_views.xml`'s
`position="inside"` pattern (which only works when inserting into a
`<setting>` block another already-installed module defined, not
applicable here since this project's settings have no existing host
block to extend). `base_setup` was added to this module's `depends`
list since `res_config_settings_view_form`'s `ref()` requires it,
even though it was already present transitively in every database
this project has installed into so far.

## 6. Bilingual Templates: Two Different Mechanisms for Two Different Content Types

Email content (`mail.template.subject`/`body_html`, both
`translate=True`) is rendered in the recipient's own language
automatically: the template's `lang` field is set to the QWeb
expression `{{ object.partner_id.lang }}`, and `mail.template._render_lang()`
(verified in `mail/models/mail_render_mixin.py`) evaluates exactly
this expression per recipient when present, rather than falling back
to guessing a language. No Python-level language juggling is needed
for this channel at all.

SMS/WhatsApp bodies are plain Python-composed text
(`_build_reminder_text()`), which has no `mail.template` rendering
step to inherit language selection from. Odoo's global `_()`
translation helper resolves its language by inspecting the **calling
stack frame's own `self.env.lang`** (verified directly in
`odoo/tools/translate.py:_get_lang()` -- it reads
`frame.f_locals['self'].env.lang`, not a thread-local or the
recordset's identity). `_render_reminder_text()` therefore does not
call `_()` itself; it calls `self.with_context(lang=partner.lang or
...)._build_reminder_text()`, so that inside `_build_reminder_text()`'s
own stack frame, the local `self` is the *context-rebound* copy whose
`env.lang` is the recipient's language, and the `_()` call made from
that exact frame picks it up correctly. This two-method split is a
deliberate, verified idiom, not an accident of refactoring --
calling `_()` directly inside a single method bound to the caller's
own (wrong) language context would silently render every SMS/WhatsApp
body in whatever language the *cron's own user* happens to have, not
the recipient's.

Both mechanisms are tested at the **mechanism** level, not by
asserting translated content, matching how ADR-008 tested `dir="rtl"`
structurally rather than depending on `ar.po` being loaded:
`test_email_template_resolves_recipient_language` asserts
`template._render_lang([log.id])` returns `"ar_001"` once the
recipient's `lang` is set and the language is activated;
`test_sms_reminder_text_binds_recipient_language_context` asserts the
context-rebound recordset's `env.lang` is correct. The actual Arabic
translations themselves (`i18n/ar.po`) were verified the same way
every prior milestone's were: loaded into a real database via
`odoo-bin i18n loadlang`/`import`, then read back directly from
PostgreSQL -- including the mail template's own `body_html`/`subject`
JSONB columns, not just plain field labels, confirming the QWeb
`<t t-out="...">` placeholders survive translation intact.

## Test Results

211 backend tests (189 existing + 22 new in
`tests/test_training_notification.py`), 0 failed, 0 errors, run
against a real Odoo 19 instance/PostgreSQL database on a disposable
database/port (per the same precaution ADR-007/ADR-008 already
documented, to avoid the developer's already-running Odoo instance on
8069). `flake8` clean. Frontend: unchanged by this milestone (no
Next.js screen or Operational API endpoint was added or is needed --
PROJECT_SPEC section 16: "never Next.js"); 74 existing frontend tests
still pass, `npm run lint` and `npm run build` both clean. `i18n`:
`training_management.pot` regenerated (230 -> 283 terms) and `ar.po`
extended with all 50 newly-introduced terms (49 short UI/model terms
plus the reminder email's full `body_html` block), verified by loading
`ar_001` and importing the updated `.po` into a real database, then
reading translated `ir.model.fields.field_description` values and the
mail template's own translated `subject`/`body_html` back from
PostgreSQL directly.

## Known Limitations / Unresolved Items for M10+

- **SMS and WhatsApp real-provider integration remain unconfigured by
  design.** `sms_provider_mode = "odoo_sms"` is wired to standard Odoo
  `sms.sms`, but a production deployment still needs a real IAP
  account/credits provisioned and verified separately -- this was
  never in scope for M9 per the "do not invent credentials" instruction.
  WhatsApp has no implementation path at all beyond the test adapter
  until either Odoo Enterprise's `whatsapp` module becomes available
  or a real third-party provider (e.g. WhatsApp Business Cloud API) is
  explicitly chosen and configured -- this is still an open decision
  per PROJECT_SPEC section 25, unchanged by this milestone.
- **No lead-time / "closing soon" reminder variant exists.** M9
  reminds any eligible recipient any time their day is open and inside
  its survey window, not specifically "N hours before it closes" --
  DEVELOPMENT_PLAN's M9 brief does not ask for this distinction, but a
  future milestone could add a second `event_type` value (the field
  already supports it) without changing the underlying eligibility
  query.
- **No `training.audit.log` entry is created for reminder sends.**
  PROJECT_SPEC section 17 does not list routine reminder delivery among
  its audit-worthy events (unlike report approval or day
  reopen/close), and `training.notification.log` itself already is
  the traceable record the M9 exit criterion asks for -- this is a
  deliberate scope boundary, not an oversight.
- **The cron's hourly interval is a reasonable default, not a tuned
  value.** No production SLA for reminder latency was specified in
  PROJECT_SPEC; this should be revisited once real usage patterns
  (survey window lengths, number of programs) are known.
