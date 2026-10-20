"use client";

import { useCallback } from "react";
import { dashboardApi } from "@/lib/api/endpoints";
import { useApiResource } from "@/lib/api/useApiResource";
import { useProgramSelection } from "@/lib/dashboard/ProgramSelection";
import type { OperationalRole } from "@/lib/api/types";

/** Shared fetch (scoped to the header's selected program) used both by a role's Dashboard page and by the shared
 * header's current-program box (AppShell) -- `role` is null while auth
 * is still resolving or the user has no operational role, in which
 * case this never calls the API. */
export function useDashboardSummary(role: OperationalRole | null) {
  const { selectedProgramId } = useProgramSelection();
  const fetcher = useCallback(
    (locale: string) => {
      if (!role) {
        return Promise.reject(new Error("No operational role to load a dashboard for."));
      }
      return dashboardApi.get(role, locale, selectedProgramId);
    },
    [role, selectedProgramId],
  );
  return useApiResource(fetcher);
}
