import { ApiError } from "@/lib/api/client";
import { describe, it, expect, vi } from "vitest";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import { renderWithIntl } from "./testUtils";
import { TraineeSurveyContent } from "@/app/[locale]/trainee/[dayId]/page";
import { useAuth } from "@/lib/auth/AuthContext";
import { traineeApi } from "@/lib/api/endpoints";
import type { SurveyDefinitionDto } from "@/lib/api/types";

vi.mock("@/i18n/navigation", () => import("./mocks/i18nNavigation"));
vi.mock("@/lib/auth/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("@/lib/api/endpoints", () => ({
  traineeApi: { getSurvey: vi.fn(), getSurveyStatus: vi.fn(), getMyResponse: vi.fn(), submitSurvey: vi.fn() },
}));

function mockAuthenticated() {
  vi.mocked(useAuth).mockReturnValue({
    status: "authenticated",
    profile: { id: 1, partner_id: 1, name: "Dev Trainee", locale: "en_US", roles: ["trainee"], capabilities: [] },
    roles: ["trainee"],
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
  });
}

const definition: SurveyDefinitionDto = {
  survey_id: 1,
  title: "Demo Trainee Survey",
  version_no: 1,
  sections: [
    {
      id: 0,
      title: null,
      questions: [
        {
          question_id: 1,
          title: "Rate the trainer",
          question_type: "simple_choice",
          required: false,
          kpi_category: null,
          options: [{ id: 5, label: "Excellent" }],
        },
      ],
    },
  ],
};

describe("Trainee survey page", () => {
  it("renders the survey definition when available for submission", async () => {
    mockAuthenticated();
    vi.mocked(traineeApi.getSurveyStatus).mockResolvedValue({
      configured: true,
      response: null,
      can_submit: true,
      reason: null,
    });
    vi.mocked(traineeApi.getSurvey).mockResolvedValue(definition);

    renderWithIntl(<TraineeSurveyContent dayId={1} />);

    await waitFor(() => expect(screen.getByText("Demo Trainee Survey")).toBeInTheDocument());
    expect(screen.getByText("Rate the trainer")).toBeInTheDocument();
  });

  it("submits the survey and then shows a read-only thank-you state with no way to edit", async () => {
    mockAuthenticated();
    vi.mocked(traineeApi.getSurveyStatus).mockResolvedValue({
      configured: true,
      response: null,
      can_submit: true,
      reason: null,
    });
    vi.mocked(traineeApi.getSurvey).mockResolvedValue(definition);
    vi.mocked(traineeApi.submitSurvey).mockResolvedValue({
      response_id: 1,
      state: "submitted",
      submitted_at: "2026-09-15 10:00:00",
      editable: false,
    });

    renderWithIntl(<TraineeSurveyContent dayId={1} />);
    await waitFor(() => expect(screen.getByText("Excellent")).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText("Excellent"));
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, submit" }));

    await waitFor(() =>
      expect(traineeApi.submitSurvey).toHaveBeenCalledWith(
        1,
        [{ question_id: 1, answer_option_id: 5 }],
        "en",
      ),
    );
    expect(await screen.findByText("Thank you")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Excellent")).not.toBeInTheDocument();
  });

  it("opens an already-submitted survey read-only with the saved answers and no save/submit actions", async () => {
    mockAuthenticated();
    vi.mocked(traineeApi.getSurveyStatus).mockResolvedValue({
      configured: true,
      response: { response_id: 1, state: "submitted", submitted_at: "2026-09-15 10:00:00", editable: false },
      can_submit: false,
      reason: "already_submitted",
    });
    vi.mocked(traineeApi.getMyResponse).mockResolvedValue({
      definition,
      status: { response_id: 1, state: "submitted", submitted_at: "2026-09-15 10:00:00", editable: false },
      answers: [{ question_id: 1, answer_option_id: 5 }],
    });

    renderWithIntl(<TraineeSurveyContent dayId={1} />);

    expect(await screen.findByRole("heading", { name: "Demo Trainee Survey" })).toBeInTheDocument();
    expect(screen.getByText("This response has been submitted and is read-only.")).toBeInTheDocument();
    const choice = screen.getByLabelText("Excellent");
    expect(choice).toBeChecked();
    expect(choice).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Submit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /save/i })).not.toBeInTheDocument();
    // The editable definition endpoint is never used for a submitted survey.
    expect(traineeApi.getSurvey).not.toHaveBeenCalled();
  });

  it("shows a retryable error when the submitted answers cannot be loaded", async () => {
    mockAuthenticated();
    vi.mocked(traineeApi.getSurveyStatus).mockResolvedValue({
      configured: true,
      response: { response_id: 1, state: "submitted", submitted_at: "2026-09-15 10:00:00", editable: false },
      can_submit: false,
      reason: "already_submitted",
    });
    vi.mocked(traineeApi.getMyResponse).mockRejectedValue(new ApiError({ code: "SERVER_ERROR", message: "boom", fields: null }, 500, null));

    renderWithIntl(<TraineeSurveyContent dayId={1} />);

    expect(await screen.findByRole("button", { name: /retry|try again/i })).toBeInTheDocument();
  });

  it("shows the unavailable state with the server's reason when the survey window isn't open", async () => {
    mockAuthenticated();
    vi.mocked(traineeApi.getSurveyStatus).mockResolvedValue({
      configured: true,
      response: null,
      can_submit: false,
      reason: "The survey window has not opened yet.",
    });

    renderWithIntl(<TraineeSurveyContent dayId={1} />);

    expect(await screen.findByText("The survey window has not opened yet.")).toBeInTheDocument();
    // planned/postponed days: the unavailable state is the page's h1
    expect(screen.getByRole("heading", { level: 1, name: "Survey unavailable" })).toBeInTheDocument();
  });
});
