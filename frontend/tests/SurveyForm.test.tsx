import { describe, it, expect, vi } from "vitest";
import { act, screen, fireEvent, within } from "@testing-library/react";
import { useState } from "react";
import { renderWithIntl } from "./testUtils";
import { SurveyForm } from "@/components/SurveyForm";

vi.mock("@/i18n/navigation", () => import("./mocks/i18nNavigation"));
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

  it("applies the server-supplied scale bounds to the scale input", () => {
    const scaleDefinition: SurveyDefinitionDto = {
      survey_id: 2,
      title: "Scale Survey",
      version_no: 1,
      sections: [
        {
          id: 0,
          title: null,
          questions: [
            {
              question_id: 9,
              title: "Overall score",
              question_type: "scale",
              required: false,
              kpi_category: null,
              options: null,
              scale_min: 1,
              scale_max: 5,
            },
          ],
        },
      ],
    };
    renderWithIntl(
      <SurveyForm definition={scaleDefinition} readOnly={false} onSubmit={vi.fn()} />,
    );
    const input = screen.getByRole("spinbutton");
    expect(input).toHaveAttribute("min", "1");
    expect(input).toHaveAttribute("max", "5");
    expect(input).toHaveAttribute("step", "1");
  });

  it("shows an answered-of-required progress indicator that follows local answers", () => {
    renderWithIntl(<SurveyForm definition={definition} readOnly={false} onSubmit={vi.fn()} />);
    const bar = screen.getByRole("progressbar", { name: "Survey progress" });
    expect(bar).toHaveAttribute("aria-valuenow", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "1");
    expect(screen.getAllByText("Answered 0 of 1 required").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByLabelText("Excellent"));
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
    expect(screen.getAllByText("Answered 1 of 1 required").length).toBeGreaterThan(0);
  });

  it("does not show progress in the read-only view", () => {
    renderWithIntl(<SurveyForm definition={definition} readOnly onSubmit={vi.fn()} />);
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("focuses the error summary on every blocked submit and links to the question control", () => {
    renderWithIntl(<SurveyForm definition={definition} readOnly={false} onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    const summary = screen.getByRole("alert");
    expect(summary).toHaveFocus();
    // Per-question inline error with the group wired via aria-describedby.
    const group = screen.getByRole("radiogroup", { name: /Rate the trainer/ });
    expect(group).toHaveAccessibleDescription("This question is required.");

    (document.activeElement as HTMLElement).blur();
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(summary).toHaveFocus();

    fireEvent.click(within(summary).getByRole("link", { name: /Rate the trainer/ }));
    expect(screen.getByLabelText("Poor")).toHaveFocus();
  });

  it("marks required questions with visible and non-visual text, and groups by section heading", () => {
    const sectioned: SurveyDefinitionDto = {
      ...definition,
      sections: [{ ...definition.sections[0], id: 7, title: "Trainer feedback" }],
    };
    renderWithIntl(<SurveyForm definition={sectioned} readOnly={false} onSubmit={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Trainer feedback" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Trainer feedback" })).toBeInTheDocument();
    expect(screen.getAllByText("(required)")).toHaveLength(1);
  });

  it("presents the final confirmation as an accessible dialog and returns focus on cancel", () => {
    const onSubmit = vi.fn();
    renderWithIntl(<SurveyForm definition={definition} readOnly={false} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByLabelText("Excellent"));
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    const dialog = screen.getByRole("dialog", { name: "Submit your response?" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("disables actions and shows only the submit button as loading while submitting", () => {
    renderWithIntl(
      <SurveyForm definition={definition} readOnly={false} busy onSubmit={vi.fn()} onSaveDraft={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "Save draft" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
    expect(screen.getByLabelText("Poor")).toBeDisabled();
  });

  it("shows the submit button as busy after confirming", async () => {
    let resolve!: () => void;
    const onSubmit = vi.fn().mockReturnValue(new Promise<void>((r) => (resolve = r)));
    function Harness() {
      const [busy, setBusy] = useState(false);
      return (
        <SurveyForm
          definition={definition}
          readOnly={false}
          busy={busy}
          onSubmit={async (a) => {
            setBusy(true);
            await onSubmit(a);
            setBusy(false);
          }}
        />
      );
    }
    renderWithIntl(<Harness />);
    fireEvent.click(screen.getByLabelText("Excellent"));
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, submit" }));
    const busy = await screen.findByRole("button", { name: "Submitting..." });
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute("aria-busy", "true");
    await act(async () => resolve());
  });

  it("read-only shows the saved choice as selected and says so for unanswered questions", () => {
    renderWithIntl(
      <SurveyForm
        definition={definition}
        initialAnswers={[{ question_id: 1, answer_option_id: 2 }]}
        readOnly
        onSubmit={() => undefined}
      />,
    );
    expect(screen.getByLabelText("Excellent")).toBeChecked();
    expect(screen.getByLabelText("Poor")).not.toBeChecked();
    // Only the unanswered "Comments" question carries the note.
    expect(screen.getAllByText("No answer was given for this question.")).toHaveLength(1);
    expect(screen.queryByText("(required)")).not.toBeInTheDocument();
  });

  it("explains the allowed range of a scale question while answering", () => {
    const scale: SurveyDefinitionDto = {
      ...definition,
      sections: [
        {
          id: 0,
          title: null,
          questions: [
            { question_id: 9, title: "Score", question_type: "scale", required: false, kpi_category: null, options: null, scale_min: 1, scale_max: 10 },
          ],
        },
      ],
    };
    renderWithIntl(<SurveyForm definition={scale} readOnly={false} onSubmit={() => undefined} />);
    expect(screen.getByText("Enter a whole number from 1 to 10.")).toBeInTheDocument();
  });
});
