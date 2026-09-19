import { describe, it, expect, vi } from "vitest";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import { renderWithIntl } from "./testUtils";
import { AttendanceContent } from "@/app/[locale]/supervisor/[dayId]/attendance/page";
import { useAuth } from "@/lib/auth/AuthContext";
import { supervisorApi } from "@/lib/api/endpoints";
import { ApiError } from "@/lib/api/client";

vi.mock("@/i18n/navigation", () => import("./mocks/i18nNavigation"));
vi.mock("@/lib/auth/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("@/lib/api/endpoints", () => ({
  supervisorApi: { getAttendance: vi.fn(), putAttendance: vi.fn(), getSurvey: vi.fn(), submitSurvey: vi.fn() },
}));

function mockAuthenticated() {
  vi.mocked(useAuth).mockReturnValue({
    status: "authenticated",
    profile: { id: 1, partner_id: 1, name: "Dev Supervisor", locale: "en_US", roles: ["supervisor"], capabilities: [] },
    roles: ["supervisor"],
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
  });
}

describe("Supervisor attendance page", () => {
  it("renders one row per enrolled trainee with status controls", async () => {
    mockAuthenticated();
    vi.mocked(supervisorApi.getAttendance).mockResolvedValue({
      items: [{ trainee_id: 10, name: "Dev Trainee", status: null, late_minutes: null }],
    });
    renderWithIntl(<AttendanceContent dayId={1} />);

    await waitFor(() => expect(screen.getByText("Dev Trainee")).toBeInTheDocument());
    expect(screen.getByLabelText("Present")).toBeInTheDocument();
    expect(screen.getByLabelText("Absent")).toBeInTheDocument();
    expect(screen.getByLabelText("Late")).toBeInTheDocument();
  });

  it("only shows the late-minutes input once Late is selected", async () => {
    mockAuthenticated();
    vi.mocked(supervisorApi.getAttendance).mockResolvedValue({
      items: [{ trainee_id: 10, name: "Dev Trainee", status: "present", late_minutes: null }],
    });
    renderWithIntl(<AttendanceContent dayId={1} />);
    await waitFor(() => expect(screen.getByText("Dev Trainee")).toBeInTheDocument());

    expect(screen.queryByLabelText("Late minutes")).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Late"));
    expect(screen.getByLabelText("Late minutes")).toBeInTheDocument();
  });

  it("saves the bulk upsert payload with late_minutes only for late entries", async () => {
    mockAuthenticated();
    vi.mocked(supervisorApi.getAttendance).mockResolvedValue({
      items: [{ trainee_id: 10, name: "Dev Trainee", status: "present", late_minutes: null }],
    });
    vi.mocked(supervisorApi.putAttendance).mockResolvedValue({
      items: [{ trainee_id: 10, name: "Dev Trainee", status: "late", late_minutes: 15 }],
    });
    renderWithIntl(<AttendanceContent dayId={1} />);
    await waitFor(() => expect(screen.getByText("Dev Trainee")).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText("Late"));
    fireEvent.change(screen.getByLabelText("Late minutes"), { target: { value: "15" } });
    fireEvent.click(screen.getByRole("button", { name: "Save attendance" }));

    await waitFor(() =>
      expect(supervisorApi.putAttendance).toHaveBeenCalledWith(
        1,
        [{ trainee_id: 10, status: "late", late_minutes: 15 }],
        "en",
      ),
    );
    expect(await screen.findByText("Attendance saved")).toBeInTheDocument();
  });

  it("surfaces a server validation error instead of silently failing the save", async () => {
    mockAuthenticated();
    vi.mocked(supervisorApi.getAttendance).mockResolvedValue({
      items: [{ trainee_id: 10, name: "Dev Trainee", status: "present", late_minutes: null }],
    });
    vi.mocked(supervisorApi.putAttendance).mockRejectedValue(
      new ApiError(
        { code: "VALIDATION_ERROR", message: "Trainee 10 is not an active enrollment in this training day's program.", fields: null },
        422,
        "req_1",
      ),
    );
    renderWithIntl(<AttendanceContent dayId={1} />);
    await waitFor(() => expect(screen.getByText("Dev Trainee")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Save attendance" }));

    expect(
      await screen.findByText("Trainee 10 is not an active enrollment in this training day's program."),
    ).toBeInTheDocument();
  });
});
