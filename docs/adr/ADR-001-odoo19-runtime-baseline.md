# ADR-001: Odoo 19 Runtime Baseline (Verified) and Standard-Module Availability

- **Status:** Accepted
- **Date:** 2026-09-15
- **Milestone:** M0 (repository/environment baseline)
- **Supersedes:** Any older BRD/SRS/ERD/API/UI document assumption about
  `res.partner` fields or the availability of Odoo Sign/WhatsApp, where
  it conflicts with this record.

## Context

`PROJECT_SPEC_v1.1_BILINGUAL.md` section 4 lists the standard Odoo
models/fields the project relies on, and section 24 (rule 2) requires
that no coding agent invent a standard field or model without
verifying it against the actual Odoo runtime first.

During milestone M0, a real Odoo 19 instance was built from source and
a standard-schema smoke test (`custom_addons/training_management/tests/test_schema_smoke.py`)
was run against it, rather than trusting the specification documents'
assumptions. This ADR records what that verification actually found.

## Runtime Verified

- **Odoo Server 19.0**, Community edition.
- **Source:** official Odoo 19.0 branch, `https://github.com/odoo/odoo.git`,
  branch `19.0` (branch existence confirmed directly via `git ls-remote`
  before cloning; not assumed from documentation).
- Run against Python 3.10.16 and PostgreSQL 12.22 in the verification
  environment.

## Findings

### 1. `res.partner.mobile` does not exist on this runtime

`PROJECT_SPEC` previously listed `res.partner` standard fields as
`name`, `email`, `phone`, `mobile`, `lang`, `active`. On the actual
Odoo 19.0 source (`odoo/addons/base/models/res_partner.py`),
`res.partner` defines only `phone = fields.Char()` — there is no
separate `mobile` field.

**Decision:** The project uses `res.partner.phone` in V1 for all
phone-number storage/use (Excel import required fields, SMS/WhatsApp
recipient lookup, contact display, etc.). No custom `mobile`-like
field is created to reproduce the outdated assumption.
`PROJECT_SPEC_v1.1_BILINGUAL.md` section 4 has been corrected to drop
`mobile` from the `res.partner` field list.

### 2. Odoo Sign is unavailable in the current Community environment

The `sign` module is not present in the verified Odoo 19.0 Community
source tree. Odoo Sign is an Enterprise-only application distributed
from a separate, private repository this environment has no access to
and no license for.

**Decision:** Report approval (PROJECT_SPEC section 15) uses the
**visual approval stamp on the QWeb PDF** as the fallback approval
mechanism, exactly as PROJECT_SPEC already specifies as the
non-Sign path. Odoo Sign integration remains optional and must not be
assumed available until licensing/edition is explicitly confirmed for
the target deployment.

### 3. WhatsApp connector is unavailable in the current Community environment

The `whatsapp` module is not present in the verified Odoo 19.0
Community source tree, for the same Enterprise/licensing reason as
Sign.

**Decision:** If WhatsApp notifications are required (PROJECT_SPEC
section 16), the project **must implement a thin custom provider
adapter** behind the same interface a standard connector would expose,
rather than assuming a standard Odoo WhatsApp integration exists. This
matches PROJECT_SPEC's already-documented fallback; this ADR confirms
the fallback is the only viable path in this environment today.

### 4. SMS module is available

The `sms` module **is** present in the verified Community source tree.
No fallback/adapter is required to get baseline SMS sending
capability at the Odoo level; a commercial SMS provider/IAP account is
still a separate, unresolved decision (see PROJECT_SPEC section 25).

## Consequences

- No business logic in this project may depend on Enterprise-only
  modules (`sign`, `whatsapp`, or any other module not present in the
  verified Community source tree) unless the project explicitly
  changes edition/licensing and that change is recorded in a new ADR.
- Before production deployment, the **production Odoo edition and
  installed optional modules must be re-verified** — this ADR only
  covers the environment verified during M0 (a fresh Community
  checkout of the `19.0` branch tip). If production runs Enterprise or
  a different patch build, re-run the schema smoke test and re-check
  Sign/WhatsApp/SMS module presence before relying on this ADR's
  findings there.
- `PROJECT_SPEC_v1.1_BILINGUAL.md` remains the authoritative
  implementation source; this ADR records the verified deviation from
  older documents (BRD/SRS/ERD/API Contract appendices), which still
  list `mobile` and assume Sign/WhatsApp modules without
  qualification. Those documents are not modified by this ADR — this
  record is what future implementation and future ADRs should defer
  to on these specific points.
