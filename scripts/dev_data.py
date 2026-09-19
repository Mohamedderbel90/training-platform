"""Development-only demo data for manually exercising the Odoo
Back-office and the Next.js Operational UI against a real Odoo
instance.

This is NOT an Odoo demo-data XML file and is NEVER loaded by module
installation -- it only runs when a developer explicitly feeds it to
`odoo-bin shell` (see scripts/load_dev_data.sh). It never touches
production data files (no `demo` manifest entry exists in this addon),
and it is idempotent: re-running it against the same database updates
the existing demo records in place instead of duplicating them, keyed
by fixed logins/names/dates rather than random or "now"-relative data.

Usage:
    ./scripts/load_dev_data.sh training_management_dev

Demo accounts created (password "Dev12345!" for all):
    dev_trainee .. dev_trainee_7 (7 trainees), all enrolled in the
                    demo program
    dev_supervisor  -- supervisor, assigned to every demo training day
    dev_trainer     -- trainer, assigned to every demo training day

Demo program structure (PROJECT_SPEC section 1's own worked example:
"a 4-month / 16-week program for developing female Quran-school
managers, with two training days per week, four hours per day, and
five specialized courses"):
    - 1 program, 16 weeks, 2 training days/week (Tuesday + Thursday),
      32 training days total, 4 hours each.
    - 5 courses, each a contiguous block of the 32 days.
    - Course/question/answer-option names and content below are
      clearly-labeled SAMPLE content, not an official curriculum --
      PROJECT_SPEC does not specify exact course names or survey
      wording, only the program's shape.
    - Every trainee/course/program/survey/question/answer-option name
      is bilingual (English + Arabic) via Odoo's standard
      `translate=True` field mechanism -- never a parallel `*_ar`
      field and never duplicated records per language.
    - Day state is computed once, at creation time, from a FIXED
      program start date (2026-07-07) relative to whichever day is
      "today" the first time this script creates that day: any day
      before today starts `closed`, the single nearest day to today
      starts `open`, everything after starts `planned`. Re-running
      this script never changes an EXISTING day's state again --
      once a day exists, its state is only ever changed by the normal
      Back-office workflow actions (or by a supervisor/trainer using
      the Operational UI), never by this script, so it can never
      undo manual UAT testing.
    - A small amount of realistic historical data (attendance + all
      three survey types) is seeded for the program's first two
      training days only, so dashboards/analytics/reports have real
      numbers to show immediately. Every other day (including the
      current "open" one) is left empty for hands-on manual testing.
"""
from datetime import date, timedelta

DEMO_PASSWORD = "Dev12345!"

# Fixed, never "now"-relative (see module docstring: idempotency
# requires this to never change between runs). 2026-07-07 is a
# Tuesday; the program runs Tuesday + Thursday every week for 16
# weeks = 32 training days.
PROGRAM_START = date(2026, 7, 7)
TOTAL_WEEKS = 16
WEEKDAY_OFFSETS = (0, 2)  # Tuesday, Thursday relative to each week's Tuesday

TRAINEE_LOGINS = [
    ("dev_trainee", "Dev Trainee"),
    ("dev_trainee_2", "Dev Trainee 2"),
    ("dev_trainee_3", "Dev Trainee 3"),
    ("dev_trainee_4", "Dev Trainee 4"),
    ("dev_trainee_5", "Dev Trainee 5"),
    ("dev_trainee_6", "Dev Trainee 6"),
    ("dev_trainee_7", "Dev Trainee 7"),
]

PROGRAM_NAME_EN = "Female Quran School Principals - Leadership Development Program"
PROGRAM_NAME_AR = "برنامج تطوير القيادة الإدارية لمديرات مدارس تحفيظ القرآن الكريم"

