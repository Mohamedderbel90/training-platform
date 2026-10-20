# Noor Al‑Qiyadah (نور القيادة) — UI/UX Design Specification

**Status:** A reverse specification of the current, approved design. Every value, rule, and pattern below is transcribed from the real design‑system source files and the real prototype implementation — nothing here is a new proposal, and nothing here is invented to fill a gap. Where a requested topic (a screen, a status, a component) does not exist in the approved design, this document says so explicitly instead of guessing at what it might look like.

**Sources of truth (the only three that were used to write this document):**

1. `tokens.css` — design tokens: colors (light + `prefers-color-scheme: dark`), spacing, radius, shadows, fonts, and core layout constants.
2. `bundle.css` — the shared component library: app shell, topbar, sidebar, buttons, forms, cards, badges, tables, state views, spinner, the base dashboard grid, base stat‑card, base welcome‑banner, and a complete (currently unused) Login/Auth page system.
3. The Design‑canvas prototype's own markup, `<style>` overrides, and `<script>` logic — the real trainee‑facing application: every screen that exists, every translation string (Arabic + English), every data model, and every prototype‑only CSS addition layered on top of `bundle.css`.

**Read this before implementing anything.** This prototype builds exactly one role's experience end‑to‑end: the **Trainee**. It does not contain a built Supervisor dashboard, a built Trainer dashboard, or a live Login/Forgot‑Password/Reset‑Password screen. Sections 28, 29, and 31 document precisely what evidence does and doesn't exist for those areas. Section 13 likewise only specifies badge systems for statuses that actually exist (Training Day, Survey, Program, Course) and explicitly flags Evaluation/Report/Attendance statuses as not present, rather than inventing plausible-looking ones. This discipline — document what's real, flag what isn't, never fabricate a plausible middle ground — applies to every section in this document.

---

## 1. Design Overview

### 1.1 Overall visual direction

Noor Al‑Qiyadah ("Light of Leadership") is a bilingual (Arabic/English, Arabic‑default) leadership‑training platform for women principals of Qur'an‑memorization schools. The visual direction is best described as **warm editorial calm**: a deep emerald‑green brand color, a muted antique‑gold accent, and a cream (never pure white) canvas, composed with generous whitespace, soft low‑contrast shadows, and consistently rounded geometry. It reads as considered and institutional rather than playful or startup‑bright.

### 1.2 Design personality & brand feeling

