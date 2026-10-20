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
  OperationalRole,
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

/**
 * Per-action actionability, used by the Training Days 3-way status
 * filter ("Upcoming / Open for Evaluation / Closed"). Deliberately NOT
 * the same thing as `DayGroup` below: `DayGroup` is a dumb reading of
 * the raw `TrainingDayStatus` enum (used only for the summary tiles'
 * total/completed/upcoming counts), while this is about whether the
 * ROLE'S OWN ACTION on a day can be acted on right now, derived from
 * the same `can_submit`/`response.state` fields the card's button
 * already uses. A day can be `state: "open"` and still read as
 * "upcoming" here (window not started) or "closed" here (window
 * already passed, or already submitted) -- seeING project
 * REQUIREMENTS_ALIGNMENT.md has no source defining this split either,
 * so this is a presentation-only derivation, never a new business rule.
 */
export type ActionWindowState =
  | "not_configured"
  | "not_yet_open"
  | "actionable"
  | "submitted"
  | "missed";

export type ActionAvailabilityGroup = "upcoming" | "openForEvaluation" | "closed";
export const ACTION_AVAILABILITY_GROUPS: ActionAvailabilityGroup[] = [
  "upcoming",
  "openForEvaluation",
  "closed",
];

const DAY_CLOSED_LIKE: TrainingDayStatus[] = ["closed", "postponed", "cancelled"];

/** Whether a training day's own lifecycle state is "locked" (closed,
 * postponed or cancelled) -- shared by the day-card action logic and
 * any per-day action page that needs to decide read-only vs editable
 * purely from the day's real state, without re-deriving the list. */
export function isDayClosedLike(status: TrainingDayStatus): boolean {
  return DAY_CLOSED_LIKE.includes(status);
}

/** Whether a single role action (survey / report / attendance) can be
 * acted on right now, has already been finally completed, or is
 * unreachable because its window hasn't started yet or has already
 * passed -- entirely from fields the API already returns:
 * `availability.configured` / `can_submit` / `response.state`, the
 * day's own `state`, and (for the "open day but window already
 * expired" case, which `state` alone cannot distinguish from "window
 * not started yet") the day's `survey_open_at`/`survey_close_at`
 * datetimes (shared by the trainee survey, supervisor survey and
 * trainer report -- all three gate on the same day-level window via
 * `check_survey_access`). No field is invented and no date is
 * hardcoded: "now" is compared against the server-returned window. */
export function actionWindowStateOf(
  entry: Pick<DashboardEntryDto, "state" | "survey_open_at" | "survey_close_at">,
  availability: SurveyAvailabilityDto | null | undefined,
): ActionWindowState {
  if (!availability || !availability.configured) return "not_configured";
  if (availability.response?.state === "submitted") return "submitted";
  if (availability.can_submit) return "actionable";

  if (DAY_CLOSED_LIKE.includes(entry.state)) return "missed";
  if (entry.state === "planned") return "not_yet_open";

  // entry.state === "open" but not actionable and not submitted: only
  // the window's own timing can tell "not started yet" from "already
  // expired" apart.
  const now = Date.now();
  const opensAt = entry.survey_open_at ? Date.parse(entry.survey_open_at) : NaN;
  const closesAt = entry.survey_close_at ? Date.parse(entry.survey_close_at) : NaN;
  if (!Number.isNaN(closesAt) && now > closesAt) return "missed";
  if (!Number.isNaN(opensAt) && now < opensAt) return "not_yet_open";
  return "not_yet_open";
}

function groupFromWindowStates(states: ActionWindowState[]): ActionAvailabilityGroup {
  if (states.includes("actionable")) return "openForEvaluation";
  if (states.includes("submitted") || states.includes("missed")) return "closed";
  return "upcoming";
}

/** Single-action roles (trainee survey, trainer report). */
export function actionAvailabilityGroupOf(
  entry: DashboardEntryDto,
  kind: AvailabilityKind,
): ActionAvailabilityGroup {
  if (DAY_CLOSED_LIKE.includes(entry.state)) return "closed";
  return groupFromWindowStates([actionWindowStateOf(entry, availabilityOf(entry, kind))]);
}

/** Supervisor has two actions on the same day (attendance + evaluation
 * survey); the day reads as "Open for Evaluation" when EITHER is still
 * actionable, "Closed" once the day itself is closed/postponed/
 * cancelled or nothing is left to do, "Upcoming" otherwise. Attendance
 * has no time window of its own (only the day-state gate the backend
 * now also enforces -- see training_day.py), so it is "actionable" as
 * soon as the day is open and recording isn't complete yet. */
