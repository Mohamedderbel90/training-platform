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

export function formatTimeRange(
  startStr: string | null,
  endStr: string | null,
  locale: string,
  timeZone?: string | null,
): string | null {
  if (!startStr || !endStr) return null;
  const fmt = new Intl.DateTimeFormat(intlLocale(locale), {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: validTimeZone(timeZone),
  });
  const toDate = (value: string) => new Date(`${value.replace(" ", "T")}Z`);
  return `${fmt.format(toDate(startStr))} – ${fmt.format(toDate(endStr))}`;
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
