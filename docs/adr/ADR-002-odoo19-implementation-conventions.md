# ADR-002: Odoo 19 Implementation Conventions (Verified During M1)

- **Status:** Accepted
- **Date:** 2026-09-15
- **Milestone:** M1.1 (documentation-only pass, no business behavior changed)
- **Related:** ADR-001-odoo19-runtime-baseline.md

## Context

While implementing milestone M1 (security groups/ACL/record rules and
the core domain models) against the real, verified Odoo 19.0
Community runtime established in ADR-001, several implementation
patterns assumed from older Odoo documentation/habits failed outright
or emitted deprecation warnings when actually run. Per PROJECT_SPEC
section 24 (rule 2: do not invent a standard field/model without
verifying against the actual runtime), each of these was re-verified
directly against the Odoo 19.0 source tree and/or a live registry
load, and the addon code was corrected accordingly. This ADR records
the resulting implementation conventions so they are not
re-discovered (or re-broken) in later milestones.

## Findings and Conventions

### 1. `res.groups.category_id` does not exist in Odoo 19

Verified against `odoo/addons/base/models/res_groups.py`: `res.groups`
has no `category_id` field. It was replaced by `privilege_id`
(`Many2one` to the new `res.groups.privilege` model), which groups
mutually-related, typically mutually-exclusive access-level groups
(e.g. the "Internal User / Administrator" radio-style selector on the
user form) — a different semantic than a simple cosmetic category tag.

**Convention:** The five V1 project groups
(`group_training_admin`, `group_training_assistant_admin`,
`group_training_trainee`, `group_training_supervisor`,
`group_training_trainer`) are independent, non-exclusive roles and do
not fit the privilege model's exclusivity semantics. They are defined
with no `category_id`/`privilege_id` at all. Do not introduce
`res.groups.privilege` grouping for this addon unless a real,
documented functional need appears (e.g. an actual mutually-exclusive
access-level selector is wanted in the UI) — do not add it purely to
reproduce the old `category_id` cosmetic grouping.

### 2. `_sql_constraints` is deprecated; use `models.Constraint`

Odoo 19 logs `Model attribute '_sql_constraints' is no longer
supported, please define models.Constraint on the model.` at registry
load time when the old list-of-tuples form is used, and this project
treats that as a hard error to fix, not a warning to ignore.

**Convention:** SQL constraints are defined as a class attribute using
`models.Constraint(definition, message)`, e.g.:

```python
_program_partner_uniq = models.Constraint(
    "unique(program_id, partner_id)",
    "A participant can only be enrolled once per program.",
)
```

The attribute name (not a string key, as in the old tuple form) is the
Python identifier; it becomes part of the constraint's technical name.
Used in `training.enrollment` and `training.attendance`.

### 3. Search-view `<group>` for Group By no longer accepts `expand`/`string`

Confirmed against core (`addons/product/views/product_views.xml`):
modern Odoo 19 Group By sections in `<search>` views use a bare
`<group>` wrapping `<filter>` elements directly — no `expand="0"` or
`string="Group By"` attributes. Using them raises an RNG validation
error (`Invalid attribute expand for element group`) and the view
fails to load.

**Convention:**

```xml
<group>
    <filter name="group_by_state" string="State" context="{'group_by': 'state'}"/>
</group>
```

not

```xml
<group expand="0" string="Group By">  <!-- invalid in Odoo 19 -->
    ...
</group>
```

Applied to all five search views in this addon.

### 4. `odoo-bin --i18n-export` no longer exists

Odoo 19's CLI restructured translation import/export into subcommands.
The old flat flags fail with `error: no such option: --i18n-export`.

**Convention:** Use:

```
odoo-bin i18n export -c <config> -d <db> <module> [-l <lang>|pot] [-o <file>]
odoo-bin i18n import -c <config> -d <db> -l <lang> [-w] <file.po>
odoo-bin i18n loadlang -c <config> -d <db> -l <lang>
```

This is how `custom_addons/training_management/i18n/training_management.pot`
and `i18n/ar.po` were generated and verified (loaded into a live
database and read back from PostgreSQL, not just checked for `.po`
syntax) during M1. See `custom_addons/training_management/i18n/README.md`
for the exact commands.

### 5. PostgreSQL: Odoo 19 requires PostgreSQL ≥ 13

