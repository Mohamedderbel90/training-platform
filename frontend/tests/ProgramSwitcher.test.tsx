import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithIntl } from "./testUtils";
import TraineeDaysPage from "@/app/[locale]/trainee/days/page";
import { ProgramInfoBox } from "@/components/dashboard/ProgramInfoBox";
import { ProgramSelectionProvider, useProgramSelection } from "@/lib/dashboard/ProgramSelection";
import { useAuth } from "@/lib/auth/AuthContext";
import { dashboardApi } from "@/lib/api/endpoints";
import type {
  DashboardEntryDto,
  DashboardProgramOptionDto,
  DashboardResponseDto,
} from "@/lib/api/types";

vi.mock("@/i18n/navigation", () => import("./mocks/i18nNavigation"));
vi.mock("@/lib/auth/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("@/lib/api/endpoints", () => ({ dashboardApi: { get: vi.fn() } }));

const programs: DashboardProgramOptionDto[] = [
  { id: 1, name: "Leadership Program", start_date: "2026-07-07", end_date: "2026-10-22" },
  { id: 2, name: "Second Program", start_date: "2025-01-01", end_date: "2025-12-31" },
];

function entry(id: number, programId: number, course: string): DashboardEntryDto {
  return {
    training_day_id: id,
    course_id: id,
    program_id: programId,
    date: "2026-09-15",
    course_name: course,
    program_name: `Program ${programId}`,
    start_datetime: null,
    end_datetime: null,
    state: "closed",
    survey_open_at: null,
    survey_close_at: null,
    survey: { configured: true, response: null, can_submit: false, reason: null },
  };
}

function summary(programId: number): DashboardResponseDto {
  return {
    days: [programId === 1 ? entry(1, 1, "Leadership Course") : entry(2, 2, "Second Course")],
    program: { ...programs[programId - 1] },
    programs,
    stats: null,
    next_session: null,
  };
}

describe("Header program selector", () => {
  it("opens a list of the user's programs and reports the chosen one", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    renderWithIntl(
      <ProgramInfoBox program={programs[0]} programs={programs} onSelect={onSelect} topbar />,
    );

    await user.click(screen.getByRole("button", { name: "Choose a program" }));
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveAttribute("aria-selected", "true");

    await user.click(screen.getByRole("option", { name: /Second Program/ }));
    expect(onSelect).toHaveBeenCalledWith(2);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("supports the keyboard: arrows move, Enter selects, Escape closes", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    renderWithIntl(
      <ProgramInfoBox program={programs[0]} programs={programs} onSelect={onSelect} topbar />,
    );
    const trigger = screen.getByRole("button", { name: "Choose a program" });
    trigger.focus();
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(onSelect).toHaveBeenCalledWith(2);

    await user.keyboard("{ArrowDown}{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("stays a plain, non-interactive box when there is only one program", () => {
    renderWithIntl(
      <ProgramInfoBox program={programs[0]} programs={[programs[0]]} onSelect={vi.fn()} topbar />,
    );
    expect(screen.getByText("Leadership Program")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    // OI-1: no chevron either -- nothing to open.
    expect(document.querySelector(".program-info-box__chevron")).toBeNull();
  });

  it("shows the chevron only when there are several programs to switch between", () => {
    renderWithIntl(<ProgramInfoBox program={programs[0]} programs={programs} onSelect={vi.fn()} topbar />);
    expect(document.querySelector(".program-info-box__chevron")).not.toBeNull();
  });
});

function Picker() {
  const { setSelectedProgramId } = useProgramSelection();
  return <button onClick={() => setSelectedProgramId(2)}>pick second</button>;
}

describe("Training Days follows the selected program", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.mocked(useAuth).mockReturnValue({
      status: "authenticated",
      profile: { id: 1, partner_id: 1, name: "T", locale: "en_US", roles: ["trainee"], capabilities: [] },
      roles: ["trainee"],
      login: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
    });
    vi.mocked(dashboardApi.get).mockImplementation(async (_role, _loc, programId) =>
      summary(programId === 2 ? 2 : 1),
    );
  });

  it("asks the backend for the chosen program and shows only its days", async () => {
    const user = userEvent.setup();
    renderWithIntl(
      <ProgramSelectionProvider>
        <Picker />
        <TraineeDaysPage />
      </ProgramSelectionProvider>,
    );
    await waitFor(() => expect(screen.getByText("Leadership Course")).toBeInTheDocument());
    expect(dashboardApi.get).toHaveBeenLastCalledWith("trainee", "en", null);

    await user.click(screen.getByText("pick second"));

    await waitFor(() => expect(screen.getByText("Second Course")).toBeInTheDocument());
    expect(screen.queryByText("Leadership Course")).not.toBeInTheDocument();
    expect(dashboardApi.get).toHaveBeenLastCalledWith("trainee", "en", 2);
    expect(window.localStorage.getItem("nq-selected-program")).toBe("2");
  });

  it("restores the remembered program on load", async () => {
    window.localStorage.setItem("nq-selected-program", "2");
    renderWithIntl(
      <ProgramSelectionProvider>
        <TraineeDaysPage />
      </ProgramSelectionProvider>,
    );
    await waitFor(() => expect(screen.getByText("Second Course")).toBeInTheDocument());
    expect(dashboardApi.get).toHaveBeenCalledWith("trainee", "en", 2);
  });
});
