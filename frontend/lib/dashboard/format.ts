/**
 * Locale-aware date/time formatting for the dashboard's welcome/
 * next-session blocks. training.day's `date`/`start_datetime`/
 * `end_datetime` are plain calendar/UTC values from Odoo (see
 * lib/api/types.ts). Calendar dates (`date`, program start/end) have no
 * time-of-day and are always formatted as `timeZone: "UTC"` so they
 * never shift a day. Datetimes (`formatTimeRange`) are UTC instants and
 * are shown in the user's own IANA zone (PROJECT_SPEC section 10,
 * `profile.tz`), falling back to the browser's zone when it is unset.
 *
 * Arabic UI copy in this project uses Western (Latin) digits (see the
 * approved login/dashboard references: "23", "2026", never Eastern
 * Arabic-Indic numerals) -- "-u-nu-latn" pins that regardless of the
 * visitor's OS locale settings.
 */
function intlLocale(locale: string): string {
  return locale === "ar" ? "ar-u-nu-latn" : "en";
}

/** An IANA zone Intl accepts, else undefined (= the browser's zone). A
 * stale/invalid stored zone must degrade, not throw a RangeError. */
function validTimeZone(timeZone?: string | null): string | undefined {
  if (!timeZone) return undefined;
  try {
    new Intl.DateTimeFormat("en", { timeZone });
    return timeZone;
  } catch {
    return undefined;
  }
}

export interface SessionDateParts {
  day: string;
  monthYear: string;
  weekday: string;
}

export function formatSessionDateParts(
  dateStr: string | null,
  locale: string,
): SessionDateParts | null {
  if (!dateStr) return null;
  const date = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  const loc = intlLocale(locale);
  return {
    day: new Intl.DateTimeFormat(loc, { day: "numeric", timeZone: "UTC" }).format(date),
    monthYear: new Intl.DateTimeFormat(loc, {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(date),
    weekday: new Intl.DateTimeFormat(loc, { weekday: "long", timeZone: "UTC" }).format(date),
  };
}

/** A translate function shaped like next-intl's `t` for the "Dashboard"
 * namespace (callers pass their own `useTranslations("Dashboard")`
 * result directly), used only to join the already-formatted start/end
 * times below via the `timeRange` message key. Typed narrowly to just
 * that one key (rather than next-intl's full, namespace-specific key
 * union) so this pure module stays decoupled from the generated
 * Messages type and the real, more strictly-typed translator is still
 * assignable here. */
type TimeRangeTranslator = (key: "timeRange", values: { start: string; end: string }) => string;

/**
 * Two LTR numeric tokens ("12:00", "16:00") joined by a bare dash
 * inside RTL (Arabic) text get bidi-reordered by the browser -- the
 * visual order of the pair can flip (end time appears to read first),
 * which is confusing. Composing the final string via the `Dashboard.
 * timeRange` message (see messages/ar.json/en.json) rather than string
 * concatenation fixes this: the Arabic template wraps the two times in
 * explicit "من ... إلى ..." wording, which anchors the reading order
 * regardless of digit direction. English keeps its existing concise
 * dash join (no bidi ambiguity in an LTR sentence), via the same key's
 * English template -- so this function never branches on locale
 * itself, only the message content differs per locale file.
 */
export function formatTimeRange(
  startStr: string | null,
  endStr: string | null,
  locale: string,
  timeZone: string | null | undefined,
  t: TimeRangeTranslator,
): string | null {
  if (!startStr || !endStr) return null;
  const fmt = new Intl.DateTimeFormat(intlLocale(locale), {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: validTimeZone(timeZone),
  });
  const toDate = (value: string) => new Date(`${value.replace(" ", "T")}Z`);
  const start = fmt.format(toDate(startStr));
  const end = fmt.format(toDate(endStr));
  return t("timeRange", { start, end });
}

export function formatProgramRange(
  startDate: string,
  endDate: string,
  locale: string,
): string {
  const fmt = new Intl.DateTimeFormat(intlLocale(locale), {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  const toDate = (value: string) => new Date(`${value}T00:00:00Z`);
  return `${fmt.format(toDate(startDate))} – ${fmt.format(toDate(endDate))}`;
}

/** A single Odoo calendar date ("YYYY-MM-DD") in the UI locale (UTC, so
 * it never shifts a day). Falls back to the raw value if unparseable. */
export function formatDate(dateStr: string, locale: string): string {
  const date = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return dateStr;
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** Short weekday labels (Sun..Sat) for the Training Days calendar grid,
 * in the UI locale -- e.g. "Sun, Mon, ..." / "الأحد، الاثنين، ...". Sunday
 * is used as the first column for both locales (no source specifies a
 * different first-day-of-week convention; this is presentation only). */
export function weekdayShortNames(locale: string): string[] {
  const fmt = new Intl.DateTimeFormat(intlLocale(locale), { weekday: "short", timeZone: "UTC" });
  // 2023-01-01 was a Sunday (UTC); any confirmed Sunday works as the anchor.
  return Array.from({ length: 7 }, (_, i) =>
    fmt.format(new Date(Date.UTC(2023, 0, 1 + i))),
  );
}

/** Full weekday names (Sunday..Saturday) in the UI locale, for the
 * Training Days calendar day buttons' accessible names (see
 * `calendarDayWithCountAndWeekday` in messages/*.json) -- the visible
 * weekday header row is `aria-hidden`, so each day button announces its
 * own weekday instead of relying on grid-row/column position alone.
 * Same Sunday-first convention and UTC anchor date as
 * `weekdayShortNames` above. */
export function weekdayLongNames(locale: string): string[] {
  const fmt = new Intl.DateTimeFormat(intlLocale(locale), { weekday: "long", timeZone: "UTC" });
  return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(Date.UTC(2023, 0, 1 + i))));
}

/** Full month names (January..December) in the UI locale, for the
 * Training Days calendar's month-jump select (point 5 of the Training
 * Days toolbar refinement). */
export function monthLongNames(locale: string): string[] {
  const fmt = new Intl.DateTimeFormat(intlLocale(locale), { month: "long", timeZone: "UTC" });
  return Array.from({ length: 12 }, (_, i) => fmt.format(new Date(Date.UTC(2023, i, 1))));
}

/** An Odoo UTC datetime ("YYYY-MM-DD HH:MM:SS", or an ISO string) shown
 * in the user's own IANA zone (profile.tz, browser zone when unset). */
export function formatDateTime(
  value: string,
  locale: string,
  timeZone?: string | null,
): string {
  const normalized = /[zZ]|[+-]\d\d:?\d\d$/.test(value)
    ? value
    : `${value.replace(" ", "T")}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: validTimeZone(timeZone),
  }).format(date);
}
