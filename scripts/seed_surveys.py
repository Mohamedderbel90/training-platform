"""Seed and link the APPROVED survey question sets of docs/SURVEY_QUESTIONS.md.

The single source of survey content, for real installations and for the
development dataset alike. Run against a database that has training_management
installed:

    ./scripts/run_odoo.sh shell -d <db> --no-http < scripts/seed_surveys.py

(./scripts/load_dev_data.sh runs it first, then scripts/dev_data.py.)

Idempotent. Each survey is identified by an external id
(training_management.survey_approved_<role>), so re-running never duplicates
it. Linking: every training day that has NO response of that role yet gets the
approved survey as its survey of that role, replacing a previous pointer; days
that already have a response of that role keep their survey, so history is
never rewritten. Wording approved by the owner on 2026-10-03 (DEC-43).
"""
RATING = [
    ("Poor", "ضعيف", 1),
    ("Acceptable", "مقبول", 2),
    ("Good", "جيد", 3),
    ("Very Good", "جيد جداً", 4),
    ("Excellent", "ممتاز", 5),
]

# (title_en, title_ar, type, kpi_category, required)
SETS = [
    ("trainee", "Daily Trainee Survey", "استبانة المتدربة اليومية", [
        ("Trainer's overall performance", "الأداء العام للمدربة", "simple_choice", "trainer_performance", True),
        ("Trainer's presentation style", "أسلوب طرح المدربة", "simple_choice", "trainer_performance", True),
        ("Trainer's interaction with trainees", "تفاعل المدربة مع المتدربات", "simple_choice", "trainer_performance", True),
        ("Scientific material", "المادة العلمية", "simple_choice", "content", True),
        ("Comprehensiveness of the content", "شمولية المحتوى", "simple_choice", "content", True),
        ("Practical applicability", "الأهمية التطبيقية", "simple_choice", "content", True),
        ("Organization", "التنظيم", "simple_choice", "environment", True),
        ("Facilities", "التسهيلات", "simple_choice", "environment", True),
        ("Logistics services", "الخدمات اللوجستية", "simple_choice", "environment", True),
        ("Notes and suggestions", "ملاحظات ومقترحات", "text_box", None, False),
    ]),
    ("supervisor", "Supervisor Daily Evaluation", "تقييم المشرفة اليومي", [
        ("Training environment (execution)", "البيئة التنفيذية", "simple_choice", "environment", True),
        ("Flow of the training day", "سير اليوم التدريبي", "simple_choice", "environment", True),
        ("Operational notes", "ملاحظات تشغيلية", "text_box", None, False),
        ("Incidents or challenges of the day", "حوادث أو تحديات اليوم", "text_box", None, False),
    ]),
    ("trainer", "Trainer Daily Report", "التقرير اليومي للمدربة", [
        ("Trainees' response and interaction", "استجابة المتدربات وتفاعلهن", "simple_choice", None, True),
        ("Scientific and technical notes", "الملاحظات العلمية والفنية", "text_box", None, False),
        ("Recommendations to improve the day or the next course",
         "توصيات لتحسين اليوم أو الدورة القادمة", "text_box", None, False),
    ]),
]


def tr(record, field, en, ar):
    # update_field_translations writes exactly these two languages whatever the
    # shell user's language is; two context writes would let the Arabic one
    # overwrite the English source when that user's language is ar_001.
    record.update_field_translations(field, {"en_US": en, "ar_001": ar})


LINK_FIELD = {
    "trainee": "trainee_survey_id",
    "supervisor": "supervisor_survey_id",
    "trainer": "trainer_survey_id",
}


def get_or_create_survey(env, role, title_en, title_ar, questions):
    xmlid = "survey_approved_%s" % role
    existing = env.ref("training_management.%s" % xmlid, raise_if_not_found=False)
    if existing:
        print("exists, kept:", existing.title)
        return existing
    survey = env["survey.survey"].create({"title": title_en, "survey_role": role})
    tr(survey, "title", title_en, title_ar)
    for q_en, q_ar, q_type, kpi, required in questions:
        question = env["survey.question"].create({
            "survey_id": survey.id,
            "title": q_en,
            "question_type": q_type,
            "kpi_category": kpi,
            "constr_mandatory": required,
        })
        tr(question, "title", q_en, q_ar)
        if q_type == "simple_choice":
            for label_en, label_ar, value in RATING:
                option = env["survey.question.answer"].create(
                    {"question_id": question.id, "value": label_en, "rating_value": value}
                )
                tr(option, "value", label_en, label_ar)
    env["ir.model.data"].create({
        "module": "training_management",
        "name": xmlid,
        "model": "survey.survey",
        "res_id": survey.id,
        "noupdate": True,
    })
    print("created:", title_en)
    return survey


def link_days(env, role, survey):
    field = LINK_FIELD[role]
    days = env["training.day"].with_context(active_test=False).search([])
    linked = 0
    for day in days:
        if day[field] == survey:
            continue
        has_response = env["survey.user_input"].search_count(
            [("training_day_id", "=", day.id), ("respondent_role", "=", role)]
        )
        if has_response:
            continue
        day.write({field: survey.id})
        linked += 1
    print("linked %s survey to %d training day(s)" % (role, linked))


def main(env):
    env["res.lang"]._activate_lang("ar_001")
    for role, title_en, title_ar, questions in SETS:
        survey = get_or_create_survey(env, role, title_en, title_ar, questions)
        link_days(env, role, survey)
    env.cr.commit()


main(env)  # noqa: F821  (env is injected by `odoo-bin shell`)