# (key, name_en, name_ar, day_index_start, day_index_end) -- day range
# is a half-open [start, end) slice into the 32-day calendar below.
# Clearly-labeled sample topics for a leadership/management program,
# not an official curriculum (none was specified).
COURSE_DEFS = [
    (
        "course_1",
        "Course 1: Educational Leadership Foundations",
        "الدورة الأولى: أساسيات القيادة التربوية",
        0,
        8,
    ),
    (
        "course_2",
        "Course 2: Administrative and Financial Management",
        "الدورة الثانية: الإدارة التنظيمية والمالية",
        8,
        14,
    ),
    (
        "course_3",
        "Course 3: Staff Development and Supervision",
        "الدورة الثالثة: تطوير الكوادر والإشراف التربوي",
        14,
        20,
    ),
    (
        "course_4",
        "Course 4: Quality Assurance and Institutional Planning",
        "الدورة الرابعة: ضمان الجودة والتخطيط المؤسسي",
        20,
        26,
    ),
    (
        "course_5",
        "Course 5: Community Relations and Communication Skills",
        "الدورة الخامسة: العلاقات المجتمعية ومهارات التواصل",
        26,
        32,
    ),
]

# PROJECT_SPEC section 12's own descriptive rating scale, verbatim.
RATING_SCALE = [
    ("Poor", "ضعيف", 1),
    ("Acceptable", "مقبول", 2),
    ("Good", "جيد", 3),
    ("Very Good", "جيد جداً", 4),
    ("Excellent", "ممتاز", 5),
]


def set_translations(record, field, value_en, value_ar):
    """Write both languages of a translate=True field via Odoo's
    standard mechanism (per-language context write) -- never a
    parallel *_ar field, never a second record."""
    record.with_context(lang="en_US").write({field: value_en})
    record.with_context(lang="ar_001").write({field: value_ar})


def get_or_create_user(env, login, group_xmlid, name, phone=None):
    User = env["res.users"].with_context(no_reset_password=True)
    user = User.search([("login", "=", login)], limit=1)
    group = env.ref(group_xmlid)
    if user:
        user.write({"group_ids": [(4, group.id), (4, env.ref("base.group_user").id)]})
    else:
        user = User.create(
            {
                "name": name,
                "login": login,
                "email": "%s@example.com" % login,
                "group_ids": [
                    (4, env.ref("base.group_user").id),
                    (4, group.id),
                ],
            }
        )
    user.password = DEMO_PASSWORD
    if phone:
        user.partner_id.phone = phone
    return user


def get_or_create_enrollment(env, program, partner):
    enrollment = env["training.enrollment"].search(
        [("program_id", "=", program.id), ("partner_id", "=", partner.id)],
        limit=1,
    )
    if not enrollment:
        enrollment = env["training.enrollment"].create(
            {"program_id": program.id, "partner_id": partner.id}
        )
    return enrollment


def get_or_create_survey_with_questions(env, title_en, title_ar, role, question_defs):
    """Find (or create) the one "live" survey for this role, ensure it
    has every question in question_defs, and return it.

    There is only ever one live survey per role in this script's own
    history, regardless of what an earlier run named it (it may still
    be the legacy single-question "Demo ... Survey"), so it is looked
    up by role + version ordering, not by title.

    If real UAT testing already produced submitted responses against
    it (ADR-003's has_submitted_responses), adding a genuinely new
    question is structurally blocked by survey_question.create()'s own
    guard -- exactly the protection PROJECT_SPEC section 12 requires
    ("Historical survey versions/responses must never be rewritten").
    The sanctioned way to evolve it is a new version
    (action_clone_as_new_version(), ADR-003), which this detects and
    performs automatically, exactly once, the first time it is needed;
    the OLD version and its historical responses are left completely
    untouched, still pointing at their own original questions.
    """
    survey = env["survey.survey"].search(
        [("survey_role", "=", role)], order="version_no desc, id desc", limit=1
    )
    if not survey:
        survey = env["survey.survey"].create({"title": title_en, "survey_role": role})

    target_titles = [q[0] for q in question_defs]
    existing_titles = set(survey.question_and_page_ids.mapped("title"))
    missing = [t for t in target_titles if t not in existing_titles]
    if missing and survey.has_submitted_responses:
        action = survey.action_clone_as_new_version()
        survey = env["survey.survey"].browse(action["res_id"])

    # Drop any question not in this script's own target set -- leftover
    # legacy wording from an earlier revision of this script (e.g. the
    # very first revision's plain "Rate the trainer", with no
    # kpi_category ever set), which would otherwise sit alongside its
    # replacement and confuse anyone filling out the survey. Safe
    # whenever `survey` has no submitted responses of its own: either
    # it is the fresh clone from just above (which never has any yet),
    # or it never needed cloning in the first place because nothing was
    # ever submitted against it (survey_question.unlink()'s own guard
    # -- ADR-003 -- is what actually enforces this is safe, not this
    # script's own judgment).
    if not survey.has_submitted_responses:
        stale = survey.question_and_page_ids.filtered(
            lambda q: q.title not in target_titles
        )
        if stale:
            stale.unlink()

    set_translations(survey, "title", title_en, title_ar)
    for q_title_en, q_title_ar, q_type, kpi_category, mandatory in question_defs:
        question = get_or_create_question(
            env, survey, q_title_en, q_title_ar, q_type, kpi_category, mandatory
        )
        if q_type == "simple_choice":
            ensure_rating_scale(env, question)
    return survey