Verified from source: `odoo/release.py` defines `MIN_PG_VERSION = 13`,
and `odoo/sql_db.py` emits `Postgres version is ..., lower than
minimum required ...` at connection time when this isn't met. The
local M0/M1 development cluster runs PostgreSQL 12.22 (the only
server binary available on the development machine without `sudo`)
and Odoo only warns rather than refusing to start, which is why local
development and the M1 test suite worked despite this.

**Convention:**
- PostgreSQL 12 (as used in `.pgdata/` for local development) is
  **development-only** and explicitly unsupported for anything beyond
  local dev/test on this machine.
- Staging and production **must** run PostgreSQL 13 or later.
- When infrastructure is actually provisioned, prefer a currently
  supported PostgreSQL release (i.e. not just the minimum-compatible
  13, but whatever major version is still within upstream PostgreSQL
  support at deployment time), subject to Odoo 19's own compatibility
  matrix being rechecked at that time.

### 6. Security architecture confirmed (no change in behavior, restated for clarity)

- Odoo Back-office menu visibility is not, and must never be treated
  as, the security boundary (PROJECT_SPEC section 7, "Menu visibility
  is never considered sufficient security"). ACLs (`ir.model.access.csv`)
  and Record Rules (`ir.rule`) are authoritative and are enforced
  server-side regardless of what any client shows.
- Trainee, Supervisor, and Trainer groups are granted the Odoo model
  read (and, for Supervisor on attendance, write/create) access their
  eventual Operational API implementations (M4+) will need — this is
  necessary at the ORM/ACL level even though these roles have **no**
  Odoo Back-office menu items (the M1 `menu_training_management_root`
  and its children are restricted to `group_training_admin` and
  `group_training_assistant_admin` only).
- Next.js remains the primary, and for these three roles the only
  intended, user interface (PROJECT_SPEC section 2.2). Model-level ACL
  access without backend menu access is the expected, intentional
  shape for these roles, not a gap to close later.

### 7. Trainer assignment: final for V1 (restated, no change)

`training.day.trainer_ids` is a direct `Many2many` to `res.users`
(`training_day_trainer_rel` relation table). No `training.trainer.assignment`
model exists or is planned for V1. This was decided before M1
implementation and is restated here only so it is co-located with the
other verified-runtime/implementation conventions this ADR records. A
dedicated assignment model may only be introduced later via an
explicit change request if per-assignment metadata becomes genuinely
necessary — not as a default assumption.

### 8. SQL-view-backed reporting models use `_table_query`, not `init()` (added during M3)

Older Odoo versions (and most pre-19 documentation/training material)
build a SQL-view-backed reporting model by overriding `init()` and
calling `tools.drop_view_if_exists()` followed by a raw
`cr.execute("CREATE VIEW ...")`. Odoo 19 replaced this with a
`_table_query` property (verified against core
`addons/account/report/account_invoice_report.py` and
`odoo/orm/models.py`, which defines `_table_query: SQL | str | None`
as an official ORM hook): the model sets `_auto = False` and defines a
`@property def _table_query(self) -> SQL: ...` returning an
`odoo.tools.SQL` object. No `init()` override, no `drop_view_if_exists`
call, and no persistent `CREATE VIEW` DDL object are needed or created
— `_table_query` is substituted as an inline derived subquery wherever
the ORM needs to reference the model's "table," evaluated fresh on
every query. One consequence worth remembering: if the view's query
reads fields from other models by raw SQL (bypassing the ORM), declare
`_depends = {model_name: [field_names]}` so Odoo knows to flush
pending ORM writes on those fields before running the query — omitting
this caused a real, verified test failure during M3 (a just-created
answer line was invisible to the view because it hadn't been flushed
to the database yet). See `docs/adr/ADR-004-analytics-and-day-workflow.md`
for the concrete model (`training.survey.response.kpi`) this was built
for and why a SQL view was the right choice there.

## Consequences

- Any future milestone (M2+) or any AI coding agent picking up this
  project must follow the five verified conventions above (`Constraint`
  class attribute, `category_id`-free groups, bare `<group>` in search
  views, `i18n` subcommands, PostgreSQL ≥ 13 for non-dev environments)
  rather than defaulting to older Odoo idioms from training data or
  older documentation in this repository.
- PROJECT_SPEC and ADR-001 remain the business/architecture source of
  truth; this ADR is purely about *how* to implement against the
  verified Odoo 19.0 runtime without re-hitting the same errors.
