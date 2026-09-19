import { describe, it, expect, vi } from "vitest";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import { renderWithIntl } from "./testUtils";
import { SupervisorSurveyContent } from "@/app/[locale]/supervisor/[dayId]/survey/page";
import { useAuth } from "@/lib/auth/AuthContext";
import { supervisorApi } from "@/lib/api/endpoints";
import type { SurveyDefinitionDto } from "@/lib/api/types";

vi.mock("@/i18n/navigation", () => import("./mocks/i18nNavigation"));
vi.mock("@/lib/auth/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("@/lib/api/endpoints", () => ({
  supervisorApi: {
    getAttendance: vi.fn(),
    putAttendance: vi.fn(),
    getSurvey: vi.fn(),
    getSurveyStatus: vi.fn(),
    submitSurvey: vi.fn(),
  },
}));

function mockAuthenticated() {
  vi.mocked(useAuth).mockReturnValue({
    status: "authenticated",
    profile: { id: 2, partner_id: 2, name: "Dev Supervisor", locale: "en_US", roles: ["supervisor"], capabilities: [] },
    roles: ["supervisor"],
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
  });
}

const definition: SurveyDefinitionDto = {
  survey_id: 2,
  title: "Demo Supervisor Survey",
  version_no: 1,
  sections: [
    {
      id: 0,
      title: null,
      questions: [
        {
          question_id: 10,
          title: "Environment notes",
          question_type: "char_box",
          required: false,
          kpi_category: null,
          options: null,
        },
      ],
    },
  ],
};

describe("Supervisor survey page", () => {
  it("fetches its own status directly (no dashboard workaround) and renders the definition when available", async () => {
    mockAuthenticated();
    vi.mocked(supervisorApi.getSurveyStatus).mockResolvedValue({
      configured: true,
      response: null,
      can_submit: true,
      reason: null,
    });
    vi.mocked(supervisorApi.getSurvey).mockResolvedValue(definition);

    renderWithIntl(<SupervisorSurveyContent dayId={7} />);

    await waitFor(() => expect(screen.getByText("Demo Supervisor Survey")).toBeInTheDocument());
    expect(screen.getByText("Environment notes")).toBeInTheDocument();
    expect(supervisorApi.getSurveyStatus).toHaveBeenCalledWith(7, "en");
  });

  it("submits the evaluation and then shows a read-only thank-you state", async () => {
    mockAuthenticated();
    vi.mocked(supervisorApi.getSurveyStatus).mockResolvedValue({
      configured: true,
      response: null,
      can_submit: true,
      reason: null,
    });
    vi.mocked(supervisorApi.getSurvey).mockResolvedValue(definition);
    vi.mocked(supervisorApi.submitSurvey).mockResolvedValue({
      response_id: 5,
      state: "submitted",
      submitted_at: "2026-09-16 10:00:00",
      editable: false,
    });

    renderWithIntl(<SupervisorSurveyContent dayId={7} />);
    await waitFor(() => expect(screen.getByLabelText("Environment notes")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("Environment notes"), { target: { value: "All good" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, submit" }));

    await waitFor(() =>
      expect(supervisorApi.submitSurvey).toHaveBeenCalledWith(
        7,
        [{ question_id: 10, text: "All good" }],
        "en",
      ),
    );
    expect(await screen.findByText("Thank you")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit" })).not.toBeInTheDocument();
  });

  it("shows the already-submitted read-only state directly from the status endpoint, without fetching the definition", async () => {
    mockAuthenticated();
    vi.mocked(supervisorApi.getSurveyStatus).mockResolvedValue({
      configured: true,
      response: { response_id: 5, state: "submitted", submitted_at: "2026-09-16 10:00:00", editable: false },
      can_submit: false,
      reason: "already_submitted",
    });

    renderWithIntl(<SupervisorSurveyContent dayId={7} />);

    await waitFor(() => expect(screen.getByText("Thank you")).toBeInTheDocument());
    expect(supervisorApi.getSurvey).not.toHaveBeenCalled();
  });

  it("shows the unavailable state with the server's reason when the survey window isn't open", async () => {
    mockAuthenticated();
    vi.mocked(supervisorApi.getSurveyStatus).mockResolvedValue({
      configured: true,
      response: null,
      can_submit: false,
      reason: "The survey window has not opened yet.",
    });

    renderWithIntl(<SupervisorSurveyContent dayId={7} />);

    expect(await screen.findByText("The survey window has not opened yet.")).toBeInTheDocument();
  });
});