export function supervisorActionAvailabilityGroupOf(entry: DashboardEntryDto): ActionAvailabilityGroup {
  if (DAY_CLOSED_LIKE.includes(entry.state)) return "closed";

  const surveyState = actionWindowStateOf(entry, entry.survey);
  const attendance = entry.attendance;
  const attendanceState: ActionWindowState = !attendance
    ? "not_configured"
    : attendance.complete
      ? "submitted"
      : entry.state === "planned"
        ? "not_yet_open"
        : "actionable";

  return groupFromWindowStates([surveyState, attendanceState]);
}

/** Simplified two-way reading of the day-status enum for lighter list UIs
 * (e.g. the trainee days page's All / Upcoming / Completed segmented
 * control): "closed" reads as completed, "planned"/"open" read as
 * upcoming. No new business rule -- this only groups the existing
 * `TrainingDayStatus` values for presentation (see
 * docs/REQUIREMENTS_ALIGNMENT.md; no source defines this split
 * explicitly, so this is the simplest reading consistent with the
 * enum). A postponed/cancelled day belongs to neither group, but still
 * shows under "All". */
export type DayGroup = "upcoming" | "completed";
export const DAY_GROUPS: DayGroup[] = ["upcoming", "completed"];

export function dayGroupOf(status: TrainingDayStatus): DayGroup | null {
  if (status === "closed") return "completed";
  if (status === "planned" || status === "open") return "upcoming";
  return null;
}

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
  /** The 3-way "Upcoming / Open for Evaluation / Closed" actionability
   * filter (see `actionAvailabilityGroupOf`/`supervisorActionAvailabilityGroupOf`
   * above); independent of `dayStatus` so the two filters never fight
   * over the same URL param. Replaces the earlier, simpler all/
   * upcoming/completed segmented control that only read `dayGroupOf` --
   * that control is gone from the unified Training Days toolbar, but
   * `dayGroupOf` itself lives on unchanged for the summary tiles. */
  availability: ActionAvailabilityGroup | "";
}

/** Toolbar filters that can be shown or hidden per role. `search` and
 * Sort are generic to every role and always available. */
export type FilterKey =
  | "course"
  | "program"
  | "dayStatus"
  | "availability"
  | "responseStatus"
  | "attendance"
  | "dateRange";

export type FilterVisibility = Record<FilterKey, boolean>;

/** Which filters each role may see -- derived from what that role can
 * actually act on (PROJECT_SPEC 7: the trainee only views assigned days
 * and submits the daily survey; the supervisor records attendance and
 * evaluates; the trainer submits the daily report). The BRD/SRS do not
 * enumerate per-role filters, so this is the narrowest reading of those
 * responsibilities:
 *  - "Evaluation Status" (`availability`) is the supervisor's evaluation
 *    concept, so trainees and trainers do not get it (their own
 *    Survey/Report Status filter already covers "can I act on this").
 *  - "Attendance" is recorded by the supervisor alone.
 * Display-layer only: the API already scopes the days each role receives,
 * and Odoo remains the authority on permissions. */
export const FILTER_VISIBILITY: Record<OperationalRole, FilterVisibility> = {
  trainee: {
    course: true,
    program: true,
    dayStatus: true,
    availability: false,
    responseStatus: true,
    attendance: false,
    dateRange: true,
  },
  trainer: {
    course: true,
    program: true,
    dayStatus: true,
    availability: false,
    responseStatus: true,
    attendance: false,
    dateRange: true,
  },
  supervisor: {
    course: true,
    program: true,
    dayStatus: true,
    availability: true,
    responseStatus: true,
    attendance: true,
    dateRange: true,
  },
};

/** Without a role (unit tests, legacy callers) nothing is restricted. */
export const ALL_FILTERS_VISIBLE: FilterVisibility = {
  course: true,
  program: true,
  dayStatus: true,
  availability: true,
  responseStatus: true,
  attendance: true,
  dateRange: true,
};

export function filterVisibilityFor(role?: OperationalRole | null): FilterVisibility {
  return role ? FILTER_VISIBILITY[role] : ALL_FILTERS_VISIBLE;
}

