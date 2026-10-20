"""Unified development / demo dataset (the ONLY seed scenario of the project).

Run it through the loader, never directly:

    ./scripts/load_dev_data.sh [db_name]        # default: training_management_dev

The loader first runs scripts/seed_surveys.py (the single source of the
approved survey questions, docs/SURVEY_QUESTIONS.md) and then this file, both
through `odoo-bin shell`. Neither is loaded by module installation.

What it builds (all Arabic/English via Odoo's translate=True mechanism): a
16-week leadership program for women Quran-school principals (Tuesday and
Thursday, 32 training days, five courses), every one of the four
roles (general supervisor, supervisor, five trainers, 18 trainees), and a
realistic history of attendance, the three survey types, reports and audit
entries with a few scenarios (hall failure, theory-heavy course, a withdrawn trainee, a
postponed and a rescheduled day, a reopened day, a response correction). One
upcoming day is left OPEN so every role has something to act on.

Reports are generated without a PDF here (see main(): report.url is
redirected inside the load's own transaction only), so the load works while an
Odoo server is running; the PDF is produced on demand from Odoo.

Safety
------
* Refuses any database whose name is not training_management_dev* or
  training_management_demo*, and any Odoo configuration that looks like
  production (proxy_mode on, list_db off). It never creates, drops or
  recreates a database; the database must already have training_management
  installed.
* Idempotent and non-destructive. Every entity is matched on a stable key
  (user login, program name, course sequence, program + date) and an existing
  one is left exactly as it is: no field, state, password, response or
  attendance is overwritten, so re-running never undoes UAT progress. History
  is recorded only into training days created by the same run.
* Business rules are not bypassed: everything goes through the normal model
  methods as the proper role user. Only the HISTORICAL timestamps of records
  created by a fresh run are set afterwards with SQL.
* A database loaded by the retired demo scripts (accounts @nooralqiyadah.example)
  is refused instead of getting a second, overlapping program.

Accounts: all share the published, local-only password Dev12345!, including the
built-in admin. A password is set only when an account is CREATED (and the
built-in admin's on the very first load of the dataset); a reload never changes
an existing password. To reset them on purpose, pass --reset-passwords to the
loader (DEV_DATA_RESET_PASSWORDS=1): every account of the dataset and the
built-in admin get Dev12345! again. Nothing else is touched.
    dev_gs (general supervisor), dev_supervisor,
    dev_trainer / dev_trainer_2..5, dev_trainee / dev_trainee_2..18
"""
import os
import random
import re
import traceback
from datetime import date, datetime, time, timedelta

PASSWORD = "Dev12345!"  # fixed, published, local-development-only; not a secret
EMAIL_DOMAIN = "example.com"
TZ_OFFSET = timedelta(hours=3)  # Asia/Riyadh = UTC+3 (no DST)
START = date(2026, 7, 7)  # first Tuesday of the cohort
SEED = 20260707  # per-day random streams are derived from it (deterministic)
# The only training roles of the project (docs/DECISIONS.md DEC-64).
ROLE_GROUP = {
    "admin": "training_management.group_training_admin",  # المشرف العام
    "supervisor": "training_management.group_training_supervisor",  # المشرفة
    "trainer": "training_management.group_training_trainer",  # المدربة
    "trainee": "training_management.group_training_trainee",  # المتدربة
}
ALLOWED_DB = re.compile(r"^training_management_(dev|demo)(_[a-z0-9]+)*$")

PROGRAM_EN = "Female Quran School Principals - Leadership Development Program"
PROGRAM_AR = "برنامج تطوير القيادة الإدارية لمديرات مدارس تحفيظ القرآن الكريم"
LEGACY_DEMO_DOMAIN = "nooralqiyadah.example"  # logins of the retired seed_demo.py

COURSES = [  # (ar, en, first day index, last day index)
    ("القيادة التربوية وبناء الرؤية", "Educational Leadership and Vision Building", 0, 6),
    ("الإدارة التنظيمية والمالية للمدارس", "School Organisational and Financial Management", 7, 13),
    ("تطوير الكوادر والإشراف التربوي", "Staff Development and Educational Supervision", 14, 19),
    ("الجودة والتخطيط المؤسسي", "Quality and Institutional Planning", 20, 25),
    ("التواصل المجتمعي والشراكات", "Community Communication and Partnerships", 26, 31),
]

TOPICS = [
    "مدخل إلى القيادة التربوية في مدارس تحفيظ القرآن الكريم",
    "صياغة الرؤية والرسالة والقيم للمدرسة",
    "أنماط القيادة وتشخيص الأسلوب القيادي",
    "بناء فريق العمل وتوزيع المهام",
    "إدارة الاجتماعات واتخاذ القرار",
    "القيادة بالقدوة وأخلاقيات المهنة",
    "ورشة تطبيقية: خطة رؤية مدرستي",
    "الهيكل التنظيمي والصلاحيات في المدرسة",
    "اللوائح والأنظمة المنظمة لحِلَق التحفيظ",
    "إدارة الموازنة والمصروفات",
    "الشراكات والموارد المالية والتبرعات",
    "إدارة المرافق والموارد البشرية",
    "إدارة الوقت وترتيب الأولويات",
    "ورشة تطبيقية: موازنة سنوية مصغّرة",
    "مفهوم الإشراف التربوي وأدواته",
    "تقييم أداء المعلمات والتغذية الراجعة",
    "تصميم خطة تطوير مهني للمعلمات",
    "الزيارة الصفية: التخطيط والملاحظة",
    "إدارة الأداء والتحفيز",
    "ورشة تطبيقية: بطاقة ملاحظة صفية",
    "مبادئ إدارة الجودة في المؤسسات التعليمية",
    "التخطيط الاستراتيجي للمدرسة",
    "مؤشرات الأداء وقياس الأثر",
    "إدارة المخاطر والأزمات",
    "التحسين المستمر ودورة الجودة",
    "ورشة تطبيقية: الخطة التشغيلية السنوية",
    "التواصل الفعّال مع أولياء الأمور",
    "الشراكات المجتمعية وبناء العلاقات",
    "التسويق المؤسسي والهوية الإعلامية للمدرسة",
    "إدارة الاختلاف وحل النزاعات",
    "قياس رضا المستفيدات",
    "ختام البرنامج: عرض المشاريع التطبيقية وتكريم الخريجات",
]


