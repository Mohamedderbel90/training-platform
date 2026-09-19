"use client";

import { use, useCallback, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";
import { useAuth } from "@/lib/auth/AuthContext";
import { supervisorApi, type AttendanceUpsertItem } from "@/lib/api/endpoints";
import { ApiError } from "@/lib/api/client";
import { useApiResource } from "@/lib/api/useApiResource";
import { LoadingState, EmptyState } from "@/components/StateViews";
import { ApiErrorView } from "@/components/ApiErrorView";
import { PageHeader } from "@/components/PageHeader";
import type { AttendanceStatus } from "@/lib/api/types";

const STATUSES: AttendanceStatus[] = ["present", "absent", "late"];

export function AttendanceContent({ dayId }: { dayId: number }) {
  const t = useTranslations("Attendance");
  const locale = useLocale();
  const { refresh } = useAuth();

  const fetcher = useCallback((loc: string) => supervisorApi.getAttendance(dayId, loc), [dayId]);
  const { data, status, error, reload, setData } = useApiResource(fetcher);

  const [rows, setRows] = useState<Record<number, AttendanceUpsertItem> | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<ApiError | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  if (status === "loading") {
    return <LoadingState label={t("loading")} />;
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

  return (
    <div>
      <PageHeader title={<h1>{t("title")}</h1>} />
      {saveError ? <ApiErrorView error={saveError} onRetry={handleSave} /> : null}
      {savedAt ? (
        <p className="badge badge--success" role="status">
          {t("saved")}
        </p>
      ) : null}
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t("nameColumn")}</th>
              <th>{t("statusColumn")}</th>
              <th>{t("lateMinutesColumn")}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const row = currentRows[item.trainee_id];
              return (
                <tr key={item.trainee_id}>
                  <td>{item.name}</td>
                  <td>
                    <div className="status-radio-group" role="radiogroup" aria-label={t("statusColumn")}>
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
                  <td>
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
      <div className="button-row">
        <button type="button" className="button" onClick={handleSave} disabled={saving}>
          {saving ? t("saving") : t("save")}
        </button>
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