/** Blanks every filter the viewer may not use, so a stale/hand-edited URL
 * param for a hidden filter can never narrow the results or show a chip. */
export function maskHiddenFilters(filters: ListFilters, visible: FilterVisibility): ListFilters {
  return {
    ...filters,
    course: visible.course ? filters.course : "",
    program: visible.program ? filters.program : "",
    dayStatus: visible.dayStatus ? filters.dayStatus : "",
    availability: visible.availability ? filters.availability : "",
    responseStatus: visible.responseStatus ? filters.responseStatus : "",
    attendance: visible.attendance ? filters.attendance : "",
    dateFrom: visible.dateRange ? filters.dateFrom : "",
    dateTo: visible.dateRange ? filters.dateTo : "",
  };
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
  availability: "",
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
  /** Role-specific actionability grouping for the `availability` filter;
   * defaults to `actionAvailabilityGroupOf(entry, kind)`. Supervisor
   * lists pass `supervisorActionAvailabilityGroupOf` instead, since a
   * supervisor's day has two actions (attendance + survey). */
  groupOf?: (entry: DashboardEntryDto) => ActionAvailabilityGroup;
  /** Calendar view (see `ViewMode` in useListControls.ts) replaces the
   * date-range mechanism with its own month-level navigation (point 8 of
   * the Training Days toolbar refinement): `filters.dateFrom`/`dateTo`
   * stay set in the URL/state so Cards view shows them again unchanged,
   * but while this is true the predicate below is skipped so the range
   * never narrows what the calendar shows. */
  skipDateRange?: boolean;
}

function matchesQuery(entry: DashboardEntryDto, tokens: string[], locale: string): boolean {
  const haystack = normalizeSearchText(
    [
      entry.course_name,
      entry.program_name,
      // The day's own topic (training.day.topic), when the backend sets
      // one -- null/unset must not break the match, hence `?? ""`. Kept
      // alongside course/program/date rather than replacing them: the
      // search placeholder now promises "training day or topic", not a
      // narrower match.
      entry.topic ?? "",
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
  { locale, kind = "survey", groupOf, skipDateRange = false }: ListContext,
): DashboardEntryDto[] {
  const resolveGroup = groupOf ?? ((entry: DashboardEntryDto) => actionAvailabilityGroupOf(entry, kind));
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
    if (!skipDateRange && (filters.dateFrom || filters.dateTo)) {
      if (!entry.date) return false;
      if (filters.dateFrom && entry.date < filters.dateFrom) return false;
      if (filters.dateTo && entry.date > filters.dateTo) return false;
    }
    if (filters.attendance) {
      const complete = !!entry.attendance?.complete;
      if (filters.attendance === "complete" ? !complete : complete) return false;
    }
    if (filters.availability && resolveGroup(entry) !== filters.availability) return false;
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

/**
 * Computed, display-only "Day N" ordinal for each training day (Training
 * Days card title): this day's 1-based position among every day
 * belonging to the same `program_id` -- NOT scoped to the day's own
 * `course_id`; a program spans several courses, and the ordinal must
 * read as "day N of the program", not "day N of this course" (corrected
 * by the project owner after an earlier, course-scoped version of this
 * derivation) -- ordered by `date` ascending (a day with no `date` sorts
 * after every dated day of its program, consistent with `compareDates`
 * above; ties -- including two undated days -- break on
 * `training_day_id` ascending for a deterministic order). No "day
 * number" field exists anywhere in the schema and none is being added:
 * this is purely a client-side presentation sequence derived from the
 * already-fetched `days` array (no new API call), NOT authoritative
 * data -- it must never be read as a real sequence number, only as a
 * stable, human-friendly ordinal for display.
 */
export function dayNumbersByProgram(days: DashboardEntryDto[]): Map<number, number> {
  const byProgram = new Map<number, DashboardEntryDto[]>();
  for (const day of days) {
    const list = byProgram.get(day.program_id);
    if (list) list.push(day);
    else byProgram.set(day.program_id, [day]);
  }
  const result = new Map<number, number>();
  for (const list of byProgram.values()) {
    const ordered = [...list].sort((a, b) => {
      if (a.date !== b.date) {
        if (!a.date) return 1;
        if (!b.date) return -1;
        return a.date < b.date ? -1 : 1;
      }
      return a.training_day_id - b.training_day_id;
    });
    ordered.forEach((day, index) => result.set(day.training_day_id, index + 1));
  }
  return result;
}