# ---------------------------------------------------------------- people
# (login, name, phone, function, city)
GENERAL_SUPERVISOR = ("dev_gs", "هدى الغامدي", "+966501110001", "المشرفة العامة على البرنامج", "الرياض")
SUPERVISOR = ("dev_supervisor", "أمل الزهراني", "+966550010001", "المشرفة التنفيذية على البرنامج", "الرياض")
TRAINERS = {  # key -> data; the key is the course index (T1 teaches course 1 ...)
    "T1": ("dev_trainer", "خلود العنزي", "+966550020001", "مدربة القيادة التربوية", "الرياض"),
    "T2": ("dev_trainer_2", "سلمى البقمي", "+966501110012", "مدربة الإدارة المالية والتنظيمية", "جدة"),
    "T3": ("dev_trainer_3", "عائشة السبيعي", "+966501110013", "مدربة الإشراف التربوي", "الرياض"),
    "T4": ("dev_trainer_4", "جواهر العنزي", "+966501110014", "مدربة الجودة والتخطيط", "بريدة"),
    "T5": ("dev_trainer_5", "فوزية الزهراني", "+966501110015", "مدربة التواصل المجتمعي", "مكة المكرمة"),
}
# (login, name, school, city); phone is derived from the position
TRAINEES = [
    ("dev_trainee", "فاطمة العتيبي", "مدرسة أم سلمة لتحفيظ القرآن الكريم", "الرياض"),
    ("dev_trainee_2", "نورة القحطاني", "مدرسة خديجة بنت خويلد لتحفيظ القرآن الكريم", "الرياض"),
    ("dev_trainee_3", "سارة الحربي", "مدرسة أسماء بنت أبي بكر لتحفيظ القرآن الكريم", "حائل"),
    ("dev_trainee_4", "منى الدوسري", "مدرسة حفصة بنت عمر لتحفيظ القرآن الكريم", "الدمام"),
    ("dev_trainee_5", "هند الشمري", "مدرسة عائشة أم المؤمنين لتحفيظ القرآن الكريم", "جدة"),
    ("dev_trainee_6", "ريم الغامدي", "مدرسة الخنساء لتحفيظ القرآن الكريم", "بريدة"),
    ("dev_trainee_7", "لطيفة المطيري", "مدرسة رقية بنت النبي لتحفيظ القرآن الكريم", "الطائف"),
    ("dev_trainee_8", "هيفاء السهلي", "مدرسة أم عمارة لتحفيظ القرآن الكريم", "أبها"),
    ("dev_trainee_9", "أروى الحارثي", "مدرسة زينب بنت جحش لتحفيظ القرآن الكريم", "الباحة"),
    ("dev_trainee_10", "شهد الشهراني", "مدرسة صفية بنت عبد المطلب لتحفيظ القرآن الكريم", "خميس مشيط"),
    ("dev_trainee_11", "عبير الغامدي", "مدرسة أم حرام لتحفيظ القرآن الكريم", "الباحة"),
    ("dev_trainee_12", "فاطمة العسيري", "مدرسة نسيبة بنت كعب لتحفيظ القرآن الكريم", "المدينة المنورة"),
    ("dev_trainee_13", "وفاء الرشيدي", "مدرسة أم كلثوم لتحفيظ القرآن الكريم", "عرعر"),
    ("dev_trainee_14", "دانة الجهني", "مدرسة سمية بنت خياط لتحفيظ القرآن الكريم", "المدينة المنورة"),
    ("dev_trainee_15", "بدور الخالدي", "مدرسة أم الدرداء لتحفيظ القرآن الكريم", "الأحساء"),
    ("dev_trainee_16", "حصة العنزي", "مدرسة فاطمة الزهراء لتحفيظ القرآن الكريم", "عنيزة"),
    ("dev_trainee_17", "غادة اليامي", "مدرسة أم أيمن لتحفيظ القرآن الكريم", "نجران"),
    ("dev_trainee_18", "تهاني القرني", "مدرسة الشفاء بنت عبد الله لتحفيظ القرآن الكريم", "الرياض"),
]
WITHDRAWN = "dev_trainee_16"  # withdraws after day index 11 (13 August)
WITHDRAWAL_AFTER = 11
OFTEN_LATE = "dev_trainee_18"
OFTEN_ABSENT = "dev_trainee_13"
CRITICAL = "dev_trainee_7"  # a demanding evaluator
GENEROUS = "dev_trainee"
CORRECTED = ("dev_trainee_11", 21)  # corrects a wrong rating after day 21 (17 Sep)

# which trainers teach each day (default: the course trainer)
COURSE_TRAINER = ["T1", "T2", "T3", "T4", "T5"]
EXTRA_TRAINERS = {2: ["T5"], 21: ["T3"], 25: ["T1"], 29: ["T2"], 31: ["T1"]}
MOVED_DAY = 12  # postponed (trainer ill), held on Sunday 23 August
MOVED_TO = date(2026, 8, 23)
POSTPONED_DAY = 27  # 8 October, postponed again, no new date yet
HALL_ISSUE = {8: 2.9, 9: 2.8, 10: 3.1}  # environment mean during the air-conditioning failure
LATE_RAIN = {18: 0.38}  # 8 September: heavy traffic after rain
TRAINER_MEAN = {0: 4.5, 1: 4.6, 2: 4.4, 3: 4.5, 4: 4.6, 5: 4.5, 6: 4.7,
                7: 4.2, 8: 4.2, 9: 4.3, 10: 4.3, 11: 4.4, 12: 4.4, 13: 4.5,
                14: 4.4, 15: 4.5, 16: 4.5, 17: 4.6, 18: 4.5, 19: 4.6,
                20: 3.7, 21: 3.9, 22: 4.1, 23: 4.4, 24: 4.5, 25: 4.6}
CONTENT_MEAN = {14: 3.3, 15: 3.5, 16: 4.3, 17: 4.5, 18: 4.5, 19: 4.6}  # default 4.3
REOPENED_DAY = 19  # closed, reopened to fix two attendance records, closed again

