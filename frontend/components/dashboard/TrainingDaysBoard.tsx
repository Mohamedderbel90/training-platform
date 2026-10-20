"use client";

import { useCallback, useEffect, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { usePathname } from "@/i18n/navigation";
import { DayCard } from "@/components/DayCard";
import { DayListNoResults, DayListPagination, DayListToolbar } from "@/components/DayListToolbar";
import { TrainingDaysCalendar } from "@/components/dashboard/TrainingDaysCalendar";
import type { ListControls } from "@/lib/dashboard/useListControls";
import type { DashboardEntryDto } from "@/lib/api/types";

/** Builds the return URL an action subpage's "Back to Training Days"
 * link reads back (see components/BackToTrainingDays.tsx): the current
 * Training Days URL, filters/sort/view-mode and all, so leaving for a
 * survey/attendance/report page and coming back restores exactly what
 * the user had. */
export function useBackToTrainingDaysHref(): string {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const qs = searchParams?.toString() ?? "";
  return qs ? `${pathname}?${qs}` : pathname;
}

export function withReturnTo(href: string, backHref: string): string {
  return `${href}?from=${encodeURIComponent(backHref)}`;
}

/** sessionStorage key for this exact Training Days URL's scroll position
 * (filters/sort/view-mode all included via the search string, so
 * different filtered views of the same page never collide). Scoped to
 * this one page, not a generic app-wide scroll-restoration mechanism. */
const SCROLL_STORAGE_PREFIX = "trainingDaysScroll:";

function scrollStorageKey(pathname: string, search: string): string {
  return `${SCROLL_STORAGE_PREFIX}${pathname}${search ? `?${search}` : ""}`;
}

/** Remembers the Training Days page's own scroll position right before
 * the user follows an action link (survey/report/attendance) to a
 * subpage, keyed to this exact URL -- so `useRestoreTrainingDaysScroll`
 * below can put the user back where they were instead of always landing
 * at the top on return. Recognises an action link by the `?from=` query
 * param every one of them carries (see `withReturnTo` above), via a
 * single delegated click handler on the board, so it never needs
 * threading a new prop through `DayCard`/`SurveyStatusGroup`/
 * `AttendanceStatusGroup`. A plain click-capture handler runs
 * synchronously before the anchor's own navigation, so the write always
 * lands before the page unmounts. */
function useStoreScrollBeforeLeaving() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      const anchor = target.closest("a[href]");
      if (!anchor) return;
      const href = anchor.getAttribute("href") ?? "";
      if (!href.includes("from=")) return;
      try {
        sessionStorage.setItem(
          scrollStorageKey(pathname, searchParams?.toString() ?? ""),
          String(window.scrollY),
        );
      } catch {
        // sessionStorage unavailable (private mode, etc.) -- scroll
        // position just won't be restored; everything else still works.
      }
    },
    [pathname, searchParams],
  );
}

/** Restores the scroll position stored above, once, on mount -- i.e.
 * when the user lands back on this exact Training Days URL after
 * following an action link. The stored value is only cleared once the
 * scroll is actually applied (inside the `requestAnimationFrame`
 * callback below), not eagerly right after being read: React's
 * development-mode Strict Mode mounts every component twice (mount,
 * clean up, mount again) to surface exactly this kind of bug, and a
 * throwaway first mount's cleanup cancels its `requestAnimationFrame`
 * before it ever fires -- if the value had already been removed from
 * sessionStorage during that throwaway mount's read, the real second
 * mount would find nothing left to restore. Reading non-destructively
 * and removing only on actual success keeps this correct under Strict
 * Mode (confirmed by live testing) while still behaving as "clear on
 * the restoring read" for a real visit. */
function useRestoreTrainingDaysScroll() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  useEffect(() => {
    const key = scrollStorageKey(pathname, searchParams?.toString() ?? "");
    let stored: string | null = null;
    try {
      stored = sessionStorage.getItem(key);
    } catch {
      return;
    }
    if (stored === null) return;
    const y = Number(stored);
    if (!Number.isFinite(y)) return;
    // Wait for the cards/calendar to actually paint before scrolling to
    // them -- scrolling in the same tick as mount can land short.
    const frame = requestAnimationFrame(() => {
      window.scrollTo({ top: y, behavior: "auto" });
      try {
        sessionStorage.removeItem(key);
      } catch {
        // sessionStorage unavailable -- nothing to clean up.
      }
    });
    return () => cancelAnimationFrame(frame);
    // Only re-run if the URL this page mounted with actually changes --
    // not meant to re-fire on every filter click within the same visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/**
 * The shared body of every role's Training Days page (section 2 of the
 * unification): the common toolbar (search/course/date/3-way status/
 * view toggle, via `DayListToolbar`) above either the card list or the
 * calendar grid, whichever `controls.viewMode` currently is -- same
 * filtered/sorted `controls.results` either way, so switching views
 * never changes what's shown, only how. `renderActions` builds each
 * entry's role-specific action group (SurveyStatusGroup/
 * AttendanceStatusGroup); callers already append `?from=` to its link
 * hrefs via `withReturnTo`/`useBackToTrainingDaysHref` above.
 */
export function TrainingDaysBoard({
  controls,
  timeZone,
  showAttendance = false,
  dayNumbers,
  renderActions,
}: {
  controls: ListControls;
  timeZone?: string | null;
  showAttendance?: boolean;
  /** Pre-computed "Day N" ordinals keyed by `training_day_id` (see
   * `dayNumbersByProgram` in lib/dashboard/listControls.ts), derived by
   * the page from the full, unfiltered `days` array so the number never
   * shifts as filters/pagination narrow `controls.results`. */
  dayNumbers: Map<number, number>;
  renderActions: (entry: DashboardEntryDto) => ReactNode;
}) {
  useRestoreTrainingDaysScroll();
  const storeScrollBeforeLeaving = useStoreScrollBeforeLeaving();

  return (
    // `display: contents` so this wrapper -- needed only to catch the
    // click, in the capture phase, before an action link's own
    // navigation -- never affects layout (no extra box in `.training-days-page`'s
    // flow between the toolbar/board/pagination siblings).
    <div style={{ display: "contents" }} onClickCapture={storeScrollBeforeLeaving}>
      {controls.showToolbar ? <DayListToolbar controls={controls} showAttendance={showAttendance} /> : null}
      {controls.viewMode === "calendar" && controls.results.length === 0 ? (
        <DayListNoResults controls={controls} />
      ) : controls.viewMode === "calendar" ? (
        <TrainingDaysCalendar
          entries={controls.results}
          timeZone={timeZone}
          dayNumbers={dayNumbers}
          renderActions={renderActions}
        />
      ) : controls.results.length === 0 ? (
        <DayListNoResults controls={controls} />
      ) : (
        <div className="card-list">
          {controls.visible.map((entry) => (
            <DayCard
              key={entry.training_day_id}
              entry={entry}
              timeZone={timeZone}
              dayNumber={dayNumbers.get(entry.training_day_id) ?? 1}
            >
              {renderActions(entry)}
            </DayCard>
          ))}
        </div>
      )}
      {controls.viewMode === "card" ? (
        <DayListPagination
          controls={controls}
          onPageChange={() => {
            // Bring the new page's first card into view: the pager sits
            // below the list, so without this the user stays at the bottom.
            requestAnimationFrame(() =>
              document.querySelector(".card-list")?.scrollIntoView?.({ block: "start" }),
            );
          }}
        />
      ) : null}
    </div>
  );
}