def get_or_create_question(
    env, survey, title_en, title_ar, question_type, kpi_category=None, mandatory=False
):
    question = env["survey.question"].search(
        [("survey_id", "=", survey.id), ("title", "=", title_en)], limit=1
    )
    if not question:
        question = env["survey.question"].create(
            {
                "survey_id": survey.id,
                "title": title_en,
                "question_type": question_type,
                "kpi_category": kpi_category,
                "constr_mandatory": mandatory,
            }
        )
    set_translations(question, "title", title_en, title_ar)
    return question


def ensure_rating_scale(env, question):
    if question.suggested_answer_ids:
        return {
            opt.rating_value: opt for opt in question.suggested_answer_ids if opt.rating_value
        }
    options = {}
    for label_en, label_ar, value in RATING_SCALE:
        option = env["survey.question.answer"].create(
            {
                "question_id": question.id,
                "value": label_en,
                "rating_value": value,
            }
        )
        set_translations(option, "value", label_en, label_ar)
        options[value] = option
    return options


def build_calendar():
    dates = []
    for week in range(TOTAL_WEEKS):
        for offset in WEEKDAY_OFFSETS:
            dates.append(PROGRAM_START + timedelta(weeks=week, days=offset))
    return dates


def main(env):
    from odoo import fields as odoo_fields  # noqa: PLC0415

    env["res.lang"]._activate_lang("ar_001")

    trainees = [
        get_or_create_user(
            env,
            login,
            "training_management.group_training_trainee",
            name,
            phone="+9665500%04d" % (i + 1),
        )
        for i, (login, name) in enumerate(TRAINEE_LOGINS)
    ]
    supervisor = get_or_create_user(
        env,
        "dev_supervisor",
        "training_management.group_training_supervisor",
        "Dev Supervisor",
        phone="+966550010001",
    )
    trainer = get_or_create_user(
        env,
        "dev_trainer",
        "training_management.group_training_trainer",
        "Dev Trainer",
        phone="+966550020001",
    )

    # ---- program (repurposing the existing "Demo Program" in place) ----
    program = env["training.program"].search([("name", "=", "Demo Program")], limit=1)
    if not program:
        program = env["training.program"].search(
            [("name", "=", PROGRAM_NAME_EN)], limit=1
        )
    calendar = build_calendar()
    if not program:
        program = env["training.program"].create(
            {
                "name": PROGRAM_NAME_EN,
                "start_date": calendar[0],
                "end_date": calendar[-1],
                "state": "active",
            }
        )
    else:
        program.write(
            {
                "start_date": calendar[0],
                "end_date": calendar[-1],
                "state": "active",
            }
        )
    set_translations(program, "name", PROGRAM_NAME_EN, PROGRAM_NAME_AR)

    # ---- courses (reuse the old single "Demo Course" record as the
    # first course whose date range needs a home for it, so existing
    # training days linked to it are never orphaned) ----
    legacy_course = env["training.course"].search(
        [("program_id", "=", program.id), ("name", "=", "Demo Course")], limit=1
    )
    courses = {}
    for idx, (key, name_en, name_ar, start_idx, end_idx) in enumerate(COURSE_DEFS):
        course = env["training.course"].search(
            [("program_id", "=", program.id), ("name", "=", name_en)], limit=1
        )
        # The existing 2026-09-15/2026-09-17 training days (created by
        # earlier script runs, before this bilingual/32-day structure
        # existed) are linked to the old single "Demo Course" record.
        # Those two dates fall inside course_4's block, so THAT is the
        # course that must reuse "Demo Course" -- otherwise the day
        # -matching below (by course_id + date) would miss them and
        # create duplicates instead of folding them in.
        if not course and key == "course_4" and legacy_course:
            course = legacy_course
        if not course:
            course = env["training.course"].create(
                {
                    "program_id": program.id,
                    "name": name_en,
                    "sequence": (idx + 1) * 10,
                    "start_date": calendar[start_idx],
                    "end_date": calendar[end_idx - 1],
                }
            )
        else:
            course.write(
                {
                    "sequence": (idx + 1) * 10,
                    "start_date": calendar[start_idx],
                    "end_date": calendar[end_idx - 1],
                }
            )
        set_translations(course, "name", name_en, name_ar)
        courses[key] = course

    # ---- enroll all 7 trainees ----
    for trainee in trainees:
        get_or_create_enrollment(env, program, trainee.partner_id)

    # ---- surveys (trainee / supervisor / trainer), bilingual, with
    # PROJECT_SPEC section 12's own rating scale and content areas.
    # Each question_defs tuple is
    # (title_en, title_ar, question_type, kpi_category, mandatory). ----
    trainee_survey = get_or_create_survey_with_questions(
        env,
        "Daily Trainee Survey",
        "استبانة المتدربة اليومية",
        "trainee",
        [
            (
                "Rate the trainer's performance today",
                "قيّمي أداء المدربة اليوم",
                "simple_choice",
                "trainer_performance",
                False,
            ),
            (
                "Rate the quality of the training content",
                "قيّمي جودة محتوى التدريب",
                "simple_choice",
                "content",
                False,
            ),
            (
                "Rate the training environment",
                "قيّمي بيئة التدريب",
                "simple_choice",
                "environment",
                False,
            ),
            (
                "Additional comments (optional)",
                "ملاحظات إضافية (اختياري)",
                "char_box",
                None,
                False,
            ),
        ],
    )
    q_trainer_perf = trainee_survey.question_and_page_ids.filtered(
        lambda q: q.title == "Rate the trainer's performance today"
    )
    q_content = trainee_survey.question_and_page_ids.filtered(
        lambda q: q.title == "Rate the quality of the training content"
    )
    q_environment = trainee_survey.question_and_page_ids.filtered(
        lambda q: q.title == "Rate the training environment"
    )

    supervisor_survey = get_or_create_survey_with_questions(
        env,
        "Supervisor Evaluation Survey",
        "استبانة تقييم المشرفة",
        "supervisor",
        [
            (
                "Rate the training day's environment and organization",
                "قيّمي بيئة وتنظيم اليوم التدريبي",
                "simple_choice",
                "environment",
                False,
            ),
            ("Supervisor notes", "ملاحظات المشرفة", "char_box", None, False),
        ],
    )
    q_sup_environment = supervisor_survey.question_and_page_ids.filtered(
        lambda q: q.title == "Rate the training day's environment and organization"
    )

    trainer_survey = get_or_create_survey_with_questions(
        env,
        "Trainer Daily Report",
        "التقرير اليومي للمدربة",
        "trainer",
        [
            (
                "Notes on trainee interaction and engagement",
                "ملاحظات حول تفاعل المتدربات",
                "char_box",
                None,
                False,
            ),
            (
                "Scientific/technical notes",
                "الملاحظات العلمية والفنية",
                "char_box",
                None,
                True,
            ),
            (
                "Recommendations for improvement",
                "توصيات للتحسين",
                "char_box",
                None,
                False,
            ),
        ],
    )

    # ---- 32 training days ----
    today = odoo_fields.Date.today()
    next_day_index = None
    for i, day_date in enumerate(calendar):
        if day_date >= today:
            next_day_index = i
            break

    course_for_index = {}
    for key, _en, _ar, start_idx, end_idx in COURSE_DEFS:
        for i in range(start_idx, end_idx):
            course_for_index[i] = courses[key]

    days = []
    for i, day_date in enumerate(calendar):
        course = course_for_index[i]
        existing = env["training.day"].search(
            [("course_id", "=", course.id), ("date", "=", day_date)],
            limit=1,
        )
        day_values = {
            "course_id": course.id,
            "date": day_date,
            "start_datetime": odoo_fields.Datetime.to_datetime(day_date).replace(hour=9),
            "end_datetime": odoo_fields.Datetime.to_datetime(day_date).replace(hour=13),
            "supervisor_id": supervisor.id,
            "trainer_ids": [(6, 0, [trainer.id])],
            # Full calendar day (00:00-23:59), not just the 4-hour
            # session window, so the survey stays submittable
            # regardless of what time of day this script happens to
            # run or the UAT tester happens to log in.
            "survey_open_at": odoo_fields.Datetime.to_datetime(day_date).replace(hour=0, minute=0),
            "survey_close_at": odoo_fields.Datetime.to_datetime(day_date).replace(hour=23, minute=59),
            "trainee_survey_id": trainee_survey.id,
            "supervisor_survey_id": supervisor_survey.id,
            "trainer_survey_id": trainer_survey.id,
        }
        if existing:
            # Never touch `state` on an existing day -- only the
            # Back-office workflow (or a supervisor/trainer via the
            # Operational UI) should change it once created, so a
            # re-run of this script can never undo manual UAT testing.
            existing.write(day_values)
            days.append(existing)
        else:
            if next_day_index is None:
                target_state = "closed"
            elif i < next_day_index:
                target_state = "closed"
            elif i == next_day_index:
                target_state = "open"
            else:
                target_state = "planned"
            day = env["training.day"].create({**day_values, "state": target_state})
            days.append(day)

    # ---- seed realistic historical data for the first 2 days only ----
    seed_days = [d for d in days if d.date < today][:2]
    enrollments = env["training.enrollment"].search([("program_id", "=", program.id)])
    ratings_by_trainee = [4, 5, 3, 4, 5, 4, 3]  # varied, realistic scores
    for day in seed_days:
        for idx, enrollment in enumerate(enrollments):
            status = "late" if idx == 1 else ("absent" if idx == 5 else "present")
            attendance = env["training.attendance"].search(
                [("training_day_id", "=", day.id), ("enrollment_id", "=", enrollment.id)],
                limit=1,
            )
            att_vals = {"status": status, "late_minutes": 10 if status == "late" else 0}
            if attendance:
                attendance.write(att_vals)
            else:
                env["training.attendance"].create(
                    {
                        "training_day_id": day.id,
                        "enrollment_id": enrollment.id,
                        **att_vals,
                    }
                )
            if status == "absent":
                continue  # an absent trainee has no survey response
            rating = ratings_by_trainee[idx % len(ratings_by_trainee)]
            trainee_ui = env["survey.user_input"].search(
                [
                    ("training_day_id", "=", day.id),
                    ("respondent_role", "=", "trainee"),
                    ("partner_id", "=", enrollment.partner_id.id),
                ],
                limit=1,
            )
            if not trainee_ui:
                trainee_ui = env["survey.user_input"].create(
                    {
                        "survey_id": trainee_survey.id,
                        "training_day_id": day.id,
                        "respondent_role": "trainee",
                        "partner_id": enrollment.partner_id.id,
                        "state": "in_progress",
                    }
                )
            if trainee_ui.state != "done":
                for question in (q_trainer_perf, q_content, q_environment):
                    options = ensure_rating_scale(env, question)
                    line = env["survey.user_input.line"].search(
                        [
                            ("user_input_id", "=", trainee_ui.id),
                            ("question_id", "=", question.id),
                        ],
                        limit=1,
                    )
                    line_vals = {
                        "answer_type": "suggestion",
                        "suggested_answer_id": options[rating].id,
                        "skipped": False,
                    }
                    if line:
                        line.write(line_vals)
                    else:
                        env["survey.user_input.line"].create(
                            {
                                "user_input_id": trainee_ui.id,
                                "question_id": question.id,
                                **line_vals,
                            }
                        )
                trainee_ui.write({"state": "done"})

        # Supervisor evaluation for this day.
        supervisor_ui = env["survey.user_input"].search(
            [
                ("training_day_id", "=", day.id),
                ("respondent_role", "=", "supervisor"),
                ("partner_id", "=", supervisor.partner_id.id),
            ],
            limit=1,
        )
        if not supervisor_ui:
            supervisor_ui = env["survey.user_input"].create(
                {
                    "survey_id": supervisor_survey.id,
                    "training_day_id": day.id,
                    "respondent_role": "supervisor",
                    "partner_id": supervisor.partner_id.id,
                    "state": "in_progress",
                }
            )
        if supervisor_ui.state != "done":
            options = ensure_rating_scale(env, q_sup_environment)
            env["survey.user_input.line"].create(
                {
                    "user_input_id": supervisor_ui.id,
                    "question_id": q_sup_environment.id,
                    "answer_type": "suggestion",
                    "suggested_answer_id": options[4].id,
                    "skipped": False,
                }
            )
            supervisor_ui.write({"state": "done"})

        # Trainer report for this day.
        trainer_ui = env["survey.user_input"].search(
            [
                ("training_day_id", "=", day.id),
                ("respondent_role", "=", "trainer"),
                ("partner_id", "=", trainer.partner_id.id),
            ],
            limit=1,
        )
        if not trainer_ui:
            trainer_ui = env["survey.user_input"].create(
                {
                    "survey_id": trainer_survey.id,
                    "training_day_id": day.id,
                    "respondent_role": "trainer",
                    "partner_id": trainer.partner_id.id,
                    "state": "in_progress",
                }
            )
        if trainer_ui.state != "done":
            technical_question = env["survey.question"].search(
                [("survey_id", "=", trainer_survey.id), ("constr_mandatory", "=", True)],
                limit=1,
            )
            env["survey.user_input.line"].create(
                {
                    "user_input_id": trainer_ui.id,
                    "question_id": technical_question.id,
                    "answer_type": "char_box",
                    "value_char_box": "Sample seeded note for demo/UAT purposes.",
                    "skipped": False,
                }
            )
            trainer_ui.write({"state": "done"})

    env.cr.commit()

    open_day = next((d for d in days if d.state == "open"), None)
    print("=" * 70)
    print("Dev data loaded.")
    print("Program: %s (id=%s)" % (program.name, program.id))
    print("Courses (%d):" % len(courses))
    for key, name_en, _name_ar, start_idx, end_idx in COURSE_DEFS:
        c = courses[key]
        print("  - %s  [%s .. %s]  (%d days)" % (c.name, calendar[start_idx], calendar[end_idx - 1], end_idx - start_idx))
    print("Training days: %d total (%d closed, %d open, %d planned)" % (
        len(days),
        len([d for d in days if d.state == "closed"]),
        len([d for d in days if d.state == "open"]),
        len([d for d in days if d.state == "planned"]),
    ))
    if open_day:
        print("Current OPEN day: %s (id=%s)" % (open_day.date, open_day.id))
    print("Seeded historical data (attendance + all 3 surveys) for: %s" % (
        ", ".join(str(d.date) for d in seed_days)
    ))
    print("-" * 70)
    print("Demo accounts (password: %s for all):" % DEMO_PASSWORD)
    for login, _name in TRAINEE_LOGINS:
        print("  trainee:    %s" % login)
    print("  supervisor: dev_supervisor")
    print("  trainer:    dev_trainer")
    print("=" * 70)


main(env)  # noqa: F821  (env is injected by `odoo-bin shell`)