# ---------------------------------------------------------------- texts
TRAINEE_COMMENTS = {
    "positive": [
        "محتوى الجلسة قريب من واقع عملي في المدرسة وسأطبّقه الأسبوع القادم.",
        "أسلوب المدربة جعل النقاش ثريًا، وأفدت كثيرًا من تجارب الزميلات.",
        "التمارين التطبيقية كانت مفيدة وربطت المفاهيم بما نعيشه في الحلقات.",
        "جلسة منظمة وواضحة، والوقت كان موزعًا بشكل جيد بين الشرح والتطبيق.",
        "استفدت من النماذج الجاهزة وسأعمل على تكييفها لمدرستي.",
        "أشكر الفريق على الاستقبال والتنظيم، والقاعة مهيأة للتعلّم.",
    ],
    "mixed": [
        "الفكرة ممتازة لكن أتمنى زيادة الوقت المخصص للتطبيق العملي.",
        "المحتوى جيد، ويحتاج إلى أمثلة أكثر من مدارس مختلفة.",
        "استفدت من الجلسة، وأقترح إرسال المادة العلمية قبل الجلسة بيوم.",
        "الوقت كان ضيقًا لبعض الأنشطة، ويمكن تقليل الشرح النظري قليلًا.",
    ],
    "hall": [
        "الحرارة في القاعة أثّرت على تركيزنا، نرجو إصلاح التكييف أو تغيير القاعة.",
        "المحتوى جيد لكن القاعة حارّة جدًا وكان من الصعب متابعة الشرح.",
        "نحتاج إلى قاعة مهيأة بشكل أفضل؛ التكييف لا يعمل بشكل جيد.",
    ],
    "hall_fixed": [
        "شكرًا على نقل البرنامج إلى القاعة الجديدة، الأجواء أفضل بكثير.",
        "القاعة الجديدة مريحة وساعدتنا على التركيز، جزاكم الله خيرًا.",
    ],
    "theory": [
        "الجلسة كانت نظرية أكثر من اللازم، نحتاج إلى حالات تطبيقية من الميدان.",
        "المفاهيم مهمة لكن أتمنى ربطها بأمثلة من مدارس التحفيظ.",
    ],
    "theory_fixed": [
        "دراسات الحالة التي أضافتها المدربة قرّبت الفكرة كثيرًا، شكرًا لها.",
        "التطبيق على حالات حقيقية من مدارسنا كان أفضل جزء في الجلسة.",
    ],
    "traffic": [
        "تأخرت بسبب الزحام بعد المطر، وأشكر الفريق على تفهّمهم.",
    ],
}
TRAINER_NOTES = {
    0: [
        "تفاعل المتدربات جيد منذ اللقاء الأول، وظهر اهتمام واضح بمفهوم القيادة التربوية.",
        "طُرح مفهوم الرؤية وناقشت المتدربات أمثلة من مدارسهن، وبعضهن لم يسبق لهن صياغة رؤية مكتوبة.",
        "نُفّذ تشخيص الأسلوب القيادي بالاستبيان، وكان التفاعل ممتازًا مع المحاضِرة الضيفة.",
        "ظهر تعاون جيد في تمرين توزيع المهام وبناء الفريق.",
        "تدرّبت المتدربات على إدارة اجتماع قصير وكتابة محضر القرار.",
        "نوقشت أخلاقيات المهنة بعمق وطُرحت مواقف حقيقية من الميدان.",
        "عُرضت خطط الرؤية، وكانت جودة المخرجات جيدة جدًا مقارنة ببداية الدورة.",
    ],
    1: [
        "فهمت المتدربات الهيكل التنظيمي، مع حاجة لتوضيح الفرق بين الصلاحيات والمسؤوليات.",
        "اللوائح مألوفة لدى المتدربات القديمات وجديدة على غيرهن، وتبادلن الخبرات.",
        "تدريب الموازنة كشف ضعفًا في تقدير المصروفات التشغيلية لدى أغلب المتدربات.",
        "تأثر التركيز بسبب حرارة القاعة، واختصرنا الفقرة النظرية وركّزنا على النقاش.",
        "استمرت مشكلة القاعة، لكن التفاعل بقي مقبولًا بعد تقسيم المتدربات إلى مجموعات.",
        "بعد نقل البرنامج إلى القاعة الجديدة تحسن التفاعل والتركيز بوضوح.",
        "التطبيق على الموازنة السنوية كان جيدًا وقدّمت المجموعات تصورات واقعية.",
    ],
    2: [
        "تفاعل جيد مع مفهوم الإشراف التربوي وأدواته.",
        "كان التقييم والتغذية الراجعة من أكثر الموضوعات حاجة إلى تدريب عملي.",
        "صممت المتدربات خطط تطوير مهني بدرجة نضج جيدة.",
        "تدريب الزيارة الصفية عبر الفيديو كان فعّالًا ونتجت عنه أسئلة عميقة.",
        "نوقشت أساليب التحفيز وربطها بالأداء، وظهر اهتمام كبير.",
        "قدّمت المتدربات بطاقات ملاحظة صفية جاهزة للتطبيق في مدارسهن.",
    ],
    3: [
        "الجلسة الأولى في الجودة: المصطلحات جديدة على أغلب المتدربات، وأعدّلُ الإيقاع في الجلسات القادمة.",
        "تحسّن التفاعل بعد استخدام أمثلة مبسطة، وتحتاج المتدربات إلى مزيد من التدريب على صياغة الأهداف.",
        "تفاعل جيد مع التخطيط الاستراتيجي، وتعاونت المحاضِرة المشاركة في ربطه بالإشراف التربوي.",
        "مؤشرات الأداء من أصعب الموضوعات، ونجح تمرين قياس الأثر في توضيحها.",
        "نوقشت إدارة المخاطر بحالات واقعية، وكان النقاش ثريًا.",
        "عُرضت الخطط التشغيلية، وكان مستوى المخرجات متقدمًا.",
    ],
    4: [
        "أول لقاء في الدورة الأخيرة، والحماس للتواصل المجتمعي واضح.",
        "نوقشت الشراكات المجتمعية وأفكار لبناء علاقات مع الجهات المحلية.",
        "تدريب على كتابة رسالة إعلامية للمدرسة.",
        "نوقشت أساليب حل النزاعات بأمثلة من المدارس.",
        "تدرّبت المتدربات على تصميم استبيان رضا للمستفيدات.",
        "عروض المشاريع التطبيقية والختام.",
    ],
}
TRAINER_RECS = [
    "أوصي بإرسال المادة العلمية للمتدربات قبل الجلسة بيوم لتحسين الاستفادة.",
    "الاستمرار في الأنشطة الجماعية لأنها رفعت التفاعل بوضوح.",
    "زيادة وقت التطبيق العملي في الجلسة القادمة على حساب الشرح النظري.",
    "ربط الموضوع القادم بمشاريع المتدربات في مدارسهن.",
    "تخصيص خمس دقائق في بداية الجلسة لمراجعة تطبيقات الأسبوع الماضي.",
    "توفير نسخ مطبوعة من النماذج المستخدمة في الورشة.",
]
SUPERVISOR_NOTES = [
    "سار اليوم بانتظام، وبدأت الجلسة في موعدها والحضور مستقر.",
    "التنظيم جيد وتجاوب المتدربات ممتاز مع المدربة.",
    "جميع التجهيزات متوفرة، ولا توجد ملاحظات تشغيلية تُذكر.",
    "تم توزيع المواد في الوقت المناسب وسارت فترات الاستراحة كما هو مخطط.",
    "تفاعل المتدربات في النقاش مرتفع، وتم الالتزام بالجدول الزمني.",
]
INCIDENTS = {
    8: "تعطّل جهاز التكييف في القاعة الرئيسية، وتم فتح النوافذ وتشغيل مراوح إضافية، وأُبلغت الجهة المضيفة.",
    9: "استمرت مشكلة التكييف رغم الصيانة المؤقتة، وتأثر تركيز المتدربات بحرارة القاعة؛ رُفع طلب لتغيير القاعة.",
    10: "المشكلة ذاتها مستمرة؛ اتُّفق مع الجهة المضيفة على نقل البرنامج إلى القاعة الثانية بدءًا من الجلسة القادمة.",
    11: "انتقل البرنامج إلى القاعة الثانية بنجاح، والأجواء أفضل ولا توجد ملاحظات.",
    14: "الدورة الثالثة تبدأ اليوم؛ لاحظنا من الحضور ومن ردود الفعل أن الجلسة نظرية أكثر من اللازم.",
    18: "تأخر عدد من المتدربات بسبب زحام السير بعد الأمطار، وبدأت الجلسة بعد 20 دقيقة من موعدها.",
    19: "تم تصحيح سجل الحضور لمتدربتين بعد مراجعته مع المدربة، وأُعيد فتح اليوم من المشرفة العامة.",
}
SUPERVISOR_FLOW_NOTES = {
    8: "سير اليوم تأثر بالحرارة وقُصّرت الجلسة الثانية عشر دقائق.",
    18: "تأخر بدء الجلسة 20 دقيقة وتم تعويضه بتقليص فترة الاستراحة.",
}



