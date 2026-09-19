import { describe, it, expect, vi } from "vitest";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import { renderWithIntl } from "./testUtils";
import { TrainerReportContent } from "@/app/[locale]/trainer/[dayId]/page";
import { useAuth } from "@/lib/auth/AuthContext";
import { trainerApi } from "@/lib/api/endpoints";
import type { TrainerReportDto } from "@/lib/api/types";

vi.mock("@/i18n/navigation", () => import("./mocks/i18nNavigation"));
vi.mock("@/lib/auth/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("@/lib/api/endpoints", () => ({
  trainerApi: { getReport: vi.fn(), saveDraft: vi.fn(), submitReport: vi.fn() },
}));

function mockAuthenticated() {
  vi.mocked(useAuth).mockReturnValue({
    status: "authenticated",
    profile: { id: 1, partner_id: 1, name: "Dev Trainer", locale: "en_US", roles: ["trainer"], capabilities: [] },
    roles: ["trainer"],
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
  });
}

const baseReport: TrainerReportDto = {
  definition: {
    survey_id: 3,
    title: "Demo Trainer Survey",
    version_no: 1,
    sections: [
      {
        id: 0,
        title: null,
        questions: [
          {
            question_id: 3,
            title: "Session notes",
            question_type: "char_box",
            required: true,
            kpi_category: null,
            options: null,
          },
        ],
      },
    ],
  },
  status: { configured: true, response: null, can_submit: true, reason: null },
  answers: null,
};

describe("Trainer report page", () => {
  it("resumes a previously saved draft with its answers pre-filled", async () => {
    mockAuthenticated();
    vi.mocked(trainerApi.getReport).mockResolvedValue({
      ...baseReport,
      status: { configured: true, response: { response_id: 2, state: "in_progress", submitted_at: null, editable: true }, can_submit: true, reason: null },
      answers: [{ question_id: 3, text: "Draft note" }],
    });
    renderWithIntl(<TrainerReportContent dayId={1} />);

    await waitFor(() => expect(screen.getByDisplayValue("Draft note")).toBeInTheDocument());
  });

  it("saves a draft without finalizing the report", async () => {
    mockAuthenticated();
    vi.mocked(trainerApi.getReport).mockResolvedValue(baseReport);
    vi.mocked(trainerApi.saveDraft).mockResolvedValue({
      response_id: 2,
      state: "in_progress",
      submitted_at: null,
      editable: true,
    });
    renderWithIntl(<TrainerReportContent dayId={1} />);
    await waitFor(() => expect(screen.getByText("Session notes")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/Session notes/), { target: { value: "In progress note" } });
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));

    await waitFor(() =>
      expect(trainerApi.saveDraft).toHaveBeenCalledWith(1, [{ question_id: 3, text: "In progress note" }], "en"),
    );
    expect(await screen.findByText("Draft saved")).toBeInTheDocument();
    // Still editable -- a draft save never finalizes the response.
    expect(screen.getByRole("button", { name: "Submit" })).toBeInTheDocument();
  });

  it("submits the final report and then renders read-only with no further editing", async () => {
    mockAuthenticated();
    vi.mocked(trainerApi.getReport)
      .mockResolvedValueOnce(baseReport)
      .mockResolvedValueOnce({
        ...baseReport,
        status: {
          configured: true,
          response: { response_id: 2, state: "submitted", submitted_at: "2026-09-15 10:00:00", editable: false },
          can_submit: false,
          reason: "already_submitted",
        },
      });
    vi.mocked(trainerApi.submitReport).mockResolvedValue({
      response_id: 2,
      state: "submitted",
      submitted_at: "2026-09-15 10:00:00",
      editable: false,
    });
    renderWithIntl(<TrainerReportContent dayId={1} />);
    await waitFor(() => expect(screen.getByText("Session notes")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/Session notes/), { target: { value: "Final note" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, submit" }));

    await waitFor(() =>
      expect(trainerApi.submitReport).toHaveBeenCalledWith(1, [{ question_id: 3, text: "Final note" }], "en"),
    );
    expect(await screen.findByText("Thank you")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save draft" })).not.toBeInTheDocument();
  });
});
