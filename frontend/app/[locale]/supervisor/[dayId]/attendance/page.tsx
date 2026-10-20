"use client";

import { use, useCallback, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";
import { useAuth } from "@/lib/auth/AuthContext";
import { dashboardApi, supervisorApi, type AttendanceUpsertItem } from "@/lib/api/endpoints";
import { ApiError } from "@/lib/api/client";
import { useApiResource } from "@/lib/api/useApiResource";
import { EmptyState } from "@/components/StateViews";
import { FilterBar, type ActiveFilter } from "@/components/FilterBar";
import { SearchInput } from "@/components/SearchInput";
import { SkeletonRows } from "@/components/Skeleton";
import { SortControl } from "@/components/SortControl";
import { ApiErrorView } from "@/components/ApiErrorView";
import { FormError } from "@/components/FormError";
import { LiveStatus } from "@/components/LiveStatus";
import { SubmitButton } from "@/components/SubmitButton";
import { PageHeader } from "@/components/PageHeader";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useLeaveGuard } from "@/lib/useLeaveGuard";
import { LockIcon } from "@/components/icons";
import { DayContextHeader } from "@/components/dashboard/DayContextHeader";
import { isDayClosedLike, normalizeSearchText, shouldShowToolbar } from "@/lib/dashboard/listControls";
import type { AttendanceStatus } from "@/lib/api/types";

const STATUSES: AttendanceStatus[] = ["present", "absent", "late"];

/** Display-only view filter. "not_recorded" means the server has no
 * attendance record yet for that trainee. */
type ViewFilter = AttendanceStatus | "not_recorded";

/** Local editable row. `status` is null until the supervisor explicitly
 * picks one (DEC-05): an unrecorded trainee is never pre-selected, and
 * only rows with a chosen status are sent on save. */
type Row = Omit<AttendanceUpsertItem, "status"> & { status: AttendanceStatus | null };
const VIEW_FILTERS: ViewFilter[] = [...STATUSES, "not_recorded"];