- **Trustworthy and dignified** — deep green + gold is a palette associated with tradition, religion, and institutional credibility rather than tech‑startup energy; there is no neon, no saturated primary‑color blocking, no illustration style that reads as "casual app."
- **Warm, not clinical** — the cream background (`#f8f6f0`) and warm‑tinted near‑black text (`#24332f`, not `#000`) avoid the cold, clinical feel of a pure white/black admin tool.
- **Quiet, restrained ornament** — the one deliberate decorative motif is a low‑opacity 8‑point Islamic geometric star lattice, used only as a subtle watermark (sidebar brand block, a card's corner). It never appears as busy repeated pattern or as a loud graphic element.
- **Hand‑drawn, not iconographic‑font** — every icon in the system is a bespoke inline SVG (rounded stroke caps/joins, `stroke-width: 1.6`, `currentColor`), never a generic icon‑font glyph. This is a deliberate craft signal, not an implementation shortcut.

### 1.3 Visual tone

Formal‑but‑approachable. Copy is respectful and encouraging (e.g., the Dashboard's program message: "We deeply value your dedicated efforts…"), never jokey. Microcopy is short and direct (button labels are 1–2 words), and status communication leans on color + a small leading dot rather than long explanatory sentences.

### 1.4 Interface density

**Medium‑low density**, closer to a consumer app than a dense enterprise admin console: generous card padding (`--space-5` = 24px), a wide 8px‑based line‑height (`1.55` base), and card‑list presentation instead of dense data tables everywhere a list of records is shown (see Section 16). This is a deliberate choice for a non‑technical trainee audience and should not be tightened into a denser "admin panel" feel when extending the system.

### 1.5 Modern/professional characteristics

- CSS logical properties throughout (`margin-inline-start`, `inset-inline-end`, `text-align: start`) so most components mirror for RTL automatically — a mark of a genuinely bilingual‑engineered product, not an RTL "patch."
- A real design‑token layer (`tokens.css`) consumed exclusively via CSS custom properties — no component hardcodes a color/spacing/radius value that has a token.
- `color-mix()` and `backdrop-filter: blur()` on the topbar (a translucent glass‑morphism bar), and CSS `mask-image` used for the Dashboard hero's image‑to‑gradient blend — contemporary CSS techniques, not table‑stakes basics.
- A consistent, disciplined status‑badge vocabulary (exactly four semantic tones, reused verbatim across every screen — see Section 13) rather than each screen inventing its own colors for "done/pending/etc."

### 1.6 Intended experience per role

**Trainee — fully specified, fully built.** After authentication (see Section 31 for what "authentication" means in this artifact), a trainee lands on a personalized Dashboard (her name, her program, her stats) and can review her training schedule, complete post‑session surveys, track her program progress, manage her (read‑only) profile, get help, and contact the organization. The intended feeling is "a calm, personal, always‑available companion to my training program," not "an administrative system I have to operate."

**Supervisor — role exists as a label only; no experience is specified.** The approved design defines the string "Supervisor"/"مشرفة" and nothing else for this role. There is no dashboard, attendance view, or evaluation form to describe. Section 28 documents this gap explicitly rather than guessing at what a supervisor would see.

**Trainer — role exists as a label and as a display field only; no experience is specified.** Beyond the same role‑label string, "Trainer" also appears as read‑only display text (a trainer's name shown to a trainee, e.g. on a training‑day card). No trainer‑facing screen exists. Section 29 documents this gap explicitly.

---

## 2. Color System

All colors are CSS custom properties defined once in `tokens.css`, with a complete parallel set under `@media (prefers-color-scheme: dark)`. No production component hardcodes a raw hex value that has a token equivalent (a short, explicitly‑listed set of prototype‑only decorative exceptions is called out in 2.4).

### 2.1 Brand colors

| Name | Token | Hex (light) | Hex (dark) | Background usage | Text usage | Border usage | Hover | Active | Disabled |
|---|---|---|---|---|---|---|---|---|---|
| Primary (emerald green) | `--color-primary` | `#153f38` | `#5fbba0` | Solid button fill, active nav pill (base system), brand mark, hero gradient start | Links/labels on light surfaces, sidebar nav‑link text, page‑header eyebrow, badge default accents | Focus ring (`--focus-ring` = same value) | → `--color-primary-hover` | → `--color-primary-active` | Button `opacity: 0.5` (no separate disabled color token — see 14) |
| Primary hover | `--color-primary-hover` | `#1c5147` | `#7bcbb2` | Primary button `:hover` fill | — | — | — (is itself the hover value) | — | — |
| Primary active | `--color-primary-active` | `#0e2c27` | `#97d8c2` | Primary button `:active` fill; dark end of every primary gradient (hero, brand mark) | — | — | — | — (is itself the active value) | — |
| Primary contrast | `--color-primary-contrast` | `#ffffff` | `#06231c` | — | Text/icon color placed on top of `--color-primary` fills | — | — | — | — |
| Primary soft | `--color-primary-soft` | `#edf2ee` | `#17332c` | Active sidebar nav pill, selected filter‑pill fill, icon‑circle backgrounds, secondary‑button hover fill | Active sidebar nav‑link text, selected filter‑pill text | — | — | — | — |
| Primary soft strong | `--color-primary-soft-strong` | `#dae6df` | `#1e4038` | A stronger pale‑green fill, used sparingly for extra emphasis over `--color-primary-soft` | — | — | — | — | — |
| Accent (muted gold/bronze) | `--color-accent` | `#c6a66b` | `#d9b679` | Small decorative accents (hero title icon color) | — | Hero quote‑chip border (as `rgba(198,166,107,.55)`) | → `--color-accent-hover` | — | — |
| Accent hover | `--color-accent-hover` | `#b6935a` | `#e5c793` | Accent‑colored interactive hover | — | — | — | — | — |
| Accent soft | `--color-accent-soft` | `#f7f4ec` | `#2e2818` | Avatar background, accent‑toned icon circles | — | — | — | — | — |
| Accent soft strong | `--color-accent-soft-strong` | `#f0e7d8` | `#3c331f` | Stronger pale‑gold fill (some stat‑card icon halos) | — | — | — | — | — |
| Accent contrast | `--color-accent-contrast` | `#2c2007` | `#2c2007` | — | Avatar‑initials text, text on accent fills | — | — | — | — |
| Accent icon | `--color-accent-icon` | `#8a6a37` | `#d9b679` | — | Darker gold icon glyph color where a gold icon needs more contrast than raw `--color-accent` | — | — | — | — |

### 2.2 Neutral / surface colors

| Name | Token | Hex (light) | Hex (dark) | Usage |
|---|---|---|---|---|
| Page background | `--color-bg` | `#f8f6f0` | `#0f1613` | `<body>` background — warm cream, never pure white |
| Raised background | `--color-bg-raised` | `#f1ede2` | `#141f1a` | A slightly raised background tint (used sparingly; most "raised" surfaces use `--color-surface` instead) |
| Surface | `--color-surface` | `#ffffff` | `#17221d` | Card, input, sidebar (base system), dropdown/notif‑panel backgrounds |
| Surface muted | `--color-surface-muted` | `#f3f0e6` | `#1b2822` | Table header row fill, nav‑link hover fill, task‑list icon tile (base tone), empty‑state icon circle |
| Border | `--color-border` | `#e6e0d1` | `#293a32` | Default 1px hairlines: cards, table rows, topbar bottom edge |
| Border strong | `--color-border-strong` | `#d6cdb4` | `#384c42` | Input borders, secondary‑button border |
| Text (primary) | `--color-text` | `#24332f` | `#f1eee3` | Body copy, headings |
| Text muted | `--color-text-muted` | `#5c6b64` | `#a9b6ae` | Card meta lines, subtitles, secondary labels |
| Text subtle | `--color-text-subtle` | `#8b978e` | `#778a80` | Table header labels, faint index text ("Day 5"), empty‑state icon color |

**Neutral grays, explicitly:** the system has no separate "gray scale" — `--color-text`, `--color-text-muted`, `--color-text-subtle`, `--color-border`, `--color-border-strong`, `--color-surface-muted` collectively serve every role a conventional gray scale would (from near‑black text down to the faintest hairline), but every one of them is warm‑tinted toward the green/cream palette rather than a neutral desaturated gray. Do not substitute a generic `#999`/`#ccc`‑style gray scale; use these tokens exactly.

### 2.3 Semantic colors (defined separately from brand colors, exactly four)

| Semantic | Text token | Background token | Hex — text (light/dark) | Hex — bg (light/dark) | Meaning |
|---|---|---|---|---|---|
| Success | `--color-success` | `--color-success-bg` | `#2f7d54` / `#7fdba6` | `#e7f2ea` / `#123424` | Completed, submitted, active/positive states |
| Warning | `--color-warning-text` | `--color-warning-bg` | `#7d5a12` / `#f0cc7e` | `#f8efd9` / `#362b10` | Required action pending, needs attention |
| Danger / error | `--color-danger` (+ `-hover`) | `--color-danger-bg` | `#a3352a` / `#ff8c82` | `#f8eae7` / `#3a1d1a` | Errors, destructive actions, invalid fields |
| Info | `--color-info-text` | `--color-info-bg` | `#2b5f8a` / `#8fc1e8` | `#e7f0f8` / `#16283a` | Neutral/informational status ("Next," "In progress") |

**Rule:** a semantic color is always used as a **text + background‑tint pair** (never text‑only, never fill‑only, and never a semantic color used purely decoratively). There is no fifth semantic color — do not introduce one for a new status; map any new status onto one of these four (see Section 13.2 for the exact existing mapping and how to extend it).

### 2.4 Hover / active / disabled, systemically

The color system does not define per‑component hover/active/disabled *tokens* beyond the primary triad (`--color-primary` → `-hover` → `-active`) and the danger pair (`--color-danger` → `-hover`). Every other interactive surface derives its hover/active state from **existing tokens recombined**, not new colors:

- **Secondary button** hover: `background: --color-primary-soft` (no separate "secondary‑hover" token exists).
- **Nav link** hover: `background: --color-surface-muted; color: --color-text` (from base‑system tone, not primary).
- **Filter pill / option‑item / status‑radio** checked/hover: `border: --color-primary; background: --color-primary-soft; color: --color-primary`.
- **Card** hover (`.card--interactive` only): shadow escalates `--shadow-sm → --shadow-md` and border escalates `--color-border → --color-border-strong` — no background/color change.
- **Disabled** state, universally: `opacity: 0.5; cursor: not-allowed` (buttons) — there is no separate "disabled gray" background token; disabling is expressed purely through opacity reduction on the existing colors, never a swap to a muted gray fill.

**Implementer note:** don't invent new hover/active/disabled hex values for a new component — first check whether the pattern above (primary‑soft for hover, opacity‑0.5 for disabled) already covers it, which it almost certainly does.

### 2.5 Colors that exist outside the token system (flag for tokenization, don't silently "correct" them)

- `#3f7160` — Upcoming‑Session card's date‑block background (a distinct mid‑green, deliberately not `--color-primary`).
- `#f1f0ee` — Dashboard task‑list icon‑tile background.
- `#cfe4f5` — one Days‑page stat‑card icon variant background (`--stat-card__icon--days-info`).
- `rgba(198,166,107,.55)` — hero quote‑chip border (translucent gold).
- `rgba(255,255,255,.85)` / `rgba(255,255,255,.12)` — hero panel's white‑alpha text/chip fills (correct as hardcoded white because that panel is permanently dark regardless of light/dark mode).

---

## 3. Typography

### 3.1 Font families

| Token | Stack | Applies under |
|---|---|---|
| `--font-family-latin` / `--font-latin` | `system-ui, -apple-system, "Segoe UI", Tahoma, Arial, sans-serif` | `dir="ltr"` (English) |
| `--font-family-arabic` / `--font-arabic` | `"Tajawal", "Segoe UI", Tahoma, Arial, sans-serif` | `dir="rtl"` (Arabic) |

Applied once, at the root: `html[dir="rtl"] body { font-family: var(--font-arabic), var(--font-latin); }` and the LTR mirror. **One named exception:** the topbar's Bismillah line uses `"Amiri", var(--font-family-arabic)` — a serif Arabic display face used nowhere else in the product. This is a singular, deliberate exception for that one devotional line only; never extend "Amiri" to any other Arabic text in the app.

### 3.2 Fallback chain

Both stacks are three‑deep: a named preferred font → a widely‑available system font (`Segoe UI`) → a generic system‑UI/sans‑serif floor. Neither stack ever falls back to `serif` or a web‑safe font outside this chain.

### 3.3 Font weights

Exactly four weights are used anywhere in the system: **400** (regular — body/meta text), **500** (prototype sidebar nav‑link override only), **600** (labels, buttons, secondary emphasis, badge... no — badges are 700, see below), **700** (titles, values, badges, brand text). Never introduce 300/800/900.

### 3.4 Base type metrics

- Body font size: `15.5px`; base `line-height: 1.55`.
- Headings (`h1,h2,h3`): `line-height: 1.25; letter-spacing: -0.01em`.
- `-webkit-font-smoothing: antialiased`.

### 3.5 Type scale

| Role | Size | Weight | Line-height | Letter-spacing | Where |
|---|---|---|---|---|---|
| H1 / Page title (icon + text) | `1.5rem` (24px) | 700 | 1.25 | `-0.01em` | `.page-header h1` / `.days-page__title`, every content page |
| Hero title (Dashboard "Welcome back…") | `1.9rem` (30px, prototype override of base `1.3rem`) | 700 | 1.3 | `-0.01em` | Dashboard hero only |
| Section title / Card title | `1.05rem` (16.8px) | 700 | default | normal | `.card__title` |
| Page‑header eyebrow | `0.78rem` (12.5px) | 700 | default | `0.06em` (LTR) / normal (RTL, stripped — see 3.7) | Every page‑header's role‑label line |
| Body | inherits `15.5px` base | 400 | 1.55 | normal | Paragraph text, card meta bodies |
| Card meta / subtitle | `0.88rem` (14px) | 400 | default | normal | `.card__meta`, `.page-header__subtitle` |
| Small text (stat description, help‑quicklink desc) | `0.78–0.8rem` (12.5–12.8px) | 400 | 1.4 | normal | `.stat-card__desc`, `.help-quicklink__desc` |
| Helper text (field hint) | `0.85rem` (13.6px) | 400 | default | normal | `.field-hint` |
| Field error text | `0.85rem` (13.6px) | 600 | default | normal | `.field-error` |
| Button text | `0.94rem` (15px) | 600 | default | normal | `.button` |
| Badge text | `0.76rem` (12.2px) | 700 | default | `0.01em` (LTR) / normal (RTL, stripped) | `.badge` |
| Stat value (KPI number) | `1.6rem` base / `2.1rem` prototype override | 700 | default | normal | `.stat-card__value` |
| Table header cell | `0.78rem` (12.5px) | 700 | default | `0.04em` | `.data-table th` (defined, currently unused live) |

### 3.6 Arabic vs. English typographic differences

1. **Different type families** (Section 3.1) — this is the primary difference, not a size/weight difference.
2. **`letter-spacing` is stripped in Arabic.** Three components apply deliberate positive letter‑spacing in English (`page-header__eyebrow`: `0.06em`; `.badge`: `0.01em`; `program-info-box__label`: `0.04em`) and explicitly zero it out under `[dir="rtl"]`, because manual letter‑spacing on Arabic script breaks letter joining and looks broken, unlike on Latin uppercase text where it's a common refinement.
3. **Numerals inside Arabic text are still wrapped for LTR rendering** via `<bdi dir="ltr">` (emails, phone numbers, dates, time ranges) — see Section 3.7. This is a bidi‑correctness measure, not a font change.
4. Font sizes and weights themselves are **identical** between the two languages at every scale level in 3.5 — the system does not compensate with a different size scale for Arabic (a common but here‑unnecessary practice, since Tajawal at the same pixel sizes reads comparably to the Latin stack).

### 3.7 Bidirectional text handling (systemic rule)

Any value that must always render left‑to�right regardless of the surrounding paragraph's direction — emails, phone numbers, `DD MonthName YYYY`‑style dates, time ranges — is wrapped in `<bdi dir="ltr">…</bdi>`, never left to the ambient `dir`. **Any new Latin‑script/numeral field embedded in Arabic UI must follow this same pattern.** Separately, a bare "N / M" numeric pair (e.g., a 1–5 rating, or "12 / 32") is avoided inside RTL paragraphs because the bidi algorithm can visually reverse an unanchored slash‑separated run; the established fix is a localized connector word ("Question 1 **of** 4" / "السؤال ١ **من** ٤") that anchors each number to adjacent text. Reuse this exact pattern for any new numeric‑pair display string.

---

## 4. Spacing System

One 8‑step, `rem`‑based scale, consumed exclusively through custom properties:

| Token | rem | px (16px root) |
|---|---|---|
| `--space-1` | 0.25rem | 4px |
| `--space-2` | 0.5rem | 8px |
| `--space-3` | 0.75rem | 12px |
| `--space-4` | 1rem | 16px |
| `--space-5` | 1.5rem | 24px |
| `--space-6` | 2rem | 32px |
| `--space-7` | 2.5rem | 40px |
| `--space-8` | 3.5rem | 56px |

### 4.1 Applied spacing by context

| Context | Value | Notes |
|---|---|---|
| Page padding, desktop (≥960px, with sidebar) | `--space-7 --space-6 --space-8` (top/sides/bottom) | `.app-shell--with-sidebar .app-main` |
| Page padding, mobile (<640px) | `--space-5 --space-3 --space-7` | `.app-main` under the 640px query |
| Page padding, default/tablet | `--space-6 --space-4 --space-8` | `.app-main` base rule |
| Section spacing (page‑header to content) | `--space-6` (32px) | `.page-header { margin-bottom }` |
| Card padding | `--space-5` (24px) | `.card` |
| Card‑to‑card gap (list) | `--space-4` (16px) | `.card-list { gap }` |
| Grid gap, dashboard/stat grids | `--space-4` to `--space-5` (16–24px) | `.stat-grid`, `.dashboard-grid` |
| Form field bottom spacing | `--space-5` (24px) | `.field { margin-bottom }` |
| Button‑row top spacing | `--space-5` (24px), or `0` with `.button-row--tight` | `.button-row` |
| List item internal gap (day‑card meta facts) | `--space-3` (12px) | `.day-card__meta-row` |
| Sidebar nav item padding | `0.7rem var(--space-3)` base; prototype: `padding-inline-start: 2rem` | `.nav-link` |
| Topbar horizontal padding, desktop | `--space-5`, or `--space-6` with sidebar | `.app-topbar` |
| Topbar horizontal padding, mobile (<640px) | `--space-3` (12px) | |
| State‑view (empty/error) vertical padding | `--space-7` (40px) | `.state-view` |

Gaps smaller than `--space-1` (`0.2rem`, `0.3rem`, `0.35rem`) appear only in a few tight inline compositions (badge dot gap, field‑text internal line gaps) — these are deliberate sub‑scale micro‑adjustments; keep them literal rather than forcing them onto the 8‑step scale.

---

## 5. Border Radius System

| Token | Value | Cards | Buttons | Inputs | Badges | Modals | Dropdowns | Images | Sidebar items |
|---|---|---|---|---|---|---|---|---|---|
| `--radius-sm` | 8px | — | ✓ (all variants) | ✓ | — | N/A — no modal exists (Section 22) | — | Small icon thumbnails (`.upcoming-session__thumb`) | — |
| `--radius` | 14px | ✓ (all `.card` variants) | — | — | — | N/A | ✓ (`.notif-panel`) | — | ✓ (`.nav-link` active pill, sidebar items) |
| `--radius-lg` | 20px | ✓ (hero/welcome‑banner only) | — | — | — | N/A | — | Hero photo (inherits the banner's own radius via `overflow:hidden`) | — |
| `999px` (literal) | pill | — | — | — | ✓ (all badges) | N/A | ✓ (locale‑switch pill) | Avatar circles | Filter pills |

**Rule of thumb:** `--radius-sm` for anything you interact with directly, `--radius` for anything that contains content, `--radius-lg` reserved solely for the one hero element, literal `999px` for anything meant to read as a chip/pill/avatar/dot. There is no modal in the approved design (Section 22), so there is no modal‑radius value to document — if one is built, use `--radius` (14px) to stay consistent with the system's other "container" surfaces.

---

## 6. Shadows and Elevation

| Token | Light value | Dark value | Used on | Used for hover? |
|---|---|---|---|---|
| `--shadow-sm` | `0 1px 2px rgba(21,30,27,.06)` | `0 1px 2px rgba(0,0,0,.35)` | Default `.card`, buttons (implicit), brand mark, active sidebar pill (base system) | No — this is the resting state |
| `--shadow-md` | `0 4px 12px rgba(21,30,27,.08)` | `0 4px 14px rgba(0,0,0,.4)` | Welcome‑banner hero (resting); `.card--interactive:hover` | Yes — the hover escalation target for interactive cards |
| `--shadow-lg` | `0 10px 28px rgba(21,30,27,.12)` | `0 12px 32px rgba(0,0,0,.5)` | Mobile sidebar drawer, notification dropdown panel | No — reserved for floating/overlaying surfaces |

### 6.1 Where shadows should be used

Resting cards get `--shadow-sm` (a bare hint of lift, not a dramatic float). Anything that floats *above* the page content in its own stacking context — a dropdown panel, a mobile drawer — gets `--shadow-lg`, because it needs to visually separate from everything beneath it, not just its immediate card neighbors. A plain, non‑interactive card **never** escalates shadow on hover.

### 6.2 Where shadows should not be used

- Not on plain body text or icons (no drop‑shadow‑as‑decoration anywhere in the system).
- Not on a `.card` that isn't explicitly `.card--interactive` — a static informational card (Program Message, Contact mission box) stays flat at `--shadow-sm` forever, it never gains a hover shadow, because it isn't a clickable/navigable unit.
- Not stacked (never combine two shadow tokens on one element).
- There is no modal shadow to define because no modal exists (Section 22) — if one is added, `--shadow-lg` is the correct elevation to reuse, consistent with the drawer/dropdown precedent.

---

## 7. Layout System

### 7.1 AppShell structure

```
.app-shell (flex column; → flex row via .app-shell--with-sidebar at ≥960px)
├── .app-topbar          sticky, height: var(--topbar-height)=4.25rem (auto-height in prototype to allow wrap)
├── .app-sidebar         off-canvas drawer <960px · sticky column ≥960px, width: var(--sidebar-width)=17rem
├── .sidebar-scrim       mobile-only backdrop
└── .app-content-column
      ├── .app-main      max-width: var(--content-max-width)=52rem, centered — 72rem on the Dashboard specifically
      └── .app-footer.app-footer--full   copyright + Privacy/Terms/Contact links
```

### 7.2 Content max‑width & page margins

| Screen type | Max width | Notes |
|---|---|---|
| Dashboard (card‑grid layout) | `72rem` | `.app-main:has(> .dashboard)` |
| Every other authenticated screen (reading‑column layout) | `52rem` | `--content-max-width` |
| Contact page (2‑column grid, wider than a reading column) | `78.5rem` | `.contact-dashboard` |

Page margins (the gutter outside the centered max‑width column) are simply the `.app-main` padding values in Section 4.1 — there is no separate "margin" token distinct from that padding.

### 7.3 Grid behavior by device class

- **Desktop (≥960px):** sidebar is a static sticky column; content sits beside it; topbar gets extra start‑padding (`--space-6`) to compensate for no longer needing a hamburger toggle.
- **Tablet (roughly 640–959px):** sidebar is still an off‑canvas drawer (the 960px line, not any tablet‑specific breakpoint, is what controls sidebar mode); most grids that are 1‑column on phones move to 2‑column somewhere in this range (`.dashboard-grid` at 860px, `.stat-grid` at 640px).
- **Mobile (<640px):** single‑column stacking everywhere; the welcome‑banner hero drops its image entirely; topbar/main padding tighten to `--space-3`.

### 7.4 Exact measurements reference table

| Constant | Value |
|---|---|
| `--sidebar-width` | 17rem (272px) |
| `--topbar-height` | 4.25rem (68px) — `min-height` in practice, can grow |
| `--content-max-width` | 52rem (832px) |
| Dashboard content width | 72rem (1152px) |
| Contact page content width | 78.5rem (1256px) |
| Mobile sidebar drawer width | `min(20rem, 82vw)` |

---

## 8. Sidebar Specification

### 8.1 Width

17rem (`--sidebar-width`) as a sticky desktop column (≥960px); `min(20rem, 82vw)` as a mobile off‑canvas drawer.

### 8.2 Background

`var(--color-bg)` — the prototype deliberately overrides the shared component library's default (`--color-surface`, white) so the sidebar reads as an extension of the page's cream canvas rather than a distinct white panel. Preserve this override; it's a specific, intentional correction over the base design system.

### 8.3 Logo placement

Centered column at the top of the sidebar (`text-align: center`), a real logo `<img>` at `inline-size: 6.5rem` (a large, image‑based lockup — not an icon‑mark + wordmark pairing like the topbar's compact brand mark), brand name below it (`1.15rem`, 700, `--color-primary`), then a short tagline (`0.76rem`, muted, `max-width: 13rem` to force a short wrap).

### 8.4 Navigation spacing, icon size, text size, item height

- Item padding: `0.7rem var(--space-3)` base, with `padding-inline-start: 2rem` in the prototype's override.
- Icon‑to‑text gap: `2.25rem` (prototype override of the base `--space-3`/12px — a noticeably wider gap than the base component library specifies).
- Icon size: `1.4rem` (22.4px), up from the base system's `1.2rem`.
- Text size: `0.94rem`, weight `500` (prototype override of base `600`).
- Nav groups: `gap: var(--space-2)` (8px) within a group, `gap: var(--space-5)` (24px) between the two groups, with a `border-top` divider + `padding-top: var(--space-4)` on the second group.
- Item height is not a fixed token — it results from `0.7rem` vertical padding + a `1.4rem` icon/line, i.e. roughly 2.8rem (~45px) total row height in practice.

### 8.5 Active state / indicator

Base component library: solid filled pill (`background: --color-primary; color: --color-primary-contrast`). **Prototype override (the approved, current state):** a **soft pale‑green pill** instead (`background: --color-primary-soft; color: --color-primary; box-shadow: none`) plus a slim vertical accent bar positioned at the link's inline‑start edge via `::before`, and the active label weight bumps to `600`.

### 8.6 Hover state

`background: --color-surface-muted; color: --color-text` (a neutral gray‑tint hover, distinct from both the resting primary‑green text and the soft‑green active state — three visually distinct states: resting/hover/active).

### 8.7 Section grouping

Two groups: (1) Dashboard, Training Days, My Surveys, Training Program, Profile; (2) Help, Contact us — separated by a horizontal divider. **Account section:** there is no separate "account" grouping in the sidebar distinct from the two nav groups above — the closest analog is the Logout action, which sits below both groups as a real `<button>` styled identically to a nav link (`.nav-link--action`), separated by extra top margin (`--space-2`, prototype‑tightened from base `--space-6`).

### 8.8 Mobile behavior

Below 960px: fixed, off‑canvas, `width: min(20rem, 82vw)`, slides in from the inline‑start edge via `transform: translateX(±100%)` toggled by a `data-open` attribute; a full‑viewport scrim (`rgba(15,20,17,.45)`, fade‑in) sits behind it and closes it on click; a hamburger toggle in the topbar opens it. The `app-nav-toggle`/scrim are hidden entirely at ≥960px.

### 8.9 Collapsed behavior

**Not applicable — no collapsed/icon‑only sidebar mode exists in the approved design.** The sidebar is binary: either the full off‑canvas drawer (mobile) or the full 17rem column (desktop). Do not add a collapsed/rail mode; it isn't part of the approved design.

### 8.10 RTL / LTR behavior

The sidebar sits at the **inline‑start edge** in both directions (`inset-inline-start: 0`), which physically means the *left* edge in English and the *right* edge in Arabic — this is automatic logical‑property mirroring, not a special‑cased rule. The one place this required an explicit `[dir="rtl"]` override rather than relying purely on logical properties: the mobile drawer's closed‑state `transform: translateX(-100%)` is a physical value (transforms have no logical equivalent), so it needs an explicit `html[dir="rtl"] .app-sidebar { transform: translateX(100%) }` counterpart — and, because that RTL‑scoped rule is more specific than a plain `data-open="true"` selector, the **open** state and the **desktop sticky** state both had to repeat the same `html[dir="rtl"]` prefix to actually win the cascade (two real, previously‑shipped bugs in this exact codebase — see Section 32.3 for the general lesson).

---

## 9. Header Specification

### 9.1 Height

`var(--topbar-height)` = 4.25rem (68px) as a `min-height` (not a hard height) — the prototype explicitly changes `height: 4.25rem` to `height: auto; min-height: 4.25rem` so the center Bismillah block can wrap onto two lines on narrow/medium viewports without clipping.

### 9.2 Background

`color-mix(in srgb, var(--color-surface) 92%, transparent)` + `backdrop-filter: blur(8px)` — a translucent, blurred bar, not a flat opaque one.

### 9.3 Border / shadow

`border-bottom: 1px solid var(--color-border)`. No shadow — the topbar is delineated purely by the hairline + its own blur/translucency, not a drop‑shadow.

### 9.4 Program selector

There is no interactive "program selector" (no dropdown to switch between multiple programs) — the topbar's `.program-info-box` is **display‑only** (confirmed by the absence of any click handler or panel tied to it; a code comment notes explicitly that no "switch program" backend endpoint exists to back one). It shows program name + dates in a bordered pill (icon + 2‑line text), `max-width: 20rem`, name truncated with ellipsis if needed.

### 9.5 User avatar / name

Circular avatar, `2.1rem`, `background: --color-accent-soft`, `color: --color-accent-contrast`, showing computed initials (first letter of first name + first letter of last name, uppercase). Name (`0.88rem`, 700) + role label (`0.76rem`, muted) stack beside it; this detail block is hidden below `560px` (avatar alone remains). No dropdown chevron, no click‑to‑open menu — this, too, is a display‑only identity block.

### 9.6 Language switcher

A two‑option pill toggle (`Ø` gap `2px`, `background: --color-surface-muted`, `border-radius: 999px`, `padding: 2px`), each option a `0.32rem 0.75rem`‑padded pill; the active locale is filled solid (`--color-primary` fill, white text). Clicking the inactive option flips the whole app's `locale`/`dir` instantly, in place, with no reload.

### 9.7 Spacing & alignment

Three‑zone flex row (`__start` / `__center` / `__end`), `justify-content: space-between`, `gap: var(--space-3)`, horizontal padding `var(--space-5)` (or `--space-6` with the sidebar present, `--space-3` on mobile).

### 9.8 Responsive behavior

See Section 33 for the full breakpoint table. Summary: program‑info‑box hides <560px; its date sub‑line hides <767px before the whole box does; user‑menu name/role hides <560px; the mobile nav toggle only shows <960px.

### 9.9 RTL vs. LTR positioning, explicitly

`__start` always sits at the sidebar's inline‑start edge (mobile toggle, user identity) — this is the zone *closest* to the sidebar, so it is physically on the left in English and physically on the right in Arabic. `__end` (locale switch, notifications, program box) sits at the far edge from the sidebar. This is pure logical‑property mirroring (no explicit `[dir]` override needed for the topbar's own zone layout) — the only topbar element needing an explicit direction‑aware rule is the notification‑bell's badge/panel anchor (`inset-inline-start: 0` on `.notif-panel`, still logical, not physical — no exception needed there either). The Bismillah center block itself is direction‑agnostic (centered text).

---

## 10. Breadcrumbs

### 10.1 Placement

Above the page header, only on: Help, Contact, Privacy, Terms (2‑level) and Training Day Details (3‑level). Dashboard, Training Days, My Surveys, View Survey, Training Program, and Profile have **no breadcrumb** — do not add one to these; the sidebar's own active state is the intended orientation mechanism there.

### 10.2 Typography

Plain text links (inherits body size), the current/final segment styled `color: --color-text; font-weight: 600` while prior segments are links (`color: --color-text-muted`, underline on hover).

### 10.3 Separators

A small chevron SVG (`14×14`, `stroke-width: 1.8`) between segments, `color: --color-text-subtle`.

### 10.4 Icon behavior / direction

The separator chevron is a directional glyph and must visually point toward the reading‑end direction; implement it with the same `[dir="ltr"] svg { transform: scaleX(-1) }`‑style mirroring pattern the system uses elsewhere for directional icons (Section 32.3‑2) — check the asset's own authored orientation first rather than assuming a universal flip rule.

### 10.5 Spacing

Segments and separators sit inline with small (`~0.4–0.5rem`) horizontal gaps; the whole breadcrumb row sits with its own bottom margin before the page‑header/content below it.

### 10.6 Hover behavior

Only non‑final (link) segments respond to hover: `color: --color-primary; text-decoration: underline`. The final/current segment is plain text and never gets a hover treatment (it isn't a link).

---

## 11. Page Header

### 11.1 The standard pattern

```html
<div class="page-header">
  <div>
    <p class="page-header__eyebrow">{{profile.roleLabel}}</p>
    <h1 class="days-page__title">
      <span class="days-page__title-icon" aria-hidden="true"><svg>…</svg></span>
      {{t.navX}}
    </h1>
    <p class="page-header__subtitle">{{t.xHeaderSubtitle}}</p>
    <p class="page-header__subtitle days-page__subtitle-secondary">{{…secondary line…}}</p>  <!-- Days/Surveys only -->
  </div>
  <!-- .page-header__actions goes here when a page needs header-level actions; none of the current trainee screens use one -->
</div>
```

- **Eyebrow:** always the trainee's role label (`{{profile.roleLabel}}`) — never bespoke per‑page copy. Uppercase, `0.78rem`, 700, `--color-primary`, letter‑spacing `0.06em` (stripped in Arabic).
- **Icon:** a small inline SVG immediately before the `<h1>` text, sized to match the heading's cap‑height (roughly `1.05rem` icon glyph inside a slightly larger optical box, see e.g. `.days-page__title-icon`).
- **Page title:** `1.5rem`, 700.
- **Subtitle:** `--color-text-muted`, `max-width: 38rem` (wraps rather than running full‑width), `margin-top: --space-2`. Days and Surveys additionally show a second subtitle line with a live count/summary.
- **Actions:** `.page-header__actions` (flex row, wraps, `gap: --space-2`) is defined in `bundle.css` but **no current trainee screen populates it** — every page's actions live inside the content below (toolbar, card buttons), not in the header itself. This is available for future use but should not be assumed populated when reproducing existing screens.
- **Spacing:** `margin-bottom: --space-6` (32px) between the whole header block and the content below it.

### 11.2 Responsive behavior

`display:flex; flex-wrap:wrap; justify-content:space-between` — on narrow widths where an actions row exists, it wraps below the title block rather than compressing horizontally. The eyebrow/title/subtitle block itself is single‑column at every width.

### 11.3 Contact page's exception

The Contact page's header intentionally omits the eyebrow line and lives inside its grid column (not full‑width above the grid) so its baseline aligns with the sidebar column's own header start — a deliberate, scoped exception; do not "fix" it back to the standard pattern.

---

## 12. Cards

### 12.1 Base card contract

```css
.card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius); padding: var(--space-5); margin-bottom: var(--space-4); box-shadow: var(--shadow-sm); }
.card--interactive:hover { box-shadow: var(--shadow-md); border-color: var(--color-border-strong); }
```

### 12.2 Card pattern matrix

| Pattern | Padding | Border | Radius | Shadow | Heading | Icon | Badge placement | Action placement | Hover |
|---|---|---|---|---|---|---|---|---|---|
| **Standard content card** (`.card`) | `--space-5` | 1px `--color-border` | `--radius` (14px) | `--shadow-sm` | `.card__title`, optional leading icon | Inline before title text | — | `.button-row` at the bottom | None unless `.card--interactive` |
| **Stat / KPI card** (`.stat-card`) | `--space-5 --space-4` | 1px `--color-border` | `--radius` | `--shadow-sm` | None — value is the focal point | Left‑aligned icon circle, `4.25rem`, halo‑ring decoration | — | — (non‑interactive display card) | None |
| **Training‑day card** (`.day-card`) | inherits `.card` | inherits | inherits | inherits | Course name as implicit title | Date block replaces a heading icon | Status badge next to/near the title (Section 13) | `.day-card__actions` at the bottom: conditional primary + always‑present "View details" | None (not `.card--interactive`; navigation is via its own explicit action links) |
| **Course card** (`.program-course-card`) | inherits | inherits | inherits | inherits | Course name | Icon circle (course‑type glyph) instead of a date block | Status badge (completed/in‑progress/upcoming) | None beyond the badge (no per‑course action button — this is a read‑only breakdown row) | None |
| **Task card** (Dashboard task‑list row, `.task-list__link`) | `0.8rem 0.9rem` | 1px `--color-border` | `--radius` | none (flat) | Task label | Small icon tile (`2.1rem`, `#f1f0ee`) | Status badge (required/upcoming/new) | Entire row is the click target (routes to Training Days) | `border-color: --color-primary; background: --color-primary-soft` |
| **Information card** (Program Message, Contact mission box) | `--space-5` (card) / smaller custom padding (mission box) | inherits or none (mission box is a plain tinted panel) | `--radius` | `--shadow-sm` or none | Short title + icon | Small inline icon | — | — (purely informational, no action) | None |
| **Empty‑state card** (`.card` wrapping a `.state-view`) | `.card`'s `--space-5` outer + `.state-view`'s own `--space-7 --space-4` inner | 1px `--color-border` (from the wrapping `.card`) | `--radius` | `--shadow-sm` | `.state-view__title` (bold, centered) | Centered icon circle above the title | — | Centered single action button/link below the message | None |

### 12.3 Stat/KPI card, full detail (the most heavily customized card in the system)

The shared‑library base version is a top‑aligned column (icon above value above label). **The approved, current design completely rebuilds this to an icon‑left row:**

```css
.stat-card { display:flex; flex-direction:row; align-items:center; gap:.6rem; padding-inline:.7rem; }
.proto-shell[dir="rtl"] .stat-card { flex-direction: row-reverse; }
.stat-card__icon  { inline-size:4.25rem; block-size:4.25rem; padding:.8rem; }
.stat-card__value { font-size:2.1rem; font-weight:700; }
.stat-card__label { font-size:.92rem; color:var(--color-text); }
.stat-card__desc  { font-size:.78rem; color:var(--color-text-subtle); }   /* Days/Surveys/Program only, not Dashboard */
```

Icon decoration adds a "halo ring" (`box-shadow: 0 0 0 9px <soft-tint>`), a masked low‑opacity corner crosshatch watermark, and — for progress‑type cards only — a `conic-gradient` ring driven by a live inline CSS variable (`--stat-ring-value`) computed from real data on every render, never a static percentage.

### 12.4 Hover behavior, by card type

Only `.card--interactive` and the Task‑List row escalate visually on hover. Stat cards, day cards, course cards, and information cards do **not** change appearance on hover — clicking behavior on a day‑card is via its explicit action buttons/links, not the whole card surface.

---

## 13. Status Badges

### 13.1 Base badge

```css
.badge { display:inline-flex; align-items:center; gap:.3rem; padding:.2rem .7rem; border-radius:999px; font-size:.76rem; font-weight:700; background:var(--color-surface-muted); color:var(--color-text-muted); border:1px solid var(--color-border); }
.badge::before { content:""; inline-size:.4rem; block-size:.4rem; border-radius:50%; background:currentColor; opacity:.7; }  /* the only "icon" a badge ever gets: a small status dot, never a semantic glyph */
.badge--success { background:var(--color-success-bg); color:var(--color-success); border-color:transparent; }
.badge--warning { background:var(--color-warning-bg); color:var(--color-warning-text); border-color:transparent; }
.badge--danger  { background:var(--color-danger-bg);  color:var(--color-danger);      border-color:transparent; }
.badge--info    { background:var(--color-info-bg);    color:var(--color-info-text);   border-color:transparent; }
```

**On icons:** badges never carry a per‑status semantic icon (no checkmark glyph for "completed," no clock glyph for "pending") — the only "icon" is the small `::before` dot, and even that is omitted via `.badge--plain` where a badge sits next to an already‑distinct icon elsewhere in the row (e.g., Dashboard task badges, which already have their own icon tile). Status is distinguished by **label text + color pairing**, not by badge iconography — do not add per‑status icons to badges; that would be a new pattern not present in the approved design.

### 13.2 Status → badge mapping (exhaustive; only these statuses exist in the approved design)

| Domain | Status | Label copy key | Tone | Bg | Text |
|---|---|---|---|---|---|
| **Training Day** | `completed` | `daysBadgeCompleted` | success | `--color-success-bg` | `--color-success` |
| Training Day | `pending` (day happened, survey not yet submitted) | `daysBadgePending` | warning | `--color-warning-bg` | `--color-warning-text` |
| Training Day | `next` | `daysBadgeNext` | info | `--color-info-bg` | `--color-info-text` |
| Training Day | `upcoming` | `daysBadgeUpcoming` | *neutral (no modifier)* | `--color-surface-muted` | `--color-text-muted` |
| **Survey** | `submitted` | reuses `daysBadgeCompleted` copy | success | `--color-success-bg` | `--color-success` |
| Survey | `pending` | reuses `taskRequiredBadge` copy | warning | `--color-warning-bg` | `--color-warning-text` |
| Survey | `upcoming` | reuses `daysBadgeUpcoming` copy | **info** (note: tone differs from the Days page's own neutral "upcoming") | `--color-info-bg` | `--color-info-text` |
| **Program (whole‑program status)** | "Active" | `programStatusActive` | success | `--color-success-bg` | `--color-success` |
| **Course** | `completed` | reuses `daysBadgeCompleted` copy | success | `--color-success-bg` | `--color-success` |
| Course | `in_progress` | `programCourseStatusInProgress` | info | `--color-info-bg` | `--color-info-text` |
| Course | `upcoming` | reuses `daysBadgeUpcoming` copy | *neutral* | `--color-surface-muted` | `--color-text-muted` |
| **Dashboard task** | `required` | `taskRequiredBadge` | warning | `--color-warning-bg` | `--color-warning-text` |
| Dashboard task | `upcoming` | `taskUpcomingBadge` | info | `--color-info-bg` | `--color-info-text` |
| Dashboard task | `new` | `taskNewBadge` | success | `--color-success-bg` | `--color-success` |

**Copy‑reuse discipline:** the same localized string is deliberately reused across Days/Surveys/Program wherever the underlying *meaning* is the same ("Completed" is always the same word, never a per‑page synonym). Preserve this when extending the badge system.

### 13.3 Evaluation status, Report status, Attendance status — **not present in the approved design**

No evaluation feature, report‑submission feature, or attendance‑tracking feature exists anywhere in `bundle.css` or the prototype — consequently **there is no Evaluation status badge, Report status badge, or Attendance status badge to document**, and none should be invented here. If these features are built later (most plausibly as part of a future Trainer/Supervisor area — Sections 28–29), their status badges should be designed by extending the exact same pattern as 13.1–13.2: reuse the four existing semantic tones, follow the same copy‑reuse discipline, and — critically — **pick tones that don't collide with the meanings already established** (e.g., don't make a new "Rejected" status warning‑toned when warning already means "pending action" elsewhere in this same app; danger would be the correct, distinguishable tone for a negative/rejected outcome, since danger is not currently used for any status in Section 13.2).

### 13.4 Visual distinguishability, explicitly

Because every existing status pill shares the same shape/size/typography (only color + label differ), distinguishability rests entirely on the **label text** and the **color pairing** — this is why the copy‑reuse discipline (13.2) and the "don't collide tones" guidance (13.3) both matter: two different concepts must never end up both unlabeled‑and‑the‑same‑color, or they'd be visually indistinguishable pills. Always keep the label visible (never truncate a badge to an icon‑only dot) for exactly this reason.

---

## 14. Buttons

### 14.1 Primary

```css
.button { display:inline-flex; align-items:center; justify-content:center; gap:var(--space-2); border:1px solid transparent; border-radius:var(--radius-sm); padding:.65rem 1.25rem; font-size:.94rem; font-weight:600; min-height:2.6rem; background:var(--color-primary); color:var(--color-primary-contrast); }
```
Hover → `--color-primary-hover`. Active → `--color-primary-active`. Focus → global `:focus-visible` ring (`3px solid --focus-ring`, `2px` offset). Disabled → `opacity:.5; cursor:not-allowed`.

### 14.2 Secondary

`background: --color-surface; color: --color-primary; border-color: --color-border-strong`. Hover → `background: --color-primary-soft; border-color: --color-primary`. Same height/padding/radius/font as primary.

### 14.3 Ghost

`background: transparent; color: --color-text-muted; border-color: transparent`, tighter padding (`.55rem .9rem`). Hover → `background: --color-surface-muted; color: --color-text`. Used for topbar icon actions and low‑emphasis inline actions.

### 14.4 Destructive

`.button--danger`: `background: --color-danger; color: #fff`. Hover → `--color-danger-hover`. **Not currently used on any live trainee screen** (no destructive action — like "delete account" — exists in the approved design), but fully specified in `bundle.css` for future use (e.g., a future "cancel registration" action).

### 14.5 Icon button

`.button--icon`: square, `padding:.5rem`, `min-height/inline-size: 2.4rem` — used for the topbar's locale‑switch, notification‑bell, and mobile nav‑toggle buttons. Always paired with `aria-label` since it carries no visible text.

### 14.6 Disabled

Universal: `opacity:.5; cursor:not-allowed` — no separate disabled color palette; the resting color is simply dimmed. Applies identically across all four variants.

### 14.7 Loading

No separate "loading button" CSS class — the pattern is compositional: `disabled="{{isSubmitting}}"` on the button + a conditionally‑rendered inline `.spinner` (down‑scaled via inline style to `1rem`/`2px` border) inserted **before** the label + the label text itself swapping to a submitting‑state string (e.g. "Send" → "Sending…"). Reuse this exact three‑part contract (disable + spinner + label swap) for any new async button; don't just disable the button and leave its label unchanged.

### 14.8 Sizing/spacing summary table

| Property | Value |
|---|---|
| Height (`min-height`) | 2.6rem (41.6px) default/secondary/danger/ghost‑icon‑box; ghost (text) has no explicit min‑height override beyond the base |
| Padding | `.65rem 1.25rem` default; `.55rem .9rem` ghost; `.5rem` icon |
| Radius | `--radius-sm` (8px), all variants |
| Font | `.94rem` / 600, all variants |
| Icon gap | `--space-2` (8px) between icon and label |
| Icon position | Trailing (after label) for decorative/directional icons; leading (spinner) only for the loading state |

---

## 15. Form Controls

### 15.1 Text input / textarea

```css
.field input[type=text|password|number], .field textarea, .field select {
  width:100%; padding:.7rem .9rem; border-radius:var(--radius-sm); border:1px solid var(--color-border-strong); background:var(--color-surface); font-size:1rem;
}
:focus-visible { border-color: var(--color-primary); }   /* plus the global focus ring */
.field textarea { min-height:6rem; resize:vertical; }
```
Effective height with `.7rem` vertical padding + `1rem` line ≈ `2.7–2.8rem` (close to, but not identical to, the button's `2.6rem` — they are visually harmonious, not pixel‑identical, by design).

### 15.2 Select

**Styled but not used live.** `bundle.css` includes `select` in the same shared input rule (identical padding/border/radius/background to a text input), but **no screen in the approved design actually renders a `<select>` element** — every "choose one of several options" interaction in the product uses radio pills instead (`.option-item` for survey choices, `.status-radio-group` for filters). If a future screen needs a true dropdown‑select, the CSS is ready and matches the text‑input visual language automatically; just be aware no live reference screen exists to check against.

### 15.3 Radio / checkbox

- **Card‑styled radio row** (`.option-item`): a bordered, padded row (`border:1px solid --color-border; border-radius:--radius-sm`), highlighting on `:has(input:checked)` with `border-color:--color-primary; background:--color-primary-soft; font-weight:600`. Native input inside is `1.15rem`, `accent-color:--color-primary`.
- **Pill‑styled radio** (`.status-radio-group label`, filter pills): `999px` pill, checked state same border/background/text treatment as above.
- No standalone checkbox pattern exists outside these two radio‑based UIs (no free‑standing "agree to terms" checkbox is used anywhere in the approved design).

### 15.4 Date input

**Not present in the approved design.** No `type="date"` input or date‑picker component appears anywhere in the prototype's markup. If a real implementation needs one, `bundle.css`'s generic `.field input` rule will style it consistently with every other input, but no bespoke date‑picker calendar‑panel UI has been designed — that would be new work.

### 15.5 Search input

`.days-page__search`: a relatively‑positioned wrapper, leading magnifying‑glass icon absolutely positioned at the inline‑start edge (non‑interactive), text `<input type="text">` (not `type="search"` — a plain text input styled with a search affordance) with left padding cleared for the icon, plus a visually‑hidden `aria-label` distinct from its placeholder. Identical markup shape reused verbatim on Training Days, My Surveys, and Help's FAQ search.

### 15.6 Filter control

Covered fully in Section 17 — `.status-radio-group` pill rows, never a `<select>` dropdown, for every filter in the product.

### 15.7 Labels, helper text, required markers

- Label: `.94rem`, weight 600, `margin-bottom:--space-2`.
- Required marker: a plain `<span class="required-marker">*</span>` (danger‑colored) immediately after the label text — never a separate "(required)" word, always paired with `aria-required="true"` too.
- Helper/hint text (`.field-hint`): `.85rem`, muted, appears below the input when present (distinct from an error — a field can have a hint that's simply replaced by an error message when validation fails).

### 15.8 Focus state

`:focus-visible { border-color: --color-primary }` on the input itself, plus the app‑wide `:focus-visible { outline: 3px solid --focus-ring; outline-offset: 2px }` — both apply simultaneously (a colored border **and** an outer ring), giving inputs a more emphatic focus treatment than plain buttons/links get from the ring alone.

### 15.9 Validation error state

Driven by `data-invalid="{{bool}}"` on the **`.field` wrapper** (not the input): `.field[data-invalid="true"] input,textarea { border-color: --color-danger }`, paired with a `.field-error` message (`.85rem`, 600, danger) and `aria-invalid` bound to the same boolean. **Validation timing:** submit‑triggered / step‑advance‑triggered only, never live‑keystroke validation — typing only clears that field's existing error, it never proactively re‑validates. Preserve this exact timing; do not add live validation‑on‑type as a "modernization," it would diverge from the approved UX.

### 15.10 Disabled state

`disabled="{{isSubmitting}}"` on every input in a form for the duration of a submit — same universal `opacity:.5`‑style dimming as buttons (inherited from the browser's native disabled rendering plus the shared muted‑border styling; no bespoke "disabled input" color was found as a separate override, meaning native disabled appearance combined with the existing border‑strong color is the approved look).

---

## 16. Tables and Lists

### 16.1 Data table primitive — defined, not used live

```css
.table-scroll { overflow-x:auto; border:1px solid var(--color-border); border-radius:var(--radius); }
table.data-table { width:100%; border-collapse:collapse; min-width:32rem; }
.data-table th,td { padding:var(--space-3) var(--space-4); border-bottom:1px solid var(--color-border); text-align:start; }
.data-table tbody tr:last-child td { border-bottom:none; }
.data-table tbody tr:hover { background:var(--color-surface-muted); }
.data-table th { font-size:.78rem; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:var(--color-text-subtle); background:var(--color-surface-muted); }
```

- **Row height:** not fixed by a token — results from `--space-3 --space-4` cell padding around one line of `.78–1rem` text, roughly `2.5–3rem` per row in practice.
- **Zebra striping:** none — rows are flat, distinguished only by the `--color-border` divider and a `--color-surface-muted` hover tint. Do not add zebra striping; it isn't part of the approved visual language anywhere else in the system either.
- **Separators:** a 1px bottom border on every row except the last.
- **This primitive is fully specified but genuinely unused** by any live trainee screen — every trainee list uses the card‑list pattern below instead (16.2). This is the correct primitive to reach for if a future (e.g., Supervisor) screen needs genuinely tabular/dense data, per Section 28.

### 16.2 Card‑list pattern (what every actual list screen uses)

`.card-list { display:flex; flex-direction:column; gap:var(--space-4) }` wrapping a loop of item cards. Every list screen (Training Days, My Surveys, Training Program's courses, Help's FAQ) follows the identical shape: stat‑grid header → toolbar (search+filter, where applicable) → empty‑state **or** card‑list → pagination (where applicable). This is a deliberate, systemic choice for this trainee‑facing, non‑technical‑audience product (Section 1.4's density point) — not a placeholder for "should really be a table."

### 16.3 Responsive behavior — when does a table become a stacked/card layout?

Since no live screen uses `<table>`, there is no existing "table collapses to cards on mobile" breakpoint to document from the approved design. **Guidance for a future tabular screen:** reuse `.table-scroll`'s `overflow-x:auto` behavior (a horizontally‑scrollable table) as the baseline at all widths first, and only add a card‑stacking transform below a chosen breakpoint if the specific data genuinely doesn't tolerate horizontal scroll — but note that every trainee list in this product solved the "how does list data work on mobile" problem by simply never using a table in the first place (16.2), so that's the pattern to prefer over "responsive table that becomes cards" when starting something new.

---

## 17. Search / Filter / Sorting UI

### 17.1 Search bar

Section 15.5. Identical shape everywhere it appears: leading icon, `aria-label`‑bearing text input, placeholder copy per‑context.

### 17.2 Filter bar / chips

`.status-radio-group` — a wrapped row of pill‑shaped radio "chips" (native radios styled as a segmented control), not free‑floating dismissible tag‑style chips. Checked/active state: filled soft‑primary background + primary text/border (Section 15.3).

| Page | Options |
|---|---|
| Training Days | All · Upcoming · Completed |
| My Surveys | All · Pending · Upcoming · Submitted |
| Help FAQ | *(search only, no status filter)* |

### 17.3 Dropdown filters

**Not present.** Every filter in the approved design is a pill/radio‑group, never a `<select>`‑style dropdown filter. Do not introduce a dropdown filter pattern; it would be inconsistent with every existing filter UI in the product.

### 17.4 Active filter state

The checked pill's own visual state (filled soft‑primary) **is** the active‑filter indicator — there is no separate "N filters active" summary chip or badge shown elsewhere on the page.

### 17.5 Clear filters

A single text link/button ("Clear filters" / "Clear search"), shown **only inside the empty state** when the current search+filter combination yields zero results (Section 20) — it is not a persistently‑visible toolbar button. Clicking it resets both search text and the active filter back to defaults (`"all"` / empty string) and returns to page 1.

### 17.6 Sorting dropdown

**Not present anywhere in the approved design.** All lists render in a fixed natural (chronological) order; there is no "sort by" control on any screen. Do not add one — it would be a new feature beyond what's approved.

### 17.7 Result count

There is no explicit "Showing N of M results" string tied to the *filtered* list. The closest existing concept is the stat‑grid header above each list (Total/Completed/Upcoming, or Total/Submitted/Pending) — but those are **unfiltered, whole‑dataset counts**, not a live "N results for your current search" indicator. If a live filtered‑result count is wanted, it does not exist yet in the approved design and should be added as new, clearly‑scoped work (e.g., a small text line above the card‑list reading "{{filteredCount}} results"), not silently assumed to be one of the existing stat cards.

### 17.8 Placement & responsive/mobile behavior

Toolbar (search + filter pills) sits directly below the stat‑grid and above the list, `display:flex; gap:--space-3; flex-wrap:wrap; margin-bottom:--space-4`. On narrow widths the search input and filter‑pill row simply wrap onto their own lines (via `flex-wrap`) rather than needing a distinct mobile‑only layout — there is no collapsing‑into‑a‑drawer or "filters" modal‑sheet pattern anywhere in the approved design.

---

## 18. Pagination

`.days-pagination`: Previous / "Page N of M" / Next — no numbered page links, no page‑size selector, no jump‑to‑page input. Page size is **8 items** on both Training Days and My Surveys (the only two paginated lists). Previous is disabled on page 1; Next is disabled on the last page (both via the same universal disabled treatment, Section 14.6). The control is only rendered when `totalPages > 1` — a short list simply shows no pagination control at all, rather than a disabled single‑page one.

**Total results:** implicitly the same stat‑grid total shown above the list (Section 17.7's caveat applies equally here — there's no separate "42 results" string beside the pagination control itself).

**RTL/LTR:** Previous/Next swap their physical pointing direction automatically via logical‑property‑driven icon mirroring (consistent with every other directional‑icon rule in Section 32.3‑2) — "Previous" always means "toward the start of the list" regardless of language, which is the reading‑start direction, not a fixed physical side.

**Mobile behavior:** the control does not restructure on narrow widths — same three‑part row at every width, just within the already‑narrower page column.

---

## 19. Loading States

### 19.1 The only loading primitive: a spinner

```css
.spinner { display:inline-block; inline-size:1.75rem; block-size:1.75rem; border-radius:50%; border:3px solid var(--color-border); border-top-color:var(--color-primary); animation:spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
```

### 19.2 What does not exist

**No skeleton loader (card or table), no shimmer/pulse placeholder, and no full‑page loading state exist anywhere in the approved design.** The spinner is used exactly once per context: inline, inside a submit button, during the Contact form's and the Survey wizard's submit action (Section 14.7). There is no page‑level "fetching your dashboard…" state, because the prototype's data is synchronous/in‑memory — a real backend‑connected implementation will need one, but it does not exist yet as an approved pattern to copy.

### 19.3 Guidance for adding real network loading states without inventing new visual language

Because no skeleton system exists, **do not invent an unrelated shimmer‑skeleton design** to fill this gap. Prefer, in order: (1) the existing inline‑spinner‑in‑button pattern for any action‑triggered load (already fully specified, Section 14.7); (2) for a page‑level initial load, the existing `.state-view` shape (centered icon/spinner + message, Section 20.1) repurposed with the spinner in place of the icon — this reuses established visual language rather than adding a new one; only build a true skeleton‑placeholder system if genuinely necessary, and treat it explicitly as new design work when you do, flagged the same way this document flags every other gap.

### 19.4 Avoiding layout shift

Because loading is currently only ever inline‑in‑a‑button, there is no layout‑shift risk in the existing patterns (the button's own size is stable whether or not the spinner is present, since `min-height` is fixed regardless of content). If a page‑level loading state is added per 19.3, reserve the same box dimensions the loaded content will occupy (e.g., render the `.state-view` loading placeholder inside the same `.card`/grid container the real content will later fill) rather than letting the page reflow when data arrives.

---

## 20. Empty States

### 20.1 The shared primitive

```css
.state-view { padding:var(--space-7) var(--space-4); text-align:center; border-radius:var(--radius); }
.state-view__icon { inline-size:3rem; block-size:3rem; border-radius:50%; margin-bottom:var(--space-4); background:var(--color-surface-muted); color:var(--color-text-subtle); }
.state-view__title { font-weight:700; font-size:1.1rem; margin-bottom:var(--space-2); }
.state-view__message { color:var(--color-text-muted); margin-bottom:var(--space-4); }
```
Structure: centered icon circle → bold title → muted message → optional single centered action.

### 20.2 Empty states that exist

| Screen | Trigger | Icon | Title/message keys | Action |
|---|---|---|---|---|
| Training Days | search/filter → zero results | magnifying glass | `daysEmptyTitle` / `daysEmptyMessage` | "Clear filters" |
| My Surveys | search/filter → zero results | magnifying glass | `surveysEmptyTitle` / `surveysEmptyMessage` | "Clear filters" |
| Help FAQ | search → zero results | magnifying glass | `helpEmptyTitle` / `helpEmptyMessage` | "Clear search" |

### 20.3 Empty states that do not exist (do not invent copy/icons for these)

**No training days, no surveys, no evaluations, no reports:** none of these "zero real data" empty states exist in the approved design, because the prototype's underlying arrays are never actually empty — only *filtered‑to‑empty*, which the three states in 20.2 already cover. "No evaluations" and "no reports" additionally can't exist because those features themselves don't exist (Sections 13.3, 28, 29). If a real backend can genuinely return a trainee with zero training days ever assigned, that specific "no data yet" empty state (distinct from "no *matching* results") has not been designed and should be built using the same `.state-view` shape, with new (not invented‑to‑look‑canonical) copy and an appropriate icon, clearly understood as new work.

---

## 21. Error States

### 21.1 Inline field error

Section 15.9 — `.field-error` text under an individual invalid field.

### 21.2 Generic / form‑level error

```css
.state-view--error { background: var(--color-danger-bg); }
.state-view--error .state-view__icon { background: var(--color-danger-bg); color: var(--color-danger); }
```
Rendered **in place**, inside the form's own card, on a failed submit (Contact form, Survey submission) — never a toast, never a page redirect. A tighter inline variant (`start`‑aligned text, reduced padding) is used when the error sits directly inside an already‑bordered form card rather than standing alone as a full‑width block.

### 21.3 Not found (record‑level)

Training Day Details and View Survey both handle "the id in state doesn't resolve to a real record" with a dedicated not‑found message (`dayDetailsNotFoundTitle/Message`, `surveyNotFoundTitle/Message`) rather than a blank page. Any new detail‑view screen that looks up a record by client‑side id must implement the same explicit branch.

### 21.4 Forbidden, session expired, network error — **not present in the approved design**

No 403/forbidden screen, no "your session has expired, please log in again" screen, and no dedicated offline/network‑error screen exist anywhere in the prototype — because there is no real authenticated‑session or network‑request lifecycle to fail in this artifact (Section 31). These are real gaps a production implementation will need to fill. **Guidance, not fabricated spec:** build them from the same `.state-view`/`.state-view--error` primitive already used for the generic error case (21.2), with the same icon‑circle → title → message → single action shape — a session‑expired screen's action would plausibly be "log in again," a network‑error screen's action would plausibly be "Retry" — but treat the exact copy and the retry‑button's specific behavior as new work to be designed, not as something this document can honestly claim already exists.

### 21.5 Message hierarchy

Consistently: **icon** (semantic color) → **bold title** (what happened, short) → **muted message** (more detail/next step) → **one action** (never more than one primary recovery action in any error state observed). No error state in the approved design shows a request ID or support‑contact reference — if one is added for real backend errors, place it as a small, muted, monospace‑or‑plain line below the message (consistent with `.state-view__request-id`, which is already defined in `bundle.css` even though no current error state populates it — meaning space for a request ID was anticipated in the base component library, just never used yet).

---

## 22. Modal and Dialog Design

**No modal or dialog component exists anywhere in this design system.** An exhaustive search of `bundle.css` and the prototype's own CSS/markup finds zero `.modal`, `.dialog`, centered‑panel‑with‑backdrop pattern, or `<dialog>` element usage. The closest existing analog is the notification dropdown (`.notif-panel`, Section 9.6/17) — an anchored, non‑backdrop‑blocking panel, structurally very different from a modal.

**If a confirmation dialog or modal form is genuinely required later,** build it as new work using only existing primitives, so it feels native to the system rather than bolted on:
- Panel: `.card`'s surface/border/`--radius` (14px) language, elevated to `--shadow-lg` (the same elevation already used for the mobile drawer/dropdown, Section 6).
- Backdrop: the same technique as `.sidebar-scrim` (`rgba(15,20,17,.45)`, `animation: fade-in var(--transition-base) ease-out`).
- Buttons: standard `.button`/`.button--secondary` pair for confirm/cancel.
- Width: no token exists for this; a reasonable default consistent with the system's other "reading" surfaces would be capped around `28rem`–`32rem` (matching the Logged‑Out screen's own centered‑card width, `28rem`, the one existing precedent for a small centered informational panel in this codebase).

This must be flagged as new design work when built, not represented as reproducing an existing approved modal — because none exists.

---

## 23. Animation and Micro‑interactions

### 23.1 Inventory of what's actually animated

| Element | Animation | Duration/easing |
|---|---|---|
| Mobile sidebar drawer | `transform` slide | `var(--transition-base)` (see 23.2 — currently undefined) |
| Sidebar scrim | `fade-in` (`opacity 0→1`) | `var(--transition-base) ease-out` |
| Spinner | `rotate(360deg)` infinite | `0.8s linear infinite` (this one is a hardcoded literal, not tokenized) |
| Survey progress bar fill | `width` transition | `var(--transition-base)` |
| Buttons / inputs / nav‑links / badges / interactive cards / locale‑switch / filter pills | `background`/`border-color`/`box-shadow`/`transform` transitions on hover/active/focus/checked | `var(--transition-base)` |

There is no accordion component and no dropdown‑open/close animation beyond the notif‑panel's instant `sc-if` show/hide (it appears/disappears immediately, with no fade or slide of its own — only the *scrim* behind the sidebar fades, the notif‑panel itself does not).

### 23.2 Critical gap: `--transition-base` is referenced everywhere, defined nowhere

Every transition listed above (over a dozen distinct declarations across `bundle.css`) references `var(--transition-base)` — **this token is not defined in `tokens.css` or anywhere else in the project.** An undefined custom property with no fallback makes the property invalid at computed‑value time, so in the current approved source, every one of these transitions effectively has no animated duration. **Fix (required, one line, in the token file — not per‑component):**

```css
:root { --transition-base: 160ms ease; }
```

Pick one duration for the whole system; do not vary it per component now that the token exists.

### 23.3 What is deliberately not animated

Screen‑to‑screen navigation (sidebar‑driven) is an instant re‑render — no route‑transition fade/slide. Locale switching (Arabic ↔ English) is instant — no cross‑fade. Page content has no entrance animation (no fade‑or‑slide‑in on mount). This is a deliberate scope boundary: **the system's motion vocabulary is limited to micro‑interactions on interactive elements, never macro page‑level transitions.** Do not add page‑transition or content‑entrance animation; it would be new, unapproved motion design.

### 23.4 Rules for any new animation

Subtle, professional, fast (once `--transition-base` is defined, everything shares that one short duration — nothing in this system uses a slow, showy, multi‑hundred‑millisecond decorative animation), never purely decorative (every existing animation communicates a state change: open/closed, hover, progress, loading — none exist "just for delight"). **Respect `prefers-reduced-motion`:** no such media query currently exists anywhere in the codebase (a real gap, Section 34.6) — add `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }` (or equivalent) in the same change that defines `--transition-base`, so fixing the missing‑duration bug doesn't regress users who currently get reduced motion by (unintentional) default.

---

## 24. Dashboard Design

### 24.1 Section order

1. Welcome banner / hero (full‑width)
2. Stat grid — 4 KPI cards: Hours, Days, Courses, Progress (`.fixed-ltr`)
3. Upcoming Session + Task List — 2‑column row (`.dashboard-grid--reverse.fixed-ltr`)
4. Program Message + Quick Stats + Recent Activity — 3‑column row (`.dashboard-grid--three.fixed-ltr`, 1‑column below 900px)

### 24.2 Welcome banner / hero — exact visual behavior of the gradient and image (the most‑iterated component in the project)

- Two‑zone grid, `grid-template-columns: 57fr 43fr` (text : image), `min-height: 11.5rem`, `border-radius: --radius-lg` (20px), `overflow: hidden`, `box-shadow: --shadow-md`.
- **Image zone is always the physically‑second grid track**, unconditionally (`order: 1` on `.welcome-banner__image`, no `[dir]` variation on this specific rule) — combined with reading‑order‑driven grid placement, this produces: **English:** text left, image right. **Arabic:** text right, image left.
- **The gradient is painted once, at the section level** (`.welcome-banner`), not on the text panel: `linear-gradient(155deg, var(--color-primary) 0%, var(--color-primary-active) 100%)`. The text panel (`.welcome-banner__body`) is `background: transparent`, letting the section gradient show through it continuously.
- **The photo lives in a `::before` pseudo‑element** of the image zone (not a plain `background-image` on the element itself), specifically so it can carry its own independent `transform`:
  - **English only:** `transform: scaleX(-1)` — the photo is horizontally mirrored.
  - **Arabic:** `transform: none` — shown in its natural orientation.
- **The photo fades into the gradient via `mask-image`**, not a separately‑colored overlay box — this guarantees pixel‑exact color continuity by construction:
  ```css
  .welcome-banner__image { mask-image: linear-gradient(to right, transparent 2%, black 45%); -webkit-mask-image: linear-gradient(to right, transparent 2%, black 45%); }
  .proto-shell[dir="rtl"] .welcome-banner__image { mask-image: linear-gradient(to left, transparent 2%, black 45%); -webkit-mask-image: linear-gradient(to left, transparent 2%, black 45%); }
  ```
  The `to right`/`to left` keyword flips specifically so the fade always starts from the edge where the photo meets the text panel, whichever physical side that is.
- Title row's flex order is **not** reversed for RTL (an earlier iteration had `flex-direction: row-reverse` here; it was explicitly removed per an approved change and must stay removed).
- Below 640px: collapses to one column, image `display: none` entirely — text‑only hero on small phones, never a stacked text‑over‑image mobile layout.
- Greeting text is computed from real profile data every render: `"Welcome back, " + firstName` / `"مرحباً بك مجدداً يا " + firstName`, `firstName = PROFILE.name[locale].split(" ")[0]` — never a hardcoded sample name.

### 24.3 KPI cards

Four `.stat-card`s (Section 12.3), fixed order regardless of locale (Hours → Days → Courses → Progress), 2×2 on mobile / 1×4 from 640px. Only the Progress card uses the conic‑gradient ring; the other three use flat icon‑circle fills.

### 24.4 Upcoming Session card

Fixed‑physical layout (explicit `[dir="rtl"]` row‑reverse overrides, Section 32.5): date block (`#3f7160` background, oversized `2.6rem` day number) + thumbnail image + course/program name + time/location/trainer facts + status badge pill + a primary action whose label depends on `NEXT_SESSION.surveyState` ("Open survey" vs. "View survey").

### 24.5 Task List card

2–3 rows, each: small icon tile (doc/book/megaphone variant) + label + course name + status badge (reusing the Dashboard‑task badge tones, Section 13.2). Header includes a "View all" link to Training Days with a mirrored directional arrow.

### 24.6 Program Message, Quick Stats, Recent Activity

Three simple, non‑interactive‑beyond‑one‑link cards: a real localized encouragement message; a 3‑row "done / total" list (Surveys, Days, Courses); and a short dated activity list (the same data source the notification panel reuses).

### 24.7 Responsive stacking & visual hierarchy

Widest ceiling of any screen (`72rem` vs. the standard `52rem`, Section 7.2) because it's a card‑grid, not a prose column. Visual hierarchy top‑to‑bottom is deliberately "identity/welcome → headline numbers (KPIs) → the one thing to act on now (Upcoming Session/Tasks) → supplementary context (message/quick stats/activity)" — preserve this ordering; it is not arbitrary.

---

## 25. Training Days Page

### 25.1 Structure

Page header (role eyebrow, icon‑title, subtitle + secondary count line) → `.days-stat-grid` (Total/Completed/Upcoming, each with a 3rd `__desc` line) → toolbar (search + All/Upcoming/Completed filter pills) → empty state **or** `.card-list` of `.day-card` → pagination (8/page).

### 25.2 Status hierarchy & actions

Statuses in visual priority order: `next` (info, the one day most likely to need attention) and `pending` (warning, an overdue survey) both get the highlighted date‑block treatment and a primary action button; `completed` (success) and `upcoming` (neutral) are purely informational rows with only the always‑present "View details" link.

### 25.3 Status derivation (must be preserved exactly)

A day's status is derived relative to the single "next session" record, never stored independently: the day matching `NEXT_SESSION` → `next`; the one day immediately before it → `pending`; every earlier day → `completed`; every later day → `upcoming`. This is what keeps the Dashboard, Days list, and Surveys list from ever contradicting each other about what's "next" — preserve this single‑source derivation in any real backend.

### 25.4 Empty / loading / error states

Empty: Section 20.2 (search/filter → zero results). Loading: no page‑level loading state exists for this screen in the approved design (Section 19.2/19.3 guidance applies). Error: no page‑level fetch‑error state exists either (Section 21.4 guidance applies) — both would be new work if this screen becomes backend‑driven.

---

## 26. Training Program Page

### 26.1 Structure

Page header — the **real program's name** as the `<h1>` (not a generic "Training Program" label) + program dates + an "Active" success badge beside the title → `.program-stat-grid` (Hours/Days/Courses/Progress‑ring, each with a `__desc` line) → a "Courses" section header → `.card-list` of `.program-course-card` (icon circle, name, status badge, day/hour facts).

### 26.2 No invented program description

**The approved design does not include a free‑text "about this program" description block anywhere on this page** — only the structured facts already listed (name, dates, status, stat totals, course breakdown). Do not add a descriptive paragraph about the program's goals/content; it is not part of the approved design, and no source copy for one exists.

### 26.3 Data‑integrity rule to preserve

Course day‑counts sum to exactly the program's total day count; hours‑per‑day is derived (`totalHours / totalDays`) and applied per course — the course breakdown is a **partition** of the program‑level totals, never an independently‑entered second set of numbers. Preserve this derived‑from‑one‑source relationship against any real course‑records backend.

### 26.4 Responsive layout

Same reading‑column max‑width (`52rem`) as most other content pages (not the Dashboard's wider `72rem`); stat grid follows the same 2‑col/4‑col breakpoint as every other stat grid (Section 33.3).

---

## 27. Survey / Evaluation Forms

*(The approved design's only such feature is the post‑session Survey; there is no separate "Evaluation" form — see 13.3/28/29 for why "Evaluation" specifically doesn't exist as its own concept.)*

### 27.1 Stepper / progress

`.survey-progress`: a thin (`0.4rem`) progress‑bar track/fill plus a "Question N of M" label (using the bidi‑safe "of" pattern, Section 3.7), proportional to `(currentStep+1)/totalQuestions`.

### 27.2 Questions & rating controls

One question per step, three control types only: **choice** (`.option-item` radio rows), **rating** (five 1–5 radio pills with low/high hint labels), **text** (plain `<textarea>`). No other question types exist (no matrix/grid question, no file‑upload question, no date question).

### 27.3 Navigation buttons

Previous (disabled on the first question) / Next — Next validates the current step first (required‑and‑empty → inline error, no advance). The final question's button becomes "Submit" instead of "Next."

### 27.4 Validation

Submit/step‑advance‑triggered only (Section 15.9's timing rule applies identically here) — a required, empty answer blocks advancing with an inline error; typing clears that question's own error.

### 27.5 Submit confirmation & submitted state

Submitting writes to the shared database (`getDb()` → `surveyResponses` collection) through the idle→submitting→success→error contract (Section 15.6/19.2). Success replaces the wizard, in place, with a success `.state-view`. Once a survey's status is `submitted`, reopening it later renders **all** questions at once in a **read‑only review** layout (`.survey-answer-readonly` chips, no stepper) — this is a real, permanent product rule ("answers are final," documented in the Help FAQ too), not an incidental limitation; enforce it server‑side in any real backend, not just hidden in the UI.

### 27.6 Mobile layout

No structural change — the one‑question‑per‑step wizard is already a narrow, single‑column layout at every width; the option rows and rating pills wrap naturally rather than needing a distinct mobile variant.

### 27.7 Content honesty note

The four sample questions are explicitly documented in the source as generic placeholder content (a visible on‑page notice says so) — no real question bank exists in the project's source requirements. Replace the question text when real content is supplied, but preserve the exact three control types and the wizard/review mechanics.

---

## 28. Supervisor Pages

**No supervisor‑specific page — dashboard, attendance page, or evaluation page — exists in the approved design.** This was verified by searching `bundle.css` and the prototype's full markup/script for any supervisor‑specific class, route, or data model; none exists beyond the single `ROLE_LABEL` string pair (Section 1.2), which exists only so `{{profile.roleLabel}}` prints correctly *if* the logged‑in user's role were ever `supervisor` instead of `trainee` — it is a translation‑table entry, not evidence of a built supervisor experience.

Consequently, there is nothing to document for: a Supervisor dashboard, an attendance page (mark/view attendance), an evaluation page (score/review a trainee), filters/search on any such page, status presentation on any such page, or table/mobile behavior for any such page — **none of it exists**, and inventing plausible specifications for any of it would violate the explicit "do not invent business features not represented in the approved design" instruction this whole document is built around.

**If this area is built:** treat it as genuinely new design work, built on this system's existing foundations — the `.data-table` primitive (Section 16.1, defined but unused, a strong fit for an attendance roster or an evaluation queue), the existing card/badge/button/form vocabulary, and the same search‑filter‑paginate‑card‑list skeleton used throughout the trainee experience (Section 16.2) — but do not assume it reuses specific trainee screens beyond that shared foundation, because no approved supervisor‑specific visual reference exists to constrain those decisions.

---

## 29. Trainer Pages

**No trainer‑specific page — dashboard or report form — exists in the approved design**, for the same reason and with the same evidence as Section 28. "Trainer" appears in exactly two places in the entire codebase: (1) the `ROLE_LABEL` pair, same purpose as Supervisor's; (2) as a plain **read‑only data value** — a trainer's name, shown to the *trainee* on training‑day cards, day details, and the Dashboard's Upcoming Session card (e.g., "Ms. Sarah Al‑Harbi" / "أ. سارة الحربي"). This is the trainee viewing her trainer's name; it is not any part of a trainer's own interface.

There is no Trainer dashboard, no report‑submission form, no draft/submitted‑state pattern for a trainer‑authored report, no trainer‑specific cards, actions, or responsive behavior to document — none of it exists. Per the same rule as Section 28: this is new design work if pursued, built from this system's foundations (the same idle/submitting/success/error form contract already proven out by the Contact and Survey forms would be the natural basis for a "draft → submitted" report form, for instance), not something this specification can claim already exists.

---

## 30. Profile Page

### 30.1 Layout

Page header (role eyebrow, icon‑title, subtitle) → `.profile-summary-card` (identity + embedded program‑info‑box) → `.profile-account-card` (title/subtitle + `.profile-field-list` of 5 fields) → `.profile-card-footer` (single "Log out" button).

### 30.2 Avatar

A circle showing computed initials (not a photo) — `.profile-avatar`, larger than the topbar's own avatar instance (topbar: `2.1rem`; profile summary card's avatar is visually larger as the card's focal identity element — see the card's own sizing in the source CSS for the exact value if pixel‑matching).

### 30.3 User data / fields

Five read‑only rows (icon + label + value): Full Name, Email (`<bdi dir="ltr">`), Mobile (`<bdi dir="ltr">`), Role, Language (displays the *name* of the active language, not a switcher — the switcher itself lives only in the topbar). Two‑column field grid on wide viewports, single column on narrow (Section 33.3).

### 30.4 Sections

Exactly two content sections (summary card, account‑details card) plus the footer action — there is no separate "preferences," "notifications," or "security" section anywhere on this page.

### 30.5 Form controls

**None — every field is read‑only display, with no edit form or "Save changes" action anywhere on this page.** This is an explicit, documented product rule (also stated in the Help FAQ: profile details are managed by program administration, not self‑service‑editable). Do not add inline editing; it would contradict the approved design and the documented business rule behind it.

### 30.6 Actions

The only action on the entire page is "Log out" (secondary‑styled button, leading icon, in the card footer).

### 30.7 Responsive behavior

Field list: 2 columns ≥ some mid‑width breakpoint, 1 column on phones (Section 33.3). Cards themselves stack full‑width at every width (this page never uses a multi‑column card layout beyond the internal field grid).

---

## 31. Login / Forgot Password / Reset Password

**No live, interactive markup for any authentication screen exists in this artifact.** The prototype's state machine starts already authenticated; its only "auth‑adjacent" screen is the Logged‑Out placeholder (31.3), not a real login form.

### 31.1 What does exist: a complete, unused CSS system

`bundle.css` defines a full Login/Auth page component system with **no corresponding markup anywhere in the prototype**:

- `.auth-page` — full‑bleed page background (no `.app-main` max‑width constraint), a hero photo positioned differently at different breakpoints (`background-position: 100%` below 767px).
- `.auth-hero-overlay` — a gradient/tint overlay over the hero photo.
- `.auth-card` — the form panel.
- `.field--icon` — an icon‑prefixed input variant (not used elsewhere in the live app, which never prefixes a field icon inside the input itself, only beside search boxes).
- `.auth-submit` — the submit button variant.
- `.auth-page__lang-switch` — a language‑switch pill, **explicitly pinned to a fixed physical corner (`top`/`right`, not `inset-inline-end`) in *both* languages**, specifically because the design's quote overlay is also pinned to a fixed physical side regardless of locale — a deliberate, documented RTL exception unique to this unused page (see Section 32.3 for why this matters as a pattern).
- Its own dedicated RTL pinning rules for a hadith‑quote overlay and the form panel, and its own responsive behavior at `640px`/`767px`/`959.98px`.
- Source comments reference an external `login/page.tsx` and an `approved-login-reference.png` — implying a real, more complete codebase this design system serves, neither of which is available inside this artifact.

### 31.2 What this means for implementation

If asked to build the actual Login/Forgot‑Password/Reset‑Password screens, **reuse these exact class names and their existing rules** (`.auth-page`, `.auth-hero-overlay`, `.auth-card`, `.field--icon`, `.auth-submit`, `.auth-page__lang-switch`) rather than inventing a parallel visual system — they are clearly the intended primitives. But the actual page composition beyond what these class names/rules already imply (exact copy, exact field set for each of the three screens, exact error‑state wording) is **not specified** in any available source material, and must either be obtained from the referenced external reference or explicitly designed as new work and flagged as such — never presented as "the approved design" when it isn't.

### 31.3 Logged‑Out screen (the one built auth‑adjacent screen)

A minimal centered card (`max-width: 28rem; margin-inline: auto; text-align: center`): title, message, one primary "Back in" button that simply resets `screen` back to `"dashboard"` — i.e., in this prototype "logging back in" is a state reset, not a real authentication flow. Do not mistake this for a login screen.

### 31.4 RTL/LTR differences (for the unused Auth system specifically)

The one documented, deliberate exception: the language‑switch pill (`.auth-page__lang-switch`) and the hero's quote overlay are **both** pinned to the same fixed physical corner in every language (not mirrored), specifically to avoid the switch pill overlapping the quote text in Arabic if it were mirrored to the logical‑opposite corner instead. This is the same category of "explicit, narrow, intentional exception to default mirroring" documented for the Dashboard's `.fixed-ltr` elements (Section 32.5) — apply the same discipline: preserve this exception exactly if/when this screen is built, don't "fix" it into full logical mirroring.

---

## 32. RTL / LTR Rules

### 32.1 Direction is locale‑driven, app‑wide, from one root attribute

`state.locale` (`"ar"` default / `"en"`) drives `dir = locale === "ar" ? "rtl" : "ltr"` at the shell root. Every RTL‑specific rule in the system is scoped through this one attribute selector — direction is a CSS‑cascade concern, not a prop threaded through every component.

### 32.2 Default strategy: logical properties (automatic mirroring — do not rely on this alone, but it is the default)

The large majority of the system uses `margin-inline-*`, `padding-inline-*`, `inset-inline-*`, `border-inline-*`, `text-align:start` rather than physical equivalents, so most components mirror with zero explicit RTL CSS. This is the default and should remain the default for any new component — but the instruction "do not rely only on automatic mirroring" is correct and important: several real categories of CSS **cannot** be expressed logically, and the system's actual, tested RTL correctness comes from the explicit overrides in 32.3, not from logical properties alone.

### 32.3 Where explicit `[dir="rtl"]` overrides are genuinely required (exhaustive checklist)

1. **Gradients & masks** (`linear-gradient(to right/left,…)`, `mask-image`) — no logical keyword exists; every instance needs a paired `[dir="rtl"]` override flipping the physical keyword. (Welcome‑banner hero, Section 24.2.)
2. **`transform`** values that mirror content (`scaleX(-1)`) — used for the hero photo (English‑only mirror) and for directional icon glyphs (`[dir="ltr"] svg { transform: scaleX(-1) }` on some assets — note some icons are authored RTL‑native and flipped for LTR, and it's essential to check each specific asset's authored orientation rather than assume a universal "always flip in RTL" rule).
3. **Specificity collisions against a more specific existing RTL rule.** Two real, previously‑shipped bugs in this exact codebase were caused by this: `html[dir="rtl"] .app-sidebar { transform: translateX(100%) }` (closed‑state) outranks a plain two‑class open‑state or desktop‑sticky selector, so both had to be re‑declared with the identical `html[dir="rtl"]` prefix to win the cascade. **Checklist item for implementers:** whenever a new `[dir="rtl"]`‑scoped rule uses a compound/attribute selector, check whether a later state‑change rule for the same element needs that identical prefix repeated, or it will silently lose in Arabic only.
4. **Deliberately fixed physical layouts** (`.fixed-ltr`, Section 32.5) — an explicit, narrow, by‑design exception to mirroring, not a limitation of CSS.
5. **Letter‑spacing removal** on three components (`page-header__eyebrow`, `.badge`, `.program-info-box__label`) — Arabic script doesn't tolerate manual letter‑spacing the way Latin uppercase does.
6. **Deliberate exceptions to the mirror‑everything default**, which must be preserved exactly, not "fixed" back to full mirroring: the welcome‑banner title row's non‑reversed flex order (24.2); the unused Auth page's fixed‑corner language‑switch/quote‑overlay pinning (31.4).

### 32.4 Sidebar, breadcrumb, icon, button, image, gradient — the requested checklist, explicitly

| Element | RTL behavior | LTR behavior | Mirrors automatically? |
|---|---|---|---|
| Sidebar | Sits at the inline‑start edge → physically right | Sits at the inline‑start edge → physically left | Position: yes (logical). Slide‑transform: **no**, needs explicit override (32.3‑3). |
| Breadcrumb | Reads start‑to‑end in RTL order; separator chevron points toward reading‑end (physically left) | Same logical order; chevron points physically right | Layout: yes. Chevron glyph: **no**, needs asset‑specific mirroring. |
| Icons (directional: arrows, chevrons) | Authored orientation varies by asset — check each one | — | **No** — case‑by‑case, never assume |
| Icons (non‑directional glyphs — most icons in the system) | Same in both directions | Same in both directions | N/A — never mirrored, shouldn't be |
| Buttons | Icon‑then‑label vs label‑then‑icon follows logical DOM order (icon after label in DOM for trailing/decorative icons) | Same DOM order, renders as label‑then‑icon | Yes (logical flex order + `text-align:start`) |
| Images (hero photo) | Shown unmirrored (natural orientation) | Mirrored via `scaleX(-1)` | **No** — explicit, asymmetric, deliberate (24.2) |
| Gradients (hero background, masks) | `to left` | `to right` | **No** — needs explicit paired declarations (32.3‑1) |
| Flex/grid direction (general) | Follows document direction automatically (`flex-direction:row` reads reversed under `dir=rtl` per the CSS spec's own flex‑direction behavior) | Standard | Yes, **except** where `.fixed-ltr` or an explicit `row-reverse` override intervenes (32.5) |

### 32.5 The complete `.fixed-ltr` / explicit‑reversal exception list

Components explicitly **not** mirrored (forced `direction:ltr` via `.fixed-ltr`), or explicitly **force‑reversed** via an opposite‑technique override — both are deliberate, narrow exceptions, not a general strategy:

- Dashboard stat‑grid row — `.fixed-ltr` (direction lock).
- Dashboard Upcoming‑Session + Task‑List row — `.fixed-ltr` (direction lock); the Upcoming‑Session card's *internal* date/thumbnail/body arrangement additionally uses its own explicit `[dir="rtl"]` row‑reverse rules layered on top (the outer `.fixed-ltr` doesn't reach every internal detail).
- Quick Stats card's bar‑chart decoration — a scoped `[dir="rtl"] { direction: ltr }` trick on just that element.
- The rebuilt `.stat-card`'s icon/text row — `.proto-shell[dir="rtl"] .stat-card { flex-direction: row-reverse }` (the opposite technique: explicit *reversal*, because this element *should* mirror — icon nearest the reading‑start edge in both languages — unlike the truly direction‑locked elements above).
- The unused Auth page's language‑switch + quote overlay — fixed to the same physical corner in both languages (31.4).

**Do not extend this list.** Any new component defaults to full logical mirroring unless there is an explicit, specific instruction to add it to this exception set.

---

## 33. Responsive Breakpoints

### 33.1 The system's actual breakpoint set (every `@media` query, consolidated)

The approved design's breakpoints are: `420px`, `560px`, `640px`, `641–959px` (range), `767px`, `860px`, `900px`, `959px/959.98px/960px`, `1179.98px`, `1180–1535.98px` (range), `1280px`. These do not line up one‑to‑one with the specific device‑width figures below (`1536/1366/1024/768/390/375`) — the table in 33.2 maps each requested figure onto the nearest actual behavior‑changing breakpoint(s) in the real system, rather than inventing rules at widths the approved CSS never actually queries.

### 33.2 Behavior at the requested reference widths

| Width | Nearest real breakpoint(s) in effect | Sidebar | Header | Grids | Cards | Tables | Filters | Buttons | Forms | Typography |
|---|---|---|---|---|---|---|---|---|---|---|
| **1536px** | Above `1280px` and above `1535.98px` | Sticky desktop column (17rem) | Full 3‑zone layout, largest Bismillah size step | All grids at their maximum column count (4‑col stat grid, 2‑col dashboard grid, 3‑col bottom row, 4‑col help‑quicklinks) | Full padding, no compression | N/A (none used live) | Full inline toolbar | Standard sizing | Full 2‑column field grids where applicable | Largest Bismillah step; all other type sizes constant across all desktop widths |
| **1366px** | Between `1180px` and `1535.98px` | Sticky desktop column | Bismillah mid‑large size step | Same as 1536px (no grid changes between 960–1536px beyond the 900px 3‑col threshold, already crossed) | Same | N/A | Same | Same | Same | Bismillah mid step; body type constant |
| **1024px** | Above `960px` (desktop sidebar mode), below `1180px` | Sticky desktop column | Bismillah smallest desktop size step (below 1179.98px) | Same grid column counts as above (960px is not a grid‑column threshold itself; 900px already applied below this) | Same | N/A | Same | Same | Same | Bismillah smallest desktop step |
| **768px** | Just above `767px`, within `641–959px`, below `860px` | **Off‑canvas mobile drawer** (below the 960px sidebar threshold) | Program‑info‑box date sub‑line now shows (above 767px); mobile nav‑toggle visible | `.dashboard-grid`/Contact grid still 1‑column (below 860px); stat‑grid already 4‑col (above 640px); 3‑col bottom row still 1‑column (below 900px) | Standard padding | N/A | Toolbar wraps as needed | Standard | Contact form row likely still 2‑col if above its own ~640–767 threshold — verify against the live rule if pixel‑exact matching matters | Base sizes |
| **390px** | Below `420px` and `560px`, well below `640px` | Off‑canvas drawer | Program‑info‑box hidden entirely (<560px); user‑menu name/role hidden (<560px); topbar padding tightened (<640px) | Stat‑grid 2‑column (below 640px); dashboard/contact grids 1‑column; welcome‑banner hero image hidden entirely | Reduced app‑main padding (`--space-5 --space-3 --space-7`) | N/A | Search + filter pills wrap onto their own lines | Full‑width, standard height | Contact form row collapses to 1 column | Base sizes (no separate "mobile type scale" — the system does not shrink font sizes further at phone widths beyond what's in Section 3.5) |
| **375px** | Same bracket as 390px, plus `420px` max‑width tweaks (contact form footer etc.) | Off‑canvas drawer | Same as 390px | Same as 390px | Same as 390px | N/A | Same as 390px | Same as 390px | Same as 390px, with the extra `420px` micro‑adjustments applied | Same as 390px |

### 33.3 Grid column counts, quick reference

| Grid | <640px | 640–859px | 860–899px | ≥900px |
|---|---|---|---|---|
| `.stat-grid` (Dashboard/Days/Surveys/Program) | 2 | 4 | 4 | 4 |
| `.dashboard-grid` / Contact grid | 1 | 1 | 2 | 2 |
| `.dashboard-grid--three` | 1 | 1 | 1 | 3 |
| `.help-quicklinks` | 2 | 2 | 2 | 4* |
| `.profile-field-list` | 1 | 2 | 2 | 2 |
| `.contact-form-row` (Name/Email) | 1 | 1 | 2 | 2 |

*\* verify the exact switch‑point against the live CSS rule at implementation time if pixel‑perfect matching matters; documented here as "2‑col narrow / 4‑col wide."*

### 33.4 Controlling philosophy

Mobile‑first (base rules target the smallest viewport, `min-width` queries progressively enhance). **`960px` is the one structural breakpoint** (sidebar mode); everything else is spacing/column‑count refinement within the two macro states (mobile‑drawer vs. desktop‑sidebar) it defines. Treat 960px as the primary line when reasoning about this app.

---

## 34. Accessibility

### 34.1 Contrast

Every semantic pairing (Section 2.3) uses a saturated text color on a pale tint of the same hue family, chosen to hold AA‑level contrast at the sizes badges/messages actually appear at. Body text (`--color-text` `#24332f`) on the page background (`--color-bg` `#f8f6f0`) and on card surfaces (`--color-surface` `#ffffff`) both comfortably clear AA for normal text. When introducing a new color combination, hold it to the same bar — don't assume "it's the brand color, it's fine."

### 34.2 Focus

Global: `:focus-visible { outline: 3px solid var(--focus-ring); outline-offset: 2px; border-radius: var(--radius-sm); }` — `--focus-ring` equals `--color-primary` (a strong‑contrast color, never the default browser blue), with a dark‑mode‑appropriate brighter value in dark mode. Inputs additionally get `border-color: --color-primary` on focus (a second, colored‑border cue on top of the ring). `.help-quicklink` hand‑specifies a tighter `outline: 2px solid --color-primary; outline-offset: 2px` because its custom tile chrome needs the ring pulled in from the default offset. A skip link (`.skip-link`) is present and must remain the first focusable element on every page.

### 34.3 Keyboard navigation

Filter "pills" are real `<input type="radio">` elements in a labeled group — this preserves native arrow‑key radio‑group navigation and screen‑reader semantics, rather than reimplementing a segmented control with `<button>`s and manual ARIA/keyboard handling. Every interactive element in the system is a native focusable element (`<button>`, `<a>`, `<input>`) — there are no `<div onClick>` pseudo‑buttons anywhere in the approved markup, which is why no bespoke keyboard‑handling code is needed anywhere in the prototype's script.

### 34.4 Form labels

Every input has a real, associated `<label for="…">`; every icon‑only button has an `aria-label`; every search input's `aria-label` is distinct from its placeholder (placeholders are never used as the sole accessible name).

### 34.5 Semantic HTML

Breadcrumbs use `<nav aria-label="breadcrumb">`; the Logout sidebar entry is a real `<button>` (not a styled `<a href="#">`) since it performs an action rather than navigating to a URL; headings follow a real `h1`→`h2`→`h3` hierarchy per page rather than styling arbitrary elements to look like headings.

### 34.6 Status meaning without color

Every status badge pairs its color with a **text label** (Section 13.4) — color is never the sole carrier of meaning. The one place color alone might seem to carry meaning — the day‑card date block's "highlighted" fill for actionable days — is always accompanied by the same day's status badge text nearby, so the actionable state is never conveyed by color/fill alone.

### 34.7 Reduced motion

**Not currently implemented — a real gap.** No `prefers-reduced-motion` query exists anywhere in the codebase. Because `--transition-base` is also currently undefined (Section 23.2), users are today accidentally getting a reduced‑motion‑equivalent experience (transitions have no effective duration) — but this is incidental, not a designed accessibility feature, and must not be relied upon. When `--transition-base` is given a real value, pair that exact change with a proper `prefers-reduced-motion` rule (Section 23.4) in the same commit, or the accidental accessibility benefit disappears the moment the animation bug is fixed.

### 34.8 Screen reader considerations

Every decorative SVG carries `aria-hidden="true"`; every functionally meaningful icon‑only control has a text alternative via `aria-label`. The notification bell's unread‑count badge is currently a hardcoded visual "3" with no accompanying accessible text (e.g., no `aria-label="3 unread notifications"` was found on it) — flag this as a gap to fix (pair the visual count with an accessible label) when implementing, rather than reproducing the omission.

---

## 35. Reusable Component Inventory

| Component | Purpose | Props / data | Variants | States | Responsive behavior |
|---|---|---|---|---|---|
| **AppShell** | Top‑level authenticated layout: sidebar + topbar + content column + footer | `dir`, `locale`, current route/screen | With‑sidebar (authenticated) vs. bare (would back a future login page, per 31.1) | — | Sidebar mode flips at 960px (Section 8.8) |
| **Sidebar** | Primary navigation | Active route, nav items (icon+label+href per item), logout handler | Mobile drawer / desktop sticky column | Open/closed (mobile), item hover/active | Off‑canvas <960px, sticky column ≥960px |
| **Header** (Topbar) | Identity, locale switch, notifications, current‑program context | User (name, initials, role), locale, program info, activity feed | — | Notif‑panel open/closed | Program‑info‑box and user details progressively hide <767px/<560px; Bismillah scales at 1180/1536 |
| **PageHeader** | Standard per‑page title block | Eyebrow (role label), icon, title, subtitle, optional secondary line, optional actions | With/without secondary subtitle line; with/without eyebrow (Contact's exception) | — | Actions row wraps below title on narrow widths |
| **Breadcrumbs** | Orientation on secondary pages | Array of `{label, onClick?}` segments (last is non‑interactive) | 2‑level (standard) / 3‑level (Day Details) | Link hover | None structural |
| **SectionCard** (`.card`) | Generic content container | Title, optional icon, meta, body, actions | Interactive (hover‑responsive) vs. static | Resting / hover (interactive only) | None structural — stacks full‑width |
| **StatCard** (KPI card) | A labeled number with an icon | Icon, value, label, optional description line, optional progress‑ring % | With/without `__desc` line; with/without progress ring; icon color variant | — | 2‑col <640px, 4‑col ≥640px |
| **TrainingDayCard** (`.day-card`) | One scheduled day, in a list | Date parts, course name, status, meta facts, primary action (conditional), details link | Highlighted (actionable) vs. default date‑block fill | — | Wraps internally on narrow widths; no card‑level breakpoint |
| **CourseCard** (`.program-course-card`) | One course within a program | Icon, name, status, day/hour facts | — | — | Same as TrainingDayCard |
| **StatusBadge** | Status communication, everywhere | Label text, tone (`success/warning/danger/info/neutral`) | 5 tones (4 semantic + neutral default); `--plain` (no dot) | — | None |
| **SearchInput** | Text search with a leading icon | Value, onChange, placeholder, `aria-label` | — | Focus | None structural |
| **FilterBar** (`.status-radio-group`) | Single‑select status filtering | Options array, active value, onChange | — | Checked/unchecked, hover | Wraps onto multiple lines on narrow widths |
| **SortControl** | — | — | — | — | **Not present in the approved design** (Section 17.6) — do not build without new explicit direction |
| **Pagination** | Page navigation for long lists | Current page, total pages, onPrev/onNext | — | Prev/Next disabled at boundaries | Only rendered when >1 page; same layout at all widths |
| **DataTable** | Tabular data display | Columns, rows | — | Row hover | Horizontally scrollable (`.table-scroll`); **defined but unused live** (Section 16.1) |
| **EmptyState** (`.state-view`) | Zero‑results messaging | Icon, title, message, optional single action | Default / `--success` / `--error` tint variants | — | None structural |
| **ErrorState** (`.state-view--error`) | Failure messaging | Icon, title, message | Standalone block vs. tighter inline‑in‑card variant | — | None structural |
| **LoadingSkeleton** | — | — | — | — | **Not present in the approved design** (Section 19.2) — only an inline `Spinner` exists; do not build a skeleton system without new explicit direction |
| **Spinner** | Inline loading indicator | Size (default `1.75rem`, small `1rem` via inline override) | — | Spinning (only state) | None |
| **ConfirmDialog** | — | — | — | — | **No modal/dialog exists** (Section 22) — if built, base it on `.card` + `--shadow-lg` + the sidebar‑scrim backdrop technique, and flag it as new work |
| **SurveyStepper** | One‑question‑per‑step form flow | Questions array, current step, answers, errors, submit state | Question types: choice / rating / text | idle/submitting/success/error; per‑step validation error | Single‑column at all widths |
| **ContactForm** | Real database‑backed contact submission | Name/email/subject/message, validation errors, submit state | — | idle/submitting/success/error | 2‑col name/email row collapses to 1‑col on narrow widths |
| **ProfileFieldList** | Read‑only key/value identity display | Array of `{icon,label,value}` | — | — | 2‑col ≥ mid‑width, 1‑col on phones |
| **HelpQuicklink** | Icon‑tile shortcut to another screen | Icon, label, description, onClick | — | Hover, focus‑visible (custom outline) | 2‑col narrow, 4‑col wide |

---

## 36. Design Tokens

The complete, canonical token file — start any real implementation by dropping this in verbatim, plus the two explicitly‑flagged additions.

```css
:root {
  /* ===== color — brand ===== */
  --color-primary: #153f38;
  --color-primary-hover: #1c5147;
  --color-primary-active: #0e2c27;
  --color-primary-contrast: #ffffff;
  --color-primary-soft: #edf2ee;
  --color-primary-soft-strong: #dae6df;
  --color-accent: #c6a66b;
  --color-accent-hover: #b6935a;
  --color-accent-soft: #f7f4ec;
  --color-accent-soft-strong: #f0e7d8;
  --color-accent-contrast: #2c2007;
  --color-accent-icon: #8a6a37;

  /* ===== color — neutrals / surfaces ===== */
  --color-bg: #f8f6f0;
  --color-bg-raised: #f1ede2;
  --color-surface: #ffffff;
  --color-surface-muted: #f3f0e6;
  --color-border: #e6e0d1;
  --color-border-strong: #d6cdb4;
  --color-text: #24332f;
  --color-text-muted: #5c6b64;
  --color-text-subtle: #8b978e;

  /* ===== color — semantic (defined separately from brand) ===== */
  --color-danger: #a3352a;
  --color-danger-hover: #872c22;
  --color-danger-bg: #f8eae7;
  --color-success: #2f7d54;
  --color-success-bg: #e7f2ea;
  --color-warning-text: #7d5a12;
  --color-warning-bg: #f8efd9;
  --color-info-text: #2b5f8a;
  --color-info-bg: #e7f0f8;
  --focus-ring: #153f38;

  /* ===== spacing ===== */
  --space-1: 0.25rem;  --space-2: 0.5rem;  --space-3: 0.75rem;  --space-4: 1rem;
  --space-5: 1.5rem;   --space-6: 2rem;    --space-7: 2.5rem;   --space-8: 3.5rem;

  /* ===== radius ===== */
  --radius-sm: 8px;
  --radius: 14px;
  --radius-lg: 20px;
  --radius-pill: 999px;   /* NOT in the approved source as a named token — used as a literal throughout; recommend promoting it, see Section 5 */

  /* ===== shadow ===== */
  --shadow-sm: 0 1px 2px rgba(21, 30, 27, 0.06);
  --shadow-md: 0 4px 12px rgba(21, 30, 27, 0.08);
  --shadow-lg: 0 10px 28px rgba(21, 30, 27, 0.12);

  /* ===== layout ===== */
  --sidebar-width: 17rem;
  --topbar-height: 4.25rem;
  --content-max-width: 52rem;

  /* ===== typography ===== */
  --font-family-latin: system-ui, -apple-system, "Segoe UI", Tahoma, Arial, sans-serif;
  --font-family-arabic: "Tajawal", "Segoe UI", Tahoma, Arial, sans-serif;
  --font-latin: var(--font-family-latin);
  --font-arabic: var(--font-family-arabic);

  /* ===== transitions ===== */
  --transition-base: 160ms ease;   /* NOT PRESENT in the approved source — required fix, see Section 23.2 */

  /* ===== z-index scale (collected from live usage; not centralized as tokens in the source — recommend tokenizing) ===== */
  --z-decor: 0;         /* sidebar decorative illustration base layer */
  --z-content: 1;       /* content sitting above a decorative watermark (sidebar content, profile-card identity block) */
  --z-auth-chip: 5;     /* unused Auth page's language-switch chip over its hero overlay */
  --z-topbar: 20;       /* sticky app topbar */
  --z-scrim: 29;        /* mobile sidebar backdrop */
  --z-sidebar: 30;      /* mobile off-canvas sidebar drawer */
  --z-dropdown: 40;     /* notification panel */
  --z-skip-link: 100;   /* skip-to-content link, always topmost */
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-bg: #0f1613; --color-bg-raised: #141f1a; --color-surface: #17221d; --color-surface-muted: #1b2822;
    --color-border: #293a32; --color-border-strong: #384c42;
    --color-text: #f1eee3; --color-text-muted: #a9b6ae; --color-text-subtle: #778a80;
    --color-primary: #5fbba0; --color-primary-hover: #7bcbb2; --color-primary-active: #97d8c2; --color-primary-contrast: #06231c;
    --color-primary-soft: #17332c; --color-primary-soft-strong: #1e4038;
    --color-accent: #d9b679; --color-accent-hover: #e5c793; --color-accent-soft: #2e2818; --color-accent-soft-strong: #3c331f;
    --color-accent-contrast: #2c2007; --color-accent-icon: #d9b679;
    --color-danger: #ff8c82; --color-danger-hover: #ffa79f; --color-danger-bg: #3a1d1a;
    --color-success: #7fdba6; --color-success-bg: #123424;
    --color-warning-text: #f0cc7e; --color-warning-bg: #362b10;
    --focus-ring: #5fbba0; --color-info-text: #8fc1e8; --color-info-bg: #16283a;
    --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.35);
    --shadow-md: 0 4px 14px rgba(0, 0, 0, 0.4);
    --shadow-lg: 0 12px 32px rgba(0, 0, 0, 0.5);
  }
}

/* Recommended, not present in source: */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### 36.1 Breakpoints, as tokens (for a real build's variable/media‑query system — not literal CSS custom properties in the approved source, since native CSS can't use custom properties inside `@media`, but list them centrally in your build tooling, e.g. Sass variables or a JS breakpoints object)

```
bp-xs:   420px
bp-sm:   560px
bp-md:   640px
bp-tablet-range: 641px – 959px
bp-lg-a: 767px
bp-lg-b: 860px
bp-lg-c: 900px
bp-sidebar: 960px   /* the one structural breakpoint */
bp-xl-a: 1180px
bp-xl-range: 1180px – 1535.98px
bp-xl-b: 1280px
```

---

## 37. Implementation Notes for Claude Code

### 37.1 Visual source of truth

The three files named at the top of this document (`tokens.css`, `bundle.css`, the prototype's markup/style/script) — **and this document's transcription of them** — are the visual source of truth. Nothing about "what the approved Nour Al‑Qiyadah design looks like" should be inferred from generic best practices, a different design system, or assumption; if a question isn't answered by this document, treat it as an open gap to flag, not a blank to fill in from general design instinct.

### 37.2 What must be preserved exactly

- Every hex value in Section 2/36, both light and dark mode.
- Every spacing/radius/shadow token and its specific application (Sections 4–6).
- The exact welcome‑banner hero mechanics (Section 24.2) — this component has an extensive, deliberate iteration history (mirrored image, section‑level gradient, mask‑based blend, non‑reversed title row); do not "simplify" or "clean up" any part of it.
- The exact status→badge tone mapping (Section 13.2) and the copy‑reuse discipline behind it.
- The exact RTL exception list (Section 32.5) — no more, no fewer exceptions than documented.
- The exact idle→submitting→success→error contract for both real forms (Contact, Survey — Sections 15.6, 27.5).
- The single‑source status‑derivation logic for training days (25.3) and the course/program totals partition (26.3).
- The card‑list (not table) pattern for every trainee list screen (16.2).

### 37.3 What must not be changed

- Do not "fix" the deliberately non‑reversed welcome‑banner title row, the fixed‑physical Upcoming‑Session layout, or the unused Auth page's fixed‑corner language switch — these are documented, intentional exceptions to the general mirroring rule, not bugs.
- Do not add features this document explicitly flags as absent: Supervisor/Trainer dashboards, a modal/dialog system, sorting UI, numbered pagination, toast notifications, skeleton loaders, page‑transition animation, live‑results counters, or Evaluation/Report/Attendance status badges (Sections 13.3, 17.3/17.6, 19.2, 22, 23.3, 28, 29).
- Do not invent copy for the Login/Forgot/Reset‑Password screens, the Privacy/Terms legal body text, or the survey question bank — all three are explicitly documented as either absent or placeholder (Sections 27.7, 31, and the `legalPlaceholderNotice` string).
- Do not fabricate organization contact details (email/phone/address/hours) on the Contact page — the approved design deliberately shows an explicit "not available" state for each because no real value has been supplied; preserve the `hasX`/`noX` conditional branching, don't collapse it into an always‑populated field.

### 37.4 Reusable‑component expectations

Build from Section 35's inventory. Every screen in this specification is describable as a composition of that inventory — none require bespoke, undocumented one‑off layout. Extract the shared primitives (Button, Field, Card, Badge, PageHeader, StateView, Spinner, AppShell/Topbar/Sidebar, DataTable) as real, parameterized components before building product‑specific ones (WelcomeBanner, DayCard, ProfileSummaryCard, etc.) on top of them — this mirrors the approved design's own three‑layer CSS architecture (tokens → shared components → route‑specific) and should be mirrored in component architecture too.

### 37.5 RTL/LTR requirements

Implement logical properties by default (Section 32.2); implement every explicit override in the checklist (Section 32.3/32.4) without exception; implement the `.fixed-ltr`/reversal exception list exactly as enumerated (32.5), extending it to nothing else without new, explicit instruction. Test every screen in both languages at every breakpoint — several of this system's real, documented bugs (the sidebar specificity collision, in particular) only manifested in one language, meaning LTR‑only or RTL‑only testing is not sufficient verification.

### 37.6 Responsive requirements

Implement every breakpoint in Section 33.1's inventory at its documented value; treat `960px` as the one structural (sidebar‑mode) threshold and everything else as refinement. Verify grid column counts against Section 33.3 at each of the reference widths in 33.2.

### 37.7 No mock data

Every number, label, and status in this specification is described as **derived from a data model**, not a hardcoded literal (Section 1.7's architecture note, repeated here because it matters for implementation): the greeting's first name, every stat value, every badge's status, every progress ring's percentage. When implementing against a real backend, bind these to real API/store values using the same derivation logic documented per screen (e.g., 25.3, 26.3) — never leave a placeholder number "for now" in a way that could ship. The one exception, explicitly flagged as such wherever it appears, is the Survey wizard's placeholder question bank (27.7) and the Privacy/Terms placeholder legal text — both are documented, visible‑to‑the‑user placeholders, not silent mock data, and should be replaced with real content rather than treated as permanent.

### 37.8 No business‑logic duplication

The status‑derivation rules (25.3, 26.3), the validation rules (15.9, 27.4), and the submission state machine (15.6) are business logic, not merely visual patterns — implement them once (e.g., in a shared service/hook/selector layer) and have every screen that needs them (Dashboard, Days, Surveys, Program) consume the same single implementation, exactly as the prototype's single `renderVals()` derives every screen's view‑model from the same underlying data arrays. Do not let each screen re‑derive "is this the next day" or "is this course complete" independently.

### 37.9 No backend redesign

This document is a **visual and interaction** specification. It says nothing about API shapes, database schemas, or backend architecture, and nothing in it should be read as a request to redesign how data is stored or served — the `getDb()`/shared‑database‑write pattern described for the Contact form and Survey submission (Section 15.6) is an artifact‑platform‑specific implementation detail of this specific prototype sandbox, not a backend architecture to replicate; a real implementation should use its own real backend/API for these same submissions while preserving the same *front‑end* state‑machine contract (idle/submitting/success/error) documented here.

### 37.10 How to validate visual fidelity

1. **Token‑level check:** confirm every color/spacing/radius/shadow value in the implementation matches Section 36's token file exactly (a simple diff against the token values, not a visual eyeball check, catches most drift).
2. **Component‑level check:** for each entry in Section 35's inventory, verify its states (hover/active/focus/disabled/checked as applicable) against the specific CSS rules quoted in Sections 12–15.
3. **Screen‑level check:** for each screen (Sections 24–31), verify section order, and cross‑check any data‑integrity rule called out (25.3, 26.3) actually holds against real data, not just against the prototype's specific numbers.
4. **RTL/LTR check:** load every screen in both languages; specifically re‑verify every item in the Section 32.3 checklist and the Section 32.5 exception list, since these are exactly the spots this system has previously had real, shipped bugs.
5. **Responsive check:** resize through every breakpoint in Section 33.1, cross‑checking grid column counts against 33.3 at each of the six reference widths in 33.2.
6. **Gap check:** confirm nothing from Section 37.3's "must not add" list has been added, and confirm every explicitly‑flagged gap (`--transition-base`, `prefers-reduced-motion`, the notification badge's missing accessible label, the unimplemented Login screen) is either fixed as recommended or knowingly deferred — not silently left broken and unremarked.
