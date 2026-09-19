import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent, within } from "@testing-library/react";
import { renderWithIntl } from "./testUtils";
import { SurveyForm } from "@/components/SurveyForm";
import type { SurveyDefinitionDto } from "@/lib/api/types";

const definition: SurveyDefinitionDto = {
  survey_id: 1,
  title: "Demo Survey",
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
          required: true,
          kpi_category: null,
          options: [
            { id: 1, label: "Poor" },
            { id: 2, label: "Excellent" },
          ],
        },
        {
          question_id: 2,
          title: "Comments",
          question_type: "char_box",
          required: false,
          kpi_category: null,
          options: null,
        },
      ],
    },
  ],
};

describe("SurveyForm", () => {
  it("renders every question from the dynamic definition", () => {
    renderWithIntl(
      <SurveyForm definition={definition} readOnly={false} onSubmit={vi.fn()} />,
    );
    expect(screen.getByText("Rate the trainer")).toBeInTheDocument();
    expect(screen.getByText("Comments")).toBeInTheDocument();
    expect(screen.getByText("Poor")).toBeInTheDocument();
    expect(screen.getByText("Excellent")).toBeInTheDocument();
  });

  it("blocks submit and shows an accessible error summary when a required question is unanswered", () => {
    const onSubmit = vi.fn();
    renderWithIntl(<SurveyForm definition={definition} readOnly={false} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(onSubmit).not.toHaveBeenCalled();
    const summary = screen.getByRole("alert");
    expect(within(summary).getByText("Rate the trainer")).toBeInTheDocument();
  });

  it("submits the selected answers after confirmation once required questions are answered", () => {
    const onSubmit = vi.fn();
    renderWithIntl(<SurveyForm definition={definition} readOnly={false} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByLabelText("Excellent"));
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    // Confirmation step (M5 point 4's "submit confirmation").
    expect(screen.getByText("Submit your response?")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Yes, submit" }));

    expect(onSubmit).toHaveBeenCalledWith([{ question_id: 1, answer_option_id: 2 }]);
  });

  it("renders read-only with no submit controls and disabled inputs once submitted", () => {
    renderWithIntl(
      <SurveyForm definition={definition} readOnly onSubmit={vi.fn()} />,
    );
    expect(screen.getByText("This response has been submitted and is read-only.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Poor")).toBeDisabled();
  });

  it("offers Save Draft only when onSaveDraft is provided (trainer flow)", () => {
    renderWithIntl(
      <SurveyForm definition={definition} readOnly={false} onSubmit={vi.fn()} onSaveDraft={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "Save draft" })).toBeInTheDocument();
  });

  it("pre-fills answers from initialAnswers so a trainer draft can be resumed", () => {
    renderWithIntl(
      <SurveyForm
        definition={definition}
        initialAnswers={[{ question_id: 2, text: "Existing note" }]}
        readOnly={false}
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByDisplayValue("Existing note")).toBeInTheDocument();
  });
});
