# Translations

This addon uses Odoo's standard translation mechanism (`i18n`/`.po`
files), per PROJECT_SPEC_v1.1_BILINGUAL.md section 2A.

- `training_management.pot` — translation template, exported from the
  models/views/security added in milestone M1 (61 terms as of M1).
- `ar.po` — Arabic translations for all M1 terms. Arabic is the
  product's default locale (PROJECT_SPEC section 2A).

Regenerate the `.pot` after adding new user-facing content (new
fields, views, selection labels, group names, etc.) from a running
instance with the module installed:

```
odoo-bin i18n export -c env/odoo.conf -d <db> training_management
```

Odoo 19 moved translation import/export under the `i18n` subcommand
(`odoo-bin i18n export|import|loadlang`); the older flat
`--i18n-export`/`--i18n-overwrite` flags documented in pre-19 Odoo
material no longer exist and will fail with "no such option".

To update `ar.po` after regenerating the `.pot`, diff the new template
against the existing `.po`, translate any new/changed `msgid` entries,
and verify the result actually loads (syntax-checking a `.po` file is
not enough — Odoo's importer can silently skip malformed entries):

```
odoo-bin i18n loadlang -c env/odoo.conf -d <db> -l ar_001   # once per DB
odoo-bin i18n import -c env/odoo.conf -d <db> -l ar_001 -w custom_addons/training_management/i18n/ar.po
```

Then read a translated field back from the database directly (not
just from the Odoo UI) to confirm the import actually took effect, e.g.:

```
psql ... -c "SELECT name->>'ar_001' FROM res_groups WHERE id = ...;"
```

Do not create parallel `_ar`/`_en` fields for translatable business
content; use `translate=True` on the field instead (already done for
`training.program.name` and `training.course.name`), per PROJECT_SPEC
section 2A.
