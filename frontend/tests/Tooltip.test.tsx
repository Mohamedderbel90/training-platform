import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Tooltip } from "@/components/Tooltip";

function Trigger() {
  return (
    <Tooltip content="Not available right now">
      {(trigger) => (
        <button type="button" aria-disabled="true" {...trigger}>
          Open survey
        </button>
      )}
    </Tooltip>
  );
}

describe("Tooltip", () => {
  it("keeps the explanation in the accessibility tree even before it is shown", () => {
    render(<Trigger />);
    const button = screen.getByRole("button", { name: "Open survey" });
    const describedBy = button.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    const bubble = document.getElementById(describedBy!);
    expect(bubble).toHaveTextContent("Not available right now");
    expect(bubble).toHaveAttribute("role", "tooltip");
    // Present in the DOM, but not yet visually shown.
    expect(bubble).not.toHaveAttribute("data-visible");
  });

  it("shows on mouse hover", () => {
    render(<Trigger />);
    const button = screen.getByRole("button", { name: "Open survey" });
    const bubble = document.getElementById(button.getAttribute("aria-describedby")!)!;

    fireEvent.mouseEnter(button);
    expect(bubble).toHaveAttribute("data-visible", "true");

    fireEvent.mouseLeave(button);
    expect(bubble).not.toHaveAttribute("data-visible");
  });

  it("shows on keyboard focus, not only on hover", () => {
    render(<Trigger />);
    const button = screen.getByRole("button", { name: "Open survey" });
    const bubble = document.getElementById(button.getAttribute("aria-describedby")!)!;

    button.focus();
    fireEvent.focus(button);
    expect(bubble).toHaveAttribute("data-visible", "true");

    fireEvent.blur(button);
    expect(bubble).not.toHaveAttribute("data-visible");
  });
});