# ---------------------------------------------------------------- helpers
def local_dt(day, hour, minute=0):
    """Riyadh local wall time -> naive UTC datetime (what Odoo stores)."""
    return datetime.combine(day, time(hour, minute)) - TZ_OFFSET


def clamp(value, low=1, high=5):
    return max(low, min(high, value))


def rate(rng, mean, spread=0.55):
    return clamp(int(round(rng.gauss(mean, spread))))


def set_ar(record, field, ar):
    """Write ONLY the Arabic translation of a translate=True field. A plain
    with_context(lang="ar_001").write() also overwrites the English source when
    the shell user's own language is ar_001 (any database installed with
    --load-language=ar_001), which would break the by-name lookups below."""
    record.update_field_translations(field, {"ar_001": ar})


def assert_safe_environment(env, need_surveys=True):
    """Refuse anything that is not a local development/demo database."""
    from odoo.tools import config  # noqa: PLC0415

    dbname = env.cr.dbname
    if not ALLOWED_DB.match(dbname):
        raise SystemExit(
            "Refusing to run: %r is not a development/demo database (the name must "
            "match training_management_dev* or training_management_demo*)." % dbname
        )
    if config["proxy_mode"] or not config["list_db"]:
        raise SystemExit(
            "Refusing to run: the Odoo configuration looks like production "
            "(proxy_mode on or list_db off). Use a local development configuration."
        )
    installed = env["ir.module.module"].search_count(
        [("name", "=", "training_management"), ("state", "=", "installed")]
    )
    if not installed:
        raise SystemExit("training_management is not installed in %r; install it first." % dbname)
    for role in ("trainee", "supervisor", "trainer") if need_surveys else ():
        if not env.ref("training_management.survey_approved_%s" % role, raise_if_not_found=False):
            raise SystemExit(
                "The approved surveys are missing; run scripts/seed_surveys.py first "
                "(scripts/load_dev_data.sh does)."
            )
    if env["res.users"].with_context(active_test=False).search_count(
        [("login", "like", "%@" + LEGACY_DEMO_DOMAIN)]
    ):
        raise SystemExit(
            "This database was loaded by the retired demo scripts (accounts @%s). "
            "Loading the unified dataset would add a second, overlapping program; "
            "use a different development database." % LEGACY_DEMO_DOMAIN
        )


