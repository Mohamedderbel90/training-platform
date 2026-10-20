import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithIntl } from "./testUtils";
import {
  TrainingDaysBoard,
  useBackToTrainingDaysHref,
  withReturnTo,
} from "@/components/dashboard/TrainingDaysBoard";
import { useListControls } from "@/lib/dashboard/useListControls";
import { dayNumbersByProgram } from "@/lib/dashboard/listControls";
import { __installUrlSync, __setMockPathname } from "./mocks/i18nNavigation";
import { __setMockSearchParams } from "./mocks/nextNavigation";
import { makeEntry } from "./listFixtures";
import type { DashboardEntryDto } from "@/lib/api/types";

vi.mock("@/i18n/navigation", () => import("./mocks/i18nNavigation"));
vi.mock("next/navigation", () => import("./mocks/nextNavigation"));

const days: DashboardEntryDto[] = [
  makeEntry({
    training_day_id: 1,
    course_id: 1,
    program_id: 1,
    course_name: "Demo Course",
    date: "2026-09-16",
    trainer_report: { configured: true, response: null, can_submit: true, reason: null },
  }),
];

function Harness() {
  const controls = useListControls(days, { kind: "report" });
  const dayNumbers = dayNumbersByProgram(days);
  const backHref = useBackToTrainingDaysHref();
  return (
    <TrainingDaysBoard
      controls={controls}
      dayNumbers={dayNumbers}
      renderActions={(entry) => (
        // `preventDefault` only -- jsdom has no real page to navigate to,
        // and the scroll-store handler (a click-capture on an ancestor)
        // already runs before this regardless.
        <a
          href={withReturnTo(`/trainer/${entry.training_day_id}`, backHref)}
          onClick={(e) => e.preventDefault()}
        >
          Fill out impression report
        </a>
      )}
    />
  );
}

const STORAGE_KEY = "trainingDaysScroll:/trainer/days";

beforeEach(() => {
  __setMockPathname("/trainer/days");
  __setMockSearchParams({});
  __installUrlSync();
  sessionStorage.clear();
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});

describe("Training Days scroll restoration", () => {
  it("stores the current scroll position, keyed to this URL, right before an action link is followed", async () => {
    Object.defineProperty(window, "scrollY", { value: 480, configurable: true });
    const user = userEvent.setup();
    renderWithIntl(<Harness />);

    await user.click(screen.getByRole("link", { name: "Fill out impression report" }));

    expect(sessionStorage.getItem(STORAGE_KEY)).toBe("480");
  });

  it("does not store anything for a click that is not an action link (no 'from=' href)", async () => {
    const user = userEvent.setup();
    renderWithIntl(<Harness />);
    // The day-status badge is plain text, not a link -- clicking the card
    // body itself must not write anything.
    await user.click(screen.getByText("Demo Course"));
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("restores and then clears the stored scroll position when the page mounts at the same URL", async () => {
    sessionStorage.setItem(STORAGE_KEY, "320");
    renderWithIntl(<Harness />);

    await waitFor(() => expect(window.scrollTo).toHaveBeenCalledWith({ top: 320, behavior: "auto" }));
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("does not scroll when there is no stored position for this URL", async () => {
    renderWithIntl(<Harness />);
    // Give any stray effect a tick to (not) run.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it("keys the stored position to the full URL including filters, so a differently filtered visit does not collide", async () => {
    __setMockSearchParams({ dayStatus: "open" });
    Object.defineProperty(window, "scrollY", { value: 200, configurable: true });
    const user = userEvent.setup();
    renderWithIntl(<Harness />);

    await user.click(screen.getByRole("link", { name: "Fill out impression report" }));

    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(sessionStorage.getItem("trainingDaysScroll:/trainer/days?dayStatus=open")).toBe("200");
  });
});
