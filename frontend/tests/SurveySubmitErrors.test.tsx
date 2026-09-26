import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import { renderWithIntl } from "./testUtils";
import { TraineeSurveyContent } from "@/app/[locale]/trainee/[dayId]/page";
import { useAuth } from "@/lib/auth/AuthContext";
import { traineeApi } from "@/lib/api/endpoints";
import { ApiError } from "@/lib/api/client";
import type { SurveyDefinitionDto } from "@/lib/api/types";

vi.mock("@/i18n/navigation", () => import("./mocks/i18nNavigation"));
vi.mock("@/lib/auth/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("@/lib/api/endpoints", () => ({
  traineeApi: { getSurvey: vi.fn(), getSurveyStatus: vi.fn(), submitSurvey: vi.fn() },
}));

const refresh = vi.fn();

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
        {
          question_id: 2,
          title: "Score",
          question_type: "scale",
          required: false,
          kpi_category: null,
          options: null,
        },
      ],
    },
  ],
};

function apiError(code: string, status: number, message: string, requestId = "req_abc123") {
  return new ApiError({ code, message, fields: null }, status, requestId);
}

async function openFormAndSubmit() {
  renderWithIntl(<TraineeSurveyContent dayId={1} />);
  await waitFor(() => expect(screen.getByText("Excellent")).toBeInTheDocument());
  fireEvent.click(screen.getByLabelText("Excellent"));
  fireEvent.click(screen.getByRole("button", { name: "Submit" }));
  fireEvent.click(screen.getByRole("button", { name: "Yes, submit" }));
}

describe("Trainee survey submit error mapping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      status: "authenticated",
      profile: { id: 1, partner_id: 1, name: "T", locale: "en_US", roles: ["trainee"], capabilities: [] },
      roles: ["trainee"],
      login: vi.fn(),
      logout: vi.fn(),
      refresh,
    });
    vi.mocked(traineeApi.getSurveyStatus).mockResolvedValue({
      configured: true,
      response: null,
      can_submit: true,
      reason: null,
    });
    vi.mocked(traineeApi.getSurvey).mockResolvedValue(definition);
  });

  it.each([
    ["BAD_REQUEST", 400, "The survey window is closed.", "Error"],
    ["FORBIDDEN", 403, "You do not have access to this survey.", "Access denied"],
    ["CONFLICT", 409, "Please try again.", "Already submitted"],
    ["VALIDATION_ERROR", 422, "Invalid answer option for question 'Rate the trainer'.", "Some information is missing or invalid"],
  ])("surfaces %s (%i) with the server message and request id, keeping the form", async (code, status, message, title) => {
    vi.mocked(traineeApi.submitSurvey).mockRejectedValue(apiError(code, status, message));

    await openFormAndSubmit();

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.getByText(title)).toBeInTheDocument();
    expect(screen.getByText("req_abc123")).toBeInTheDocument();
    // Not stuck busy: the form is still there and can be resubmitted.
    expect(screen.getByRole("button", { name: "Submit" })).toBeEnabled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("re-checks the session on a 401 during submit", async () => {
    vi.mocked(traineeApi.submitSurvey).mockRejectedValue(
      apiError("UNAUTHENTICATED", 401, "Session expired."),
    );
    await openFormAndSubmit();
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("shows a translated message for a network failure", async () => {
    vi.mocked(traineeApi.submitSurvey).mockRejectedValue(
      apiError("NETWORK_ERROR", 0, "raw english"),
    );
    await openFormAndSubmit();
    expect(await screen.findByText("Connection problem")).toBeInTheDocument();
    expect(screen.queryByText("raw english")).not.toBeInTheDocument();
  });

  it("retry after a failed definition load actually refetches (no endless spinner)", async () => {
    vi.mocked(traineeApi.getSurvey)
      .mockRejectedValueOnce(apiError("INTERNAL_ERROR", 500, "Boom"))
      .mockResolvedValueOnce(definition);

    renderWithIntl(<TraineeSurveyContent dayId={1} />);
    expect(await screen.findByText("Something went wrong on our side. Please try again in a moment.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() => expect(screen.getByText("Demo Trainee Survey")).toBeInTheDocument());
    expect(traineeApi.getSurvey).toHaveBeenCalledTimes(2);
  });

  it("formats the submitted-at time for the locale instead of printing the raw server string", async () => {
    vi.mocked(traineeApi.getSurveyStatus).mockResolvedValue({
      configured: true,
      response: { response_id: 1, state: "submitted", submitted_at: "2026-09-15 10:00:00", editable: false },
      can_submit: false,
      reason: "already_submitted",
    });
    renderWithIntl(<TraineeSurveyContent dayId={1} />);
    expect(await screen.findByText(/Submitted at/)).toBeInTheDocument();
    expect(screen.queryByText(/2026-09-15 10:00:00/)).not.toBeInTheDocument();
  });

  it("scale question is an integer numeric input; choice groups are labelled", async () => {
    renderWithIntl(<TraineeSurveyContent dayId={1} />);
    await waitFor(() => expect(screen.getByText("Excellent")).toBeInTheDocument());
    expect(screen.getByRole("radiogroup", { name: "Rate the trainer" })).toBeInTheDocument();
    expect(screen.getByLabelText("Score")).toHaveAttribute("step", "1");
  });
});
