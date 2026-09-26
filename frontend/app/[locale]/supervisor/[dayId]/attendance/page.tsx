"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";
import { useAuth } from "@/lib/auth/AuthContext";
import { supervisorApi, type AttendanceUpsertItem } from "@/lib/api/endpoints";
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
import { normalizeSearchText, shouldShowToolbar } from "@/lib/dashboard/listControls";
import type { AttendanceStatus } from "@/lib/api/types";

const STATUSES: AttendanceStatus[] = ["present", "absent", "late"];

/** Display-only view filter. "not_recorded" means the server has no
 * attendance record yet for that trainee. */
type ViewFilter = AttendanceStatus | "not_recorded";
const VIEW_FILTERS: ViewFilter[] = [...STATUSES, "not_recorded"];

export function AttendanceContent({ dayId }: { dayId: number }) {
  const t = useTranslations("Attendance");
  const locale = useLocale();
  const l = useTranslations("Lists");
  const ui = useTranslations("Ui");
  const { refresh } = useAuth();

  const fetcher = useCallback((loc: string) => supervisorApi.getAttendance(dayId, loc), [dayId]);
  const { data, status, error, reload, setData } = useApiResource(fetcher);

  const [rows, setRows] = useState<Record<number, AttendanceUpsertItem> | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<ApiError | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  // Search / status filter only decide which rows are DISPLAYED. The save
  // payload is always built from every row in `currentRows`.
  const [query, setQuery] = useState("");
  const [viewFilter, setViewFilter] = useState<ViewFilter | "">("");

  // Unsaved edits: `rows` is null until the user changes something and is
  // reset after a successful save. UX only -- the server is untouched.
  const dirty = rows !== null;
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  if (status === "loading") {
    return <SkeletonRows rows={6} label={t("loading")} />;
  }
  if (status === "error" && error) {
    return <ApiErrorView error={error} onRetry={reload} />;
  }
  const items = data?.items ?? [];
  if (items.length === 0) {
    return <EmptyState title={t("emptyTitle")} message={t("emptyMessage")} />;
  }

  const currentRows =
    rows ??
    Object.fromEntries(
      items.map((item) => [
        item.trainee_id,
        {
          trainee_id: item.trainee_id,
          status: item.status ?? "present",
          late_minutes: item.late_minutes ?? 0,
        } satisfies AttendanceUpsertItem,
      ]),
    );

  const updateRow = (traineeId: number, patch: Partial<AttendanceUpsertItem>) => {
    setRows({
      ...currentRows,
      [traineeId]: { ...currentRows[traineeId], ...patch },
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    setSavedAt(null);
    const payload = Object.values(currentRows).map((row) => ({
      trainee_id: row.trainee_id,
      status: row.status,
      ...(row.status === "late" ? { late_minutes: row.late_minutes ?? 0 } : {}),
    }));
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

  const notRecordedIds = new Set(items.filter((i) => i.status === null).map((i) => i.trainee_id));
  const counts = {
    present: 0,
    absent: 0,
    late: 0,
    not_recorded: notRecordedIds.size,
  } satisfies Record<ViewFilter, number>;
  for (const row of Object.values(currentRows)) counts[row.status] += 1;

  const normalizedQuery = normalizeSearchText(query);
  const visibleItems = items.filter((item) => {
    if (normalizedQuery && !normalizeSearchText(item.name).includes(normalizedQuery)) return false;
    if (viewFilter === "not_recorded") return notRecordedIds.has(item.trainee_id);
    if (viewFilter) return currentRows[item.trainee_id].status === viewFilter;
    return true;
  });
  const showControls = shouldShowToolbar(items.length);
  const viewFilterLabel = (f: ViewFilter) => (f === "not_recorded" ? t("notRecorded") : t(`status.${f}`));
  const chips: ActiveFilter[] = [];
  if (normalizedQuery) {
    chips.push({ id: "q", label: l("chipSearch", { value: query.trim() }), onRemove: () => setQuery("") });
  }
  if (viewFilter) {
    chips.push({
      id: "status",
      label: l("chipFilter", { name: t("filterLabel"), value: viewFilterLabel(viewFilter) }),
      onRemove: () => setViewFilter(""),
    });
  }
  const clearView = () => {
    setQuery("");
    setViewFilter("");
  };
  const clearAction = (
    <button type="button" className="button button--secondary" onClick={clearView}>
      {ui("clearFilters")}
    </button>
  );

  return (
    <div>
      <PageHeader title={<h1>{t("title")}</h1>} />
      <FormError error={saveError} onRetry={handleSave} />
      <LiveStatus message={t("saved")} stamp={savedAt} />
      <ul className="attendance-summary" aria-label={t("summaryLabel")}>
        {VIEW_FILTERS.map((f) => (
          <li key={f}>{t("summaryCount", { label: viewFilterLabel(f), count: counts[f] })}</li>
        ))}
      </ul>
      {showControls ? (
        <FilterBar
          search={
            <SearchInput
              value={query}
              onChange={setQuery}
              label={t("searchLabel")}
              placeholder={t("searchPlaceholder")}
              debounceMs={150}
            />
          }
          activeFilters={chips}
          onClear={clearView}
          resultText={chips.length ? t("shownOf", { shown: visibleItems.length, total: items.length }) : undefined}
        >
          <SortControl
            label={t("filterLabel")}
            value={viewFilter}
            onChange={(v) => setViewFilter(v as ViewFilter | "")}
            options={[
              { value: "", label: t("filterAll") },
              ...VIEW_FILTERS.map((f) => ({ value: f, label: viewFilterLabel(f) })),
            ]}
          />
        </FilterBar>
      ) : null}
      {visibleItems.length === 0 ? (
        <EmptyState variant={normalizedQuery ? "search" : "filtered"} query={query.trim()} action={clearAction} />
      ) : (
        <div className="table-scroll table-scroll--stacked">
          <table className="data-table data-table--stacked">
            <thead>
              <tr>
                <th>{t("nameColumn")}</th>
                <th>{t("statusColumn")}</th>
                <th>{t("lateMinutesColumn")}</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((item) => {
                const row = currentRows[item.trainee_id];
                return (
                  <tr key={item.trainee_id}>
                    <td className="attendance-name" data-label={t("nameColumn")}>
                      {item.name}
                    </td>
                    <td data-label={t("statusColumn")}>
                      <div
                        className="status-radio-group"
                        role="radiogroup"
                        aria-label={t("statusFor", { name: item.name })}
                      >
                        {STATUSES.map((candidate) => (
                          <label key={candidate}>
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
                    </td>
                    <td
                      data-label={t("lateMinutesColumn")}
                      className={row.status === "late" ? undefined : "attendance-late--na"}
                    >
                      {row.status === "late" ? (
                        <input
                          type="number"
                          min={0}
                          className="late-minutes-input"
                          aria-label={t("lateMinutesColumn")}
                          value={row.late_minutes ?? 0}
                          onChange={(event) =>
                            updateRow(item.trainee_id, { late_minutes: Number(event.target.value) })
                          }
                        />
                      ) : (
                        <span className="card__meta">{t("notApplicable")}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="button-row form-actions">
        <SubmitButton type="button" loading={saving} loadingLabel={t("saving")} onClick={handleSave}>
          {t("save")}
        </SubmitButton>
        {dirty && !saving ? (
          <p className="unsaved-note">
            <span className="unsaved-note__dot" aria-hidden="true" />
            {t("unsavedChanges")}
          </p>
        ) : null}
      </div>
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
