# Approved Survey Question Sets

- **Status:** APPROVED by the project owner on 2026-10-03 (DEC-43). Drafted by
  the BA from the BRD item names; changes to the wording are made in Odoo
  (Survey) and, if the survey already has responses, as a new version.
- **Basis:** only the BRD item names: trainee FR-021..FR-024, supervisor
  FR-033/FR-034, trainer FR-041..FR-043; scale per BRD D-02 (poor, acceptable,
  good, very good, excellent). No question outside those items was added.
- **Loading and linking:** `scripts/seed_surveys.py` (see its header). It
  creates the three surveys once (external ids `survey_approved_<role>`) and
  links each to every training day that has no response of that role yet;
  days with responses keep their survey. Run on the development database on
  2026-10-03. The development dataset (`scripts/load_dev_data.sh`) runs it first and
  defines no survey content of its own.
- **KPI mapping** is set on the question (BRD KPI table): trainer
  performance, content, environment. The trainer's interaction rating has no
  KPI category because the BRD defines none for it.

## Trainee daily survey (FR-021..FR-024)

| # | English | Arabic | Type | KPI | Required |
|---|---|---|---|---|---|
| 1 | Trainer's overall performance | الأداء العام للمدربة | Rating | Trainer performance | Yes |
| 2 | Trainer's presentation style | أسلوب طرح المدربة | Rating | Trainer performance | Yes |
| 3 | Trainer's interaction with trainees | تفاعل المدربة مع المتدربات | Rating | Trainer performance | Yes |
| 4 | Scientific material | المادة العلمية | Rating | Content | Yes |
| 5 | Comprehensiveness of the content | شمولية المحتوى | Rating | Content | Yes |
| 6 | Practical applicability | الأهمية التطبيقية | Rating | Content | Yes |
| 7 | Organization | التنظيم | Rating | Environment | Yes |
| 8 | Facilities | التسهيلات | Rating | Environment | Yes |
| 9 | Logistics services | الخدمات اللوجستية | Rating | Environment | Yes |
| 10 | Notes and suggestions | ملاحظات ومقترحات | Long text | none | No |

## Supervisor daily evaluation (FR-033, FR-034)

| # | English | Arabic | Type | KPI | Required |
|---|---|---|---|---|---|
| 1 | Training environment (execution) | البيئة التنفيذية | Rating | Environment | Yes |
| 2 | Flow of the training day | سير اليوم التدريبي | Rating | Environment | Yes |
| 3 | Operational notes | ملاحظات تشغيلية | Long text | none | No |
| 4 | Incidents or challenges of the day | حوادث أو تحديات اليوم | Long text | none | No |

Attendance is recorded separately (`training.attendance`), not in this survey.

## Trainer daily report (FR-041..FR-043)

| # | English | Arabic | Type | KPI | Required |
|---|---|---|---|---|---|
| 1 | Trainees' response and interaction | استجابة المتدربات وتفاعلهن | Rating | none | Yes |
| 2 | Scientific and technical notes | الملاحظات العلمية والفنية | Long text | none | No |
| 3 | Recommendations to improve the day or the next course | توصيات لتحسين اليوم أو الدورة القادمة | Long text | none | No |

The trainer report allows saving a draft before final submission (FR-044).
