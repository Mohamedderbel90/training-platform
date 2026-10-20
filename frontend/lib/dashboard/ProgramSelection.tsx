"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

/** The program picked in the header's selector. Shared by the header, the
 * Dashboard and the Training Days pages (through useDashboardSummary) so one
 * choice scopes all of them; the backend validates it against the programs
 * the user is assigned in (`?program_id=`), so a stale or tampered id is
 * refused, never shown. `null` = "the current program", chosen by the
 * backend. Kept in localStorage so the choice survives a reload. */
const STORAGE_KEY = "nq-selected-program";

interface ProgramSelectionValue {
  selectedProgramId: number | null;
  setSelectedProgramId: (id: number | null) => void;
}

const ProgramSelectionContext = createContext<ProgramSelectionValue>({
  selectedProgramId: null,
  setSelectedProgramId: () => {},
});

function readStored(): number | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const id = raw ? Number(raw) : NaN;
    return Number.isInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

export function ProgramSelectionProvider({ children }: { children: ReactNode }) {
  const [selectedProgramId, setSelected] = useState<number | null>(() =>
    typeof window === "undefined" ? null : readStored(),
  );

  const setSelectedProgramId = useCallback((id: number | null) => {
    setSelected(id);
    try {
      if (id === null) window.localStorage.removeItem(STORAGE_KEY);
      else window.localStorage.setItem(STORAGE_KEY, String(id));
    } catch {
      /* storage unavailable: the choice just lasts for this page view */
    }
  }, []);

  const value = useMemo(
    () => ({ selectedProgramId, setSelectedProgramId }),
    [selectedProgramId, setSelectedProgramId],
  );
  return <ProgramSelectionContext.Provider value={value}>{children}</ProgramSelectionContext.Provider>;
}

export function useProgramSelection() {
  return useContext(ProgramSelectionContext);
}
