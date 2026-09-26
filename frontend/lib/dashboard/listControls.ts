/**
 * Pure, client-side list helpers for the training-day list pages.
 *
 * The Operational API returns every visible day for the user in one call
 * (date desc) and has no search / filter / sort / pagination parameters,
 * so all of this runs over the already-loaded `DashboardEntryDto[]`. It
 * only reads fields the API already returns; no business rule lives here.
 */
import { formatDate } from "@/lib/dashboard/format";
import type {
  DashboardEntryDto,
  SurveyAvailabilityDto,
  TrainingDayStatus,
} from "@/lib/api/types";

/** The toolbar is hidden on lists shorter than this: no value on tiny lists. */
export const TOOLBAR_MIN_ENTRIES = 6;

export const PAGE_SIZE_OPTIONS = [12, 24, 48];
export const DEFAULT_PAGE_SIZE = PAGE_SIZE_OPTIONS[0];

export type AvailabilityKind = "survey" | "report";

export const DAY_STATUS_ORDER: TrainingDayStatus[] = [
  "planned",
  "open",
  "closed",
  "postponed",
  "cancelled",
];

export type ResponseStatus = "not_configured" | "not_started" | "in_progress" | "submitted";
export const RESPONSE_STATUSES: ResponseStatus[] = [
  "not_started",
  "in_progress",
  "submitted",
  "not_configured",
];

export type AttendanceFilter = "complete" | "pending";
export const ATTENDANCE_FILTERS: AttendanceFilter[] = ["complete", "pending"];

export type SortKey = "dateDesc" | "dateAsc" | "status" | "course";
export const SORT_KEYS: SortKey[] = ["dateDesc", "dateAsc", "status", "course"];
export const DEFAULT_SORT: SortKey = "dateDesc";

export interface ListFilters {
  q: string;
  dayStatus: TrainingDayStatus | "";
  responseStatus: ResponseStatus | "";
  /** course_id as a string. */
  course: string;
  /** program_id as a string. */
  program: string;
  /** Inclusive ISO dates (YYYY-MM-DD). */
  dateFrom: string;
  dateTo: string;
  attendance: AttendanceFilter | "";
}

export const EMPTY_FILTERS: ListFilters = {
  q: "",
  dayStatus: "",
  responseStatus: "",
  course: "",
  program: "",
  dateFrom: "",
  dateTo: "",
  attendance: "",
};

/** Not-configured / not-started / in-progress / submitted, as the badge shows it. */
export function responseStatusOf(availability?: SurveyAvailabilityDto | null): ResponseStatus {
  if (!availability?.configured) return "not_configured";
  return availability.response?.state ?? "not_started";
}

export function availabilityOf(
  entry: DashboardEntryDto,
  kind: AvailabilityKind,
): SurveyAvailabilityDto | undefined {
  return kind === "report" ? entry.trainer_report : entry.survey;
}

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** Forgiving comparison form: lower-case, no diacritics/tashkeel/tatweel,
 * alef / ya / ta-marbuta variants unified, Arabic-Indic digits to Latin,
 * whitespace collapsed. Applied to both the query and the haystack. */
export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ـ/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)))
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export interface ListContext {
  locale: string;
  kind?: AvailabilityKind;
}

function matchesQuery(entry: DashboardEntryDto, tokens: string[], locale: string): boolean {
  const haystack = normalizeSearchText(
    [
      entry.course_name,
      entry.program_name,
      entry.date ? formatDate(entry.date, locale) : "",
      entry.date ?? "",
    ].join(" "),
  );
  return tokens.every((token) => haystack.includes(token));
}

/** Every provided filter must match (AND). Empty / missing values are ignored. */
export function filterEntries(
  entries: DashboardEntryDto[],
  filters: Partial<ListFilters>,
  { locale, kind = "survey" }: ListContext,
): DashboardEntryDto[] {
  const q = normalizeSearchText(filters.q ?? "");
  const tokens = q ? q.split(" ") : [];
  return entries.filter((entry) => {
    if (tokens.length && !matchesQuery(entry, tokens, locale)) return false;
    if (filters.dayStatus && entry.state !== filters.dayStatus) return false;
    if (
      filters.responseStatus &&
      responseStatusOf(availabilityOf(entry, kind)) !== filters.responseStatus
    ) {
      return false;
    }
    if (filters.course && String(entry.course_id) !== filters.course) return false;
    if (filters.program && String(entry.program_id) !== filters.program) return false;
    if (filters.dateFrom || filters.dateTo) {
      if (!entry.date) return false;
      if (filters.dateFrom && entry.date < filters.dateFrom) return false;
      if (filters.dateTo && entry.date > filters.dateTo) return false;
    }
    if (filters.attendance) {
      const complete = !!entry.attendance?.complete;
      if (filters.attendance === "complete" ? !complete : complete) return false;
    }
    return true;
  });
}

function compareDates(a: string | null, b: string | null, direction: 1 | -1): number {
  // Missing dates always sort last, whichever the direction.
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a < b ? -direction : a > b ? direction : 0;
}

/** Stable sort on a copy; ties keep the incoming (API) order. */
export function sortEntries(
  entries: DashboardEntryDto[],
  sortKey: SortKey,
  locale = "en",
): DashboardEntryDto[] {
  const copy = [...entries];
  switch (sortKey) {
    case "dateAsc":
      return copy.sort((a, b) => compareDates(a.date, b.date, 1));
    case "status":
      return copy.sort(
        (a, b) => DAY_STATUS_ORDER.indexOf(a.state) - DAY_STATUS_ORDER.indexOf(b.state),
      );
    case "course": {
      const collator = new Intl.Collator(locale, { sensitivity: "base", numeric: true });
      return copy.sort((a, b) => collator.compare(a.course_name, b.course_name));
    }
    case "dateDesc":
    default:
      return copy.sort((a, b) => compareDates(a.date, b.date, -1));
  }
}

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterOptions {
  courses: FilterOption[];
  /** Empty unless the list spans more than one program. */
  programs: FilterOption[];
}

function distinct(entries: DashboardEntryDto[], id: "course_id" | "program_id", name: "course_name" | "program_name") {
  const map = new Map<number, string>();
  for (const e of entries) if (!map.has(e[id])) map.set(e[id], e[name]);
  return [...map].map(([value, label]) => ({ value: String(value), label }));
}

export function deriveFilterOptions(entries: DashboardEntryDto[], locale = "en"): FilterOptions {
  const collator = new Intl.Collator(locale, { sensitivity: "base", numeric: true });
  const byLabel = (a: FilterOption, b: FilterOption) => collator.compare(a.label, b.label);
  const programs = distinct(entries, "program_id", "program_name").sort(byLabel);
  return {
    courses: distinct(entries, "course_id", "course_name").sort(byLabel),
    programs: programs.length > 1 ? programs : [],
  };
}

export function shouldShowToolbar(totalEntries: number): boolean {
  return totalEntries >= TOOLBAR_MIN_ENTRIES;
}

export function pageCountOf(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}