export function AttendanceContent({ dayId }: { dayId: number }) {
  const t = useTranslations("Attendance");
  const locale = useLocale();
  const l = useTranslations("Lists");
  const ui = useTranslations("Ui");
  const { refresh } = useAuth();

  const fetcher = useCallback((loc: string) => supervisorApi.getAttendance(dayId, loc), [dayId]);
  const { data, status, error, reload, setData } = useApiResource(fetcher);

  // Read-only vs editable is decided purely from the day's own real
  // lifecycle state, never from whether a save previously succeeded or
  // failed. The attendance list endpoint itself returns no day-state
  // field, so the day's own record is fetched by id (the same
  // `isDayClosedLike` the Training Days card's action link uses,
  // components/DayCard.tsx) rather than looked up in the selected
  // program's list -- which would miss a day of another program and leave
  // it editable. While that lookup is in flight the page keeps showing the
  // loading skeleton (below) alongside the attendance fetch, so editable
  // controls never flash on screen only to flip to read-only.
  const dayFetcher = useCallback((loc: string) => dashboardApi.getDay("supervisor", dayId, loc), [dayId]);
  const { data: dayEntry, status: dayStatus } = useApiResource(dayFetcher);
  const resolvingDayStatus = dayStatus === "loading";
  // A Planned day is not editable either: attendance can only be recorded
  // while the day is Open (DEC-04), so it is shown read-only with its own
  // notice instead of letting the supervisor fill in a sheet that the
  // server will refuse at save time.
  const notOpenYet = dayStatus === "success" && dayEntry?.state === "planned";
  const readOnly = dayStatus === "success" && !!dayEntry && (isDayClosedLike(dayEntry.state) || notOpenYet);

  const [rows, setRows] = useState<Record<number, Row> | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<ApiError | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  // Search / status filter only decide which rows are DISPLAYED. The save
  // payload is always built from every row in `currentRows`.
  const [query, setQuery] = useState("");
  const [viewFilter, setViewFilter] = useState<ViewFilter | "">("");
  // Status of every row as of the moment the filter/search was last changed.
  // The status filter is evaluated against this snapshot, so editing a row
  // never makes it vanish from under the user's cursor; the live counts
  // still reflect edits. Display only.
  const [baseline, setBaseline] = useState<Record<number, AttendanceStatus | null> | null>(null);

  // Unsaved edits: `rows` is null until the user changes something and is
  // reset after a successful save. UX only -- the server is untouched.
  const dirty = rows !== null;
  const leaveGuard = useLeaveGuard(dirty);

  const context = <DayContextHeader role="supervisor" dayId={dayId} trainingDaysHref="/supervisor/days" />;

  if (status === "loading" || resolvingDayStatus) {
    return (
      <div>
        {context}
        <SkeletonRows rows={6} label={t("loading")} />
      </div>
    );
  }
  if (status === "error" && error) {
    return (
      <div>
        {context}
        <ApiErrorView headingLevel={1} error={error} onRetry={reload} />
      </div>
    );
  }
  const items = data?.items ?? [];
  if (items.length === 0) {
    return (
      <div>
        {context}
        <EmptyState title={t("emptyTitle")} message={t("emptyMessage")} />
      </div>
    );
  }

  const currentRows =
    rows ??
    Object.fromEntries(
      items.map((item) => [
        item.trainee_id,
        {
          trainee_id: item.trainee_id,
          status: item.status ?? null,
          late_minutes: item.late_minutes ?? 0,
        } satisfies Row,
      ]),
    );

  const updateRow = (traineeId: number, patch: Partial<Row>) => {
    setRows({
      ...currentRows,
      [traineeId]: { ...currentRows[traineeId], ...patch },
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    setSavedAt(null);
    const payload: AttendanceUpsertItem[] = [];
    for (const row of Object.values(currentRows)) {
      if (row.status === null) continue;
      payload.push({
        trainee_id: row.trainee_id,
        status: row.status,
        ...(row.status === "late" ? { late_minutes: row.late_minutes ?? 0 } : {}),
      });
    }
    try {
      const result = await supervisorApi.putAttendance(dayId, payload, locale);
      setData(result);
      setRows(null);
      setSavedAt(Date.now());
    } catch (err) {
      if (err instanceof ApiError) {
        setSaveError(err);
        if (err.code === "UNAUTHENTICATED") refresh();
      }
    } finally {
      setSaving(false);
    }
  };

  const snapshotStatuses = () =>
    Object.fromEntries(Object.values(currentRows).map((r) => [r.trainee_id, r.status])) as Record<
      number,
      AttendanceStatus | null
    >;
  const changeQuery = (value: string) => {
    setBaseline(snapshotStatuses());
    setQuery(value);
  };
  const changeViewFilter = (value: ViewFilter | "") => {
    setBaseline(snapshotStatuses());
    setViewFilter(value);
  };

  // Trainees with no status yet: read-only = what the server has not
  // recorded; editable = rows the supervisor has not chosen a status for
  // (DEC-05: nothing is pre-selected, so nothing is saved for them).
  const notRecordedIds = new Set(
    readOnly
      ? items.filter((i) => i.status === null).map((i) => i.trainee_id)
      : Object.values(currentRows)
          .filter((r) => r.status === null)
          .map((r) => r.trainee_id),
  );
  const counts: Record<AttendanceStatus, number> = { present: 0, absent: 0, late: 0 };
  if (readOnly) {
    for (const item of items) if (item.status) counts[item.status] += 1;
  } else {
    for (const row of Object.values(currentRows)) if (row.status) counts[row.status] += 1;
  }
  const markRemainingPresent = () => {
    setRows(
      Object.fromEntries(
        Object.values(currentRows).map((r) => [
          r.trainee_id,
          r.status === null ? { ...r, status: "present" as const, late_minutes: 0 } : r,
        ]),
      ),
    );
  };
  const nothingToSave = notRecordedIds.size === Object.keys(currentRows).length;

  const normalizedQuery = normalizeSearchText(query);
  const visibleItems = items.filter((item) => {
    if (normalizedQuery && !normalizeSearchText(item.name).includes(normalizedQuery)) return false;
    if (viewFilter === "not_recorded") return notRecordedIds.has(item.trainee_id);
    if (viewFilter) {
      const statusValue = readOnly ? item.status : (baseline?.[item.trainee_id] ?? currentRows[item.trainee_id].status);
      return statusValue === viewFilter;
    }
    return true;
  });
  const showControls = shouldShowToolbar(items.length);
  const viewFilterLabel = (f: ViewFilter) => (f === "not_recorded" ? t("notRecorded") : t(`status.${f}`));
  const chips: ActiveFilter[] = [];
  if (normalizedQuery) {
    chips.push({ id: "q", label: l("chipSearch", { value: query.trim() }), onRemove: () => changeQuery("") });
  }
  if (viewFilter) {
    chips.push({
      id: "status",
      label: l("chipFilter", { name: t("filterLabel"), value: viewFilterLabel(viewFilter) }),
      onRemove: () => changeViewFilter(""),
    });
  }
  const clearView = () => {
    setQuery("");
    setViewFilter("");
    setBaseline(null);
  };
  const clearAction = (
    <button type="button" className="button button--secondary" onClick={clearView}>
      {ui("clearFilters")}
    </button>
  );

  return (
    <div>
      {context}
      <PageHeader title={<h1>{t("title")}</h1>} />
      {readOnly ? (
        <p className="readonly-notice">
          <LockIcon aria-hidden="true" />
          {t(notOpenYet ? "notOpenNotice" : "readOnlyNotice")}
        </p>
      ) : (
        <>
          <FormError error={saveError} onRetry={handleSave} />
          <LiveStatus message={t("saved")} stamp={savedAt} />
        </>
      )}
      <ul className="attendance-summary" aria-label={t("summaryLabel")}>
        {STATUSES.map((f) => (
          <li key={f} className={`attendance-summary__item attendance-summary__item--${f}`}>
            {t("summaryCount", { label: t(`status.${f}`), count: counts[f] })}
          </li>
        ))}
        <li className="attendance-summary__item attendance-summary__item--pending">
          {t("summaryCount", { label: t(readOnly ? "notRecorded" : "notYetSaved"), count: notRecordedIds.size })}
        </li>
      </ul>
      {!readOnly && notRecordedIds.size > 0 ? (
        <div className="attendance-summary__hint">
          <p className="card__meta">{t("notYetSavedHint")}</p>
          <button type="button" className="button button--secondary" onClick={markRemainingPresent}>
            {t("markRemainingPresent")}
          </button>
        </div>
      ) : null}
      {showControls ? (
        <FilterBar
          search={
            <SearchInput
              value={query}
              onChange={changeQuery}
              label={t("searchLabel")}
              placeholder={t("searchPlaceholder")}
              debounceMs={150}
            />
          }
          primary={
          <SortControl
            compact
            label={t("filterLabel")}
            value={viewFilter}
            onChange={(v) => changeViewFilter(v as ViewFilter | "")}
            options={[
              { value: "", label: t("filterAll") },
              ...VIEW_FILTERS.map((f) => ({ value: f, label: viewFilterLabel(f) })),
            ]}
          />
          }
          activeFilters={chips}
          onClear={clearView}
          resultText={chips.length ? t("shownOf", { shown: visibleItems.length, total: items.length }) : undefined}
        />
      ) : null}
      {visibleItems.length === 0 ? (
        <EmptyState variant={normalizedQuery ? "search" : "filtered"} query={query.trim()} action={clearAction} />
      ) : (
        <div className="table-scroll table-scroll--stacked">
          {/* Explicit ARIA roles: on phones the stacked layout sets
           * display:block on the table parts, which can drop native table
           * semantics in some browsers; the roles keep them regardless. */}
          <table className="data-table data-table--stacked" role="table">
            <thead role="rowgroup">
              <tr role="row">
                <th role="columnheader">{t("nameColumn")}</th>
                <th role="columnheader">{t("statusColumn")}</th>
                <th role="columnheader">{t("lateMinutesColumn")}</th>
              </tr>
            </thead>
            <tbody role="rowgroup">
              {visibleItems.map((item) => {
                const row = currentRows[item.trainee_id];
                return (
                  <tr key={item.trainee_id} role="row">
                    <td role="cell" className="attendance-name" data-label={t("nameColumn")}>
                      {item.name}
                    </td>
                    <td role="cell" data-label={t("statusColumn")}>
                      {readOnly ? (
                        item.status ? (
                          t(`status.${item.status}`)
                        ) : (
                          <span className="card__meta">{t("notRecorded")}</span>
                        )
                      ) : (
                        <div
                          className="status-radio-group"
                          role="radiogroup"
                          aria-label={t("statusFor", { name: item.name })}
                        >
                          {STATUSES.map((candidate) => (
                            <label key={candidate} data-status={candidate}>
                              <input
                                type="radio"
                                name={`status-${item.trainee_id}`}
                                checked={row.status === candidate}
                                onChange={() =>
                                  updateRow(item.trainee_id, {
                                    status: candidate,
                                    late_minutes: candidate === "late" ? row.late_minutes || 0 : 0,
                                  })
                                }
                              />
                              {t(`status.${candidate}`)}
                            </label>
                          ))}
                        </div>
                      )}
                    </td>
                    <td
                      role="cell"
                      data-label={t("lateMinutesColumn")}
                      className={(readOnly ? item.status : row.status) === "late" ? undefined : "attendance-late--na"}
                    >
                      {readOnly ? (
                        item.status === "late" ? (
                          item.late_minutes ?? 0
                        ) : (
                          <span className="attendance-na">
              <span aria-hidden="true">&mdash;</span>
              <span className="visually-hidden">{t("notApplicable")}</span>
            </span>
                        )
                      ) : row.status === "late" ? (
                        <span className="late-minutes">
                        <input
                          type="number"
                          min={0}
                          className="late-minutes-input"
                          inputMode="numeric"
                          aria-label={t("lateMinutesColumn")}
                          value={row.late_minutes ?? 0}
                          onChange={(event) =>
                            updateRow(item.trainee_id, { late_minutes: Number(event.target.value) })
                          }
                        />
                          <span className="late-minutes__unit" aria-hidden="true">
                            {t("minutesUnit")}
                          </span>
                        </span>
                      ) : (
                        <span className="attendance-na">
              <span aria-hidden="true">&mdash;</span>
              <span className="visually-hidden">{t("notApplicable")}</span>
            </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {!readOnly ? (
        <div className="button-row form-actions attendance-actions">
          <SubmitButton type="button" loading={saving} disabled={nothingToSave} loadingLabel={t("saving")} onClick={handleSave}>
            {t("save")}
          </SubmitButton>
          {dirty && !saving ? (
            <p className="unsaved-note">
              <span className="unsaved-note__dot" aria-hidden="true" />
              {t("unsavedChanges")}
            </p>
          ) : null}
        </div>
      ) : null}
      <ConfirmDialog
        open={leaveGuard.pendingHref !== null}
        title={t("leaveTitle")}
        message={t("leaveMessage")}
        confirmLabel={t("leaveConfirm")}
        cancelLabel={t("leaveStay")}
        onConfirm={leaveGuard.confirmLeave}
        onCancel={leaveGuard.stay}
      />
    </div>
  );
}

export default function AttendancePage({ params }: { params: Promise<{ dayId: string }> }) {
  const { dayId } = use(params);
  return (
    <ProtectedRoute role="supervisor">
      <AttendanceContent dayId={Number(dayId)} />
    </ProtectedRoute>
  );
}