def main(env):  # noqa: C901 -- one linear scenario, kept in order
    from odoo import fields  # noqa: PLC0415

    if os.environ.get("DEV_DATA_PREFLIGHT") == "1":
        # Run by the loader BEFORE seed_surveys.py, so every guard fires before
        # anything is written; the surveys do not exist yet on a fresh database.
        assert_safe_environment(env, need_surveys=False)
        print("Preflight OK for %s" % env.cr.dbname)
        return
    assert_safe_environment(env)
    # Report generation renders a PDF with wkhtmltopdf, which fetches its assets
    # over HTTP from report.url / web.base.url. With an Odoo server running on
    # that URL, the server and this still-uncommitted transaction block each
    # other on the same asset attachment and the load hangs without ever
    # committing (no accounts get created). So for this transaction only the URL
    # points at a closed port: the PDF step fails fast (a warning) while the
    # report data is still generated, exactly as when no server is running. The
    # previous value is restored before the commit, so nothing persists and the
    # live server never sees it. PDFs are produced on demand from Odoo.
    reset_passwords = os.environ.get("DEV_DATA_RESET_PASSWORDS") == "1"
    config_params = env["ir.config_parameter"].sudo()
    previous_report_url = config_params.get_param("report.url")
    config_params.set_param("report.url", "http://127.0.0.1:1")
    cr = env.cr
    dbname = cr.dbname
    today = fields.Date.today()
    Users = env["res.users"]
    made = {}  # what THIS run created, by kind

    def count(kind, n=1):
        made[kind] = made.get(kind, 0) + n

    def sql_set(table, ids, **columns):
        if not ids:
            return
        env.flush_all()  # pending ORM writes must not overwrite the history below
        sets = ", ".join("%s = %%s" % c for c in columns)
        cr.execute(
            "UPDATE %s SET %s WHERE id IN %%s" % (table, sets),
            list(columns.values()) + [tuple(ids)],
        )
        env.invalidate_all()

    cr.execute("SELECT COALESCE(MAX(id), 0) FROM training_audit_log")
    audit_cursor = [cr.fetchone()[0]]  # only entries written by this run are re-dated

    def stamp_audit(when):
        """Give the audit entries written since the last call a realistic time."""
        cr.execute("SELECT id FROM training_audit_log WHERE id > %s", (audit_cursor[0],))
        ids = [r[0] for r in cr.fetchall()]
        sql_set("training_audit_log", ids, create_date=when, write_date=when)
        cr.execute("SELECT COALESCE(MAX(id), 0) FROM training_audit_log")
        audit_cursor[0] = cr.fetchone()[0]

    # ---------------------------------------------------------- language
    env["res.lang"]._activate_lang("ar_001")
    saudi = env.ref("base.sa")

    # ---------------------------------------------------------- accounts
    admin = env.ref("base.user_admin")
    base_user = env.ref("base.group_user")

    def ensure_user(data, group_xmlid, function=None, city=None):
        """Existing account (even disabled) -> returned untouched."""
        login, name, phone = data[0], data[1], data[2]
        user = Users.with_context(active_test=False).search([("login", "=", login)], limit=1)
        if user:
            return user
        function = function or data[3]
        city = city or data[4]
        user = Users.with_user(admin).with_context(no_reset_password=True).create(
            {"name": name, "login": login, "email": "%s@%s" % (login, EMAIL_DOMAIN),
             "lang": "ar_001", "tz": "Asia/Riyadh",
             "group_ids": [(4, base_user.id), (4, env.ref(group_xmlid).id)]}
        )
        user.password = PASSWORD
        user.partner_id.sudo().write(
            {"phone": phone, "function": function, "city": city, "country_id": saudi.id,
             "lang": "ar_001", "tz": "Asia/Riyadh"}
        )
        count("users")
        return user

    gs = ensure_user(GENERAL_SUPERVISOR, ROLE_GROUP["admin"])
    supervisor = ensure_user(SUPERVISOR, ROLE_GROUP["supervisor"])
    trainers = {
        key: ensure_user(data, ROLE_GROUP["trainer"])
        for key, data in TRAINERS.items()
    }
    trainee_users = {}
    for i, (login, name, school, city) in enumerate(TRAINEES, start=1):
        trainee_users[login] = ensure_user(
            (login, name, "+9665550001%02d" % i), ROLE_GROUP["trainee"],
            function="مديرة " + school, city=city,
        )
    fresh_accounts = bool(made.get("users"))

    # ---------------------------------------------------------- program and courses
    calendar = []
    for week in range(16):
        for offset in (0, 2):  # Tuesday, Thursday
            calendar.append(START + timedelta(weeks=week, days=offset))
    program = env["training.program"].with_context(active_test=False, lang="en_US").search(
        [("name", "=", PROGRAM_EN)], limit=1
    )
    program_created = not program
    if program_created:
        program = env["training.program"].with_user(gs).create(
            {"name": PROGRAM_EN, "start_date": calendar[0], "end_date": calendar[-1]}
        )
        set_ar(program, "name", PROGRAM_AR)
        program.state = "active"
        count("programs")
    if program_created:
        stamp_audit(local_dt(date(2026, 6, 22), 9, 30))
        company = env.company
        if company.name == "My Company":  # brand only a fresh load, and only the untouched default
            company.write({"name": "مركز نور القيادة للتدريب", "country_id": saudi.id, "city": "الرياض"})
            company.partner_id.write({"lang": "ar_001", "tz": "Asia/Riyadh"})
            count("company")

    # The built-in admin shares the dev password on the first load of the dataset,
    # and (like every account of the dataset) again on an explicit reset.
    # Otherwise existing passwords are never touched.
    if reset_passwords:
        for account in [gs, supervisor, *trainers.values(), *trainee_users.values()]:
            account.sudo().password = PASSWORD
            count("passwords reset")
    if program_created or reset_passwords:
        env.ref("base.user_admin").sudo().password = PASSWORD
        count("admin password set")

    courses = []  # by course index, matched on the program's sequence (10, 20 ...)
    new_courses = []
    by_sequence = {c.sequence: c for c in env["training.course"].search([("program_id", "=", program.id)])}
    for seq, (ar, en, first, last) in enumerate(COURSES, start=1):
        course = by_sequence.get(seq * 10)
        if not course:
            end = calendar[last]
            if first <= MOVED_DAY <= last:
                end = max(end, MOVED_TO)
            course = env["training.course"].with_user(gs).create(
                {"program_id": program.id, "name": en, "sequence": seq * 10,
                 "start_date": calendar[first], "end_date": end}
            )
            set_ar(course, "name", ar)
            new_courses.append(course)
            count("courses")
        courses.append(course)

    # ---------------------------------------------------------- enrollments
    enrollments, new_enrollments = {}, []
    for login, user in trainee_users.items():
        enr = env["training.enrollment"].with_context(active_test=False).search(
            [("program_id", "=", program.id), ("partner_id", "=", user.partner_id.id)], limit=1
        )
        if not enr:
            enr = env["training.enrollment"].with_user(gs).create(
                {"program_id": program.id, "partner_id": user.partner_id.id}
            )
            new_enrollments.append(enr)
            count("enrollments")
        enrollments[login] = enr
    if program_created:
        sql_set("training_enrollment", [e.id for e in new_enrollments], enrollment_date=date(2026, 6, 28))
    if fresh_accounts and program_created:
        stamp_audit(local_dt(date(2026, 6, 28), 10, 15))

    # ---------------------------------------------------------- surveys (single source: seed_surveys.py)
    survey = {
        role: env.ref("training_management.survey_approved_%s" % role)
        for role in ("trainee", "supervisor", "trainer")
    }

    def questions(role):
        return survey[role].question_and_page_ids.filtered(lambda q: not q.is_page).sorted("sequence")

    q_trainee, q_sup, q_trn = questions("trainee"), questions("supervisor"), questions("trainer")

    def option(question, value):
        return question.suggested_answer_ids.filtered(lambda o: o.rating_value == value)[:1]

    def choice(question, value):
        return {"question_id": question.id, "answer_option_id": option(question, value).id}

    # personalities: a small, stable lean per trainee
    lean_rng = random.Random(SEED)
    lean = {login: lean_rng.uniform(-0.25, 0.25) for login in trainee_users}
    lean[CRITICAL] = -0.7
    lean[GENEROUS] = 0.35

    # ---------------------------------------------------------- the training days
    existing_days = env["training.day"].with_context(active_test=False).search(
        [("course_id.program_id", "=", program.id)]
    )
    by_date, by_original_date = {}, {}
    for d in existing_days:
        by_date.setdefault(d.date, d)
        if d.postponed_from_date:
            by_original_date.setdefault(d.postponed_from_date, d)
    has_open_day = any(d.state == "open" for d in existing_days)
    # The nearest upcoming day is left OPEN (unless the database already has an
    # open day) so each role has a day to act on; it gets a wide survey window.
    open_index = None
    if not has_open_day:
        open_index = next(
            (i for i, d in enumerate(calendar)
             if i != POSTPONED_DAY and (MOVED_TO if i == MOVED_DAY else d) >= today),
            None,
        )

    def course_pos_of(index):
        return next(i for i, c in enumerate(COURSES) if c[2] <= index <= c[3])

    def trainers_of(index):
        keys = [COURSE_TRAINER[course_pos_of(index)]] + EXTRA_TRAINERS.get(index, [])
        users = [trainers[k] for k in keys]
        if index == open_index and trainers["T1"] not in users:
            users.append(trainers["T1"])
        return users

    day_records = {}  # index -> day record
    new_days = {}  # index -> day created by THIS run
    seeded = set()  # indexes whose history was recorded by THIS run
    response_ids_by_day = {}

    for index, day_date in enumerate(calendar):
        found = by_date.get(day_date) or by_original_date.get(day_date)
        if found:
            day_records[index] = found  # existing day: left exactly as it is
            continue
        rng = random.Random("%s-%s" % (SEED, index))
        course = courses[course_pos_of(index)]
        held_date = MOVED_TO if index == MOVED_DAY else day_date
        start_dt, end_dt = local_dt(held_date, 16), local_dt(held_date, 20)
        now = fields.Datetime.now()
        past = held_date < today and index != POSTPONED_DAY
        if index == open_index:
            survey_open = min(local_dt(day_date, 0), now - timedelta(hours=1))
            survey_close = max(local_dt(day_date, 20) + timedelta(hours=24), now + timedelta(days=7))
        elif past:
            survey_open, survey_close = now - timedelta(hours=1), now + timedelta(hours=2)
        else:
            survey_open, survey_close = local_dt(day_date, 16), local_dt(day_date, 20) + timedelta(hours=24)
        day = env["training.day"].with_user(gs).create(
            {
                "course_id": course.id,
                "date": day_date,
                "start_datetime": local_dt(day_date, 16),
                "end_datetime": local_dt(day_date, 20),
                "supervisor_id": supervisor.id,
                "trainer_ids": [(6, 0, [t.id for t in trainers_of(index)])],
                "survey_open_at": survey_open,
                "survey_close_at": survey_close,
                "trainee_survey_id": survey["trainee"].id,
                "supervisor_survey_id": survey["supervisor"].id,
                "trainer_survey_id": survey["trainer"].id,
            }
        )
        day.update_field_translations("topic", {"en_US": TOPICS[index], "ar_001": TOPICS[index]})
        day_records[index] = day
        new_days[index] = day
        count("days")
        if index == POSTPONED_DAY:
            day.write({"status_reason": "تعذّر حضور المدربة لظرف طارئ؛ سيُحدَّد موعد بديل وتُبلَّغ المتدربات."})
            day.with_user(gs).action_postpone()
            continue
        if index == MOVED_DAY:
            day.write({"status_reason": "مرض المدربة المكلّفة بالجلسة؛ أُجّلت الجلسة وعُقدت يوم الأحد 23 أغسطس."})
            day.with_user(gs).action_postpone()
            day.write({"date": MOVED_TO, "start_datetime": start_dt, "end_datetime": end_dt})
        if index == open_index:
            day.with_user(gs).action_open()
            continue
        if not past:
            continue  # future planned day: surveys are linked, nothing recorded yet

        # --- the day happens
        day.with_user(gs).action_open()
        active = [
            (login, enr) for login, enr in enrollments.items()
            if enr.state == "active" and trainee_users[login].active
        ]
        late_p = LATE_RAIN.get(index, 0.07)
        items, status_of = [], {}
        for login, enr in active:
            absent_p = 0.05 + (0.13 if login == OFTEN_ABSENT else 0)
            lp = late_p + (0.30 if login == OFTEN_LATE else 0)
            roll = rng.random()
            if roll < absent_p:
                status = "absent"
            elif roll < absent_p + lp:
                status = "late"
            else:
                status = "present"
            status_of[login] = status
            item = {"trainee_id": enr.id, "status": status}
            if status == "late":
                item["late_minutes"] = rng.choice([10, 12, 15, 20, 25]) if index != 18 else rng.choice([20, 25, 30, 35])
            items.append(item)
        day.with_user(supervisor).upsert_attendance(items, user=supervisor)

        # --- trainee surveys (present or late trainees only)
        t_mean = TRAINER_MEAN.get(index, 4.5)
        c_mean = CONTENT_MEAN.get(index, 4.3)
        e_mean = HALL_ISSUE.get(index, 4.3 if index != 18 else 4.1)
        resp_ids = []
        for login, enr in active:
            if status_of[login] == "absent":
                continue
            if rng.random() > (0.93 if status_of[login] == "present" else 0.82):
                continue  # forgot to fill the form
            user = trainee_users[login]
            bias = lean[login]
            answers = []
            for q in q_trainee[:3]:
                answers.append(choice(q, rate(rng, t_mean + bias)))
            for q in q_trainee[3:6]:
                answers.append(choice(q, rate(rng, c_mean + bias)))
            for q in q_trainee[6:9]:
                answers.append(choice(q, rate(rng, e_mean + bias)))
            if rng.random() < 0.45:
                if index in HALL_ISSUE:
                    pool = TRAINEE_COMMENTS["hall"]
                elif index == 11:
                    pool = TRAINEE_COMMENTS["hall_fixed"]
                elif index in (14, 15):
                    pool = TRAINEE_COMMENTS["theory"]
                elif index in (16, 17):
                    pool = TRAINEE_COMMENTS["theory_fixed"] if rng.random() < 0.5 else TRAINEE_COMMENTS["positive"]
                elif index == 18 and status_of[login] == "late" and rng.random() < 0.6:
                    pool = TRAINEE_COMMENTS["traffic"]
                elif login == CRITICAL:
                    pool = TRAINEE_COMMENTS["mixed"]
                else:
                    pool = TRAINEE_COMMENTS["positive"] if rng.random() < 0.75 else TRAINEE_COMMENTS["mixed"]
                answers.append({"question_id": q_trainee[9].id, "text": rng.choice(pool)})
            resp = day.submit_survey_response("trainee", answers, user=user)
            resp_ids.append(resp.id)

        # --- supervisor evaluation
        sup_env = rate(rng, min(4.5, e_mean + 0.2), 0.3)
        sup_flow = rate(rng, 4.3 if index not in (8, 9, 18) else 3.4, 0.3)
        sup_answers = [choice(q_sup[0], sup_env), choice(q_sup[1], sup_flow)]
        sup_answers.append(
            {"question_id": q_sup[2].id,
             "text": SUPERVISOR_FLOW_NOTES.get(index) or rng.choice(SUPERVISOR_NOTES)}
        )
        if index in INCIDENTS:
            sup_answers.append({"question_id": q_sup[3].id, "text": INCIDENTS[index]})
        resp_ids.append(day.submit_survey_response("supervisor", sup_answers, user=supervisor).id)

        # --- trainer reports (one per assigned trainer; the lead trainer saves a draft first)
        course_pos = course_pos_of(index)
        local_pos = index - COURSES[course_pos][2]
        for number, trainer in enumerate(trainers_of(index)):
            interaction = rate(rng, 4.2 if index not in HALL_ISSUE else 3.5, 0.4)
            notes = TRAINER_NOTES[course_pos][min(local_pos, len(TRAINER_NOTES[course_pos]) - 1)]
            if number > 0:
                notes = "شاركتُ في هذه الجلسة كمدربة ضيفة؛ " + notes.split("؛")[0].split("،")[0] + "."
            report = [
                choice(q_trn[0], interaction),
                {"question_id": q_trn[1].id, "text": notes},
                {"question_id": q_trn[2].id, "text": rng.choice(TRAINER_RECS)},
            ]
            if number == 0 and rng.random() < 0.4:
                day.save_draft_survey_response("trainer", report[:2], user=trainer)
            resp_ids.append(day.submit_survey_response("trainer", report, user=trainer).id)
        response_ids_by_day[index] = resp_ids

        # --- the survey window, as planned for this day, and the closing of the day
        day.write(
            {"survey_open_at": local_dt(held_date, 16),
             "survey_close_at": local_dt(held_date, 20) + timedelta(hours=24)}
        )
        day.with_user(gs).action_close()
        seeded.add(index)

        # --- historical timestamps (plain SQL: the story is in the past)
        attendance_ids = env["training.attendance"].search([("training_day_id", "=", day.id)]).ids
        a_time = start_dt + timedelta(minutes=rng.randint(12, 35))
        sql_set("training_attendance", attendance_ids, create_date=a_time, write_date=a_time)
        for rid in resp_ids:
            role = env["survey.user_input"].browse(rid).respondent_role
            finish = end_dt + timedelta(minutes=rng.randint(5, 90 if role != "trainee" else 1100))
            finish = min(finish, end_dt + timedelta(hours=23))
            sql_set("survey_user_input", [rid], create_date=finish - timedelta(minutes=rng.randint(3, 9)),
                    start_datetime=finish - timedelta(minutes=rng.randint(3, 9)), end_datetime=finish,
                    write_date=finish)
        close_time = end_dt + timedelta(hours=18, minutes=rng.randint(0, 40))
        stamp_audit(close_time)

        # --- story events
        if index == REOPENED_DAY:
            reopen_time = end_dt + timedelta(hours=40)
            day.with_user(gs).action_reopen()
            stamp_audit(reopen_time)
            fix = env["training.attendance"].search([("training_day_id", "=", day.id), ("status", "=", "present")], limit=2)
            fix.write({"status": "late", "late_minutes": 15})
            sql_set("training_attendance", fix.ids, write_date=reopen_time + timedelta(minutes=20))
            day.with_user(gs).action_close()
            stamp_audit(reopen_time + timedelta(minutes=45))
        if index == WITHDRAWAL_AFTER:
            enrollments[WITHDRAWN].with_user(gs).write({"state": "inactive"})
            trainee_users[WITHDRAWN].sudo().active = False  # history stays; the account is disabled
        if index == CORRECTED[1]:
            # The trainee named in the story corrects a trainer rating she
            # chose by mistake; if hers is already the top rating, the next
            # trainee whose rating can be raised tells the same story.
            candidates = [CORRECTED[0]] + [p for p in trainee_users if p != CORRECTED[0]]
            for login in candidates:
                target = env["survey.user_input"].search(
                    [("training_day_id", "=", day.id), ("respondent_role", "=", "trainee"),
                     ("partner_id", "=", trainee_users[login].partner_id.id), ("state", "=", "done")], limit=1
                )
                line = target.user_input_line_ids.filtered(lambda l_: l_.question_id == q_trainee[0])
                if not target or not line or line.suggested_answer_id.rating_value >= 5:
                    continue
                wiz = env["training.response.correction"].with_user(gs).with_context(
                    default_response_id=target.id
                ).create({"reason": "تواصلت المتدربة مع المشرفة العامة بعد الإرسال وأفادت بأنها اختارت تقييم المدربة بالخطأ؛ تم التصحيح وفق طلبها الموثّق."})
                wline = wiz.line_ids.filtered(lambda l_: l_.question_id == q_trainee[0])
                wline.option_id = option(q_trainee[0], 5)
                wiz.action_apply()
                stamp_audit(end_dt + timedelta(hours=30))
                break

    # ---------------------------------------------------------- reports (only for history recorded by this run)
    Report = env["training.report"]

    def make_report(vals, approve, generated_at, approved_at=None):
        report = Report.with_user(gs).create(vals)
        report.action_generate()
        sql_set("training_report", [report.id], generated_date=generated_at)
        if approve:
            report.action_approve()
            sql_set("training_report", [report.id], approved_date=approved_at)
            stamp_audit(approved_at)
        count("reports")
        return report

    def course_fully_seeded(pos):
        span = range(COURSES[pos][2], COURSES[pos][3] + 1)
        return POSTPONED_DAY not in span and all(i in seeded for i in span)

    new_reports = []
    report_plan = [  # (course position, approved, generated_at, approved_at)
        (0, True, datetime(2026, 8, 2, 11, 30), datetime(2026, 8, 3, 7, 30)),
        (1, True, datetime(2026, 8, 26, 11, 45), datetime(2026, 8, 27, 7, 45)),
        (2, True, datetime(2026, 9, 13, 12, 0), datetime(2026, 9, 14, 8, 0)),
        (3, False, datetime(2026, 10, 3, 8, 15), None),
    ]
    for pos, approve, generated_at, approved_at in report_plan:
        if not course_fully_seeded(pos):
            continue
        if Report.search_count([("report_type", "=", "course"), ("program_id", "=", program.id),
                                ("course_id", "=", courses[pos].id)]):
            continue
        new_reports.append(make_report(
            {"report_type": "course", "program_id": program.id, "course_id": courses[pos].id},
            approve, generated_at, approved_at,
        ))
    if seeded and not Report.search_count([("report_type", "=", "program"), ("program_id", "=", program.id)]):
        new_reports.append(make_report(
            {"report_type": "program", "program_id": program.id, "date_to": date(2026, 10, 1)},
            False, datetime(2026, 10, 3, 8, 40),
        ))

    # ---------------------------------------------------------- historical record dates (fresh program only)
    if program_created:
        planned_at = datetime(2026, 6, 25, 6, 0)
        sql_set("training_program", [program.id], create_date=planned_at, write_date=planned_at)
        sql_set("training_course", [c.id for c in new_courses], create_date=planned_at, write_date=planned_at)
        sql_set("training_day", [d.id for d in new_days.values()], create_date=planned_at + timedelta(hours=1))
        sql_set("training_enrollment", [e.id for e in new_enrollments], create_date=datetime(2026, 6, 28, 7, 15))
        for rep in new_reports:
            cr.execute("SELECT generated_date FROM training_report WHERE id = %s", (rep.id,))
            sql_set("training_report", [rep.id], create_date=cr.fetchone()[0] - timedelta(minutes=5))

    # ---------------------------------------------------------- summary
    config_params.set_param("report.url", previous_report_url or False)
    env.cr.commit()
    analytics = env["training.analytics"]
    states = {}
    for d in day_records.values():
        states[d.state] = states.get(d.state, 0) + 1
    print("=" * 70)
    print("Dev dataset loaded into %s" % dbname)
    if made:
        print("Created by this run: " + ", ".join("%s %d" % (k, v) for k, v in sorted(made.items())))
    else:
        print("Nothing to create: the dataset is already complete (no record changed).")
    print("Program: %s (id=%s)" % (program.name, program.id))
    print("Courses: %d | training days: %d (%s)" % (
        len(courses), len(day_records), ", ".join("%s %d" % kv for kv in sorted(states.items()))))
    open_day = next((d for d in day_records.values() if d.state == "open"), None)
    if open_day:
        print("An OPEN day to act on: %s (id=%s)" % (open_day.date, open_day.id))
    if seeded:
        kpi = analytics.get_kpi(program=program)
        att = analytics.get_attendance_metrics(program=program)
        print("History recorded for %d day(s). KPI: trainer %.2f | content %.2f | environment %.2f" % (
            len(seeded), kpi["trainer_performance"], kpi["content"], kpi["environment"]))
        print("Attendance %.1f%% | late %.1f%%" % (att["attendance_rate"], att["late_rate"]))
    print("-" * 70)
    print("Accounts (password %s for all):" % PASSWORD)
    print("  general supervisor: %s | supervisor: %s" % (GENERAL_SUPERVISOR[0], SUPERVISOR[0]))
    print("  trainers: %s" % ", ".join(t[0] for t in TRAINERS.values()))
    print("  trainees: %s .. %s" % (TRAINEES[0][0], TRAINEES[-1][0]))
    print("=" * 70)


try:
    main(env)  # noqa: F821  (env is injected by `odoo-bin shell`)
except SystemExit:
    env.cr.rollback()  # noqa: F821
    raise
except Exception:
    env.cr.rollback()  # noqa: F821
    traceback.print_exc()
    raise SystemExit(1)
