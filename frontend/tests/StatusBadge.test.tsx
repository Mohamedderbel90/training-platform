import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge, type StatusTone } from "@/components/StatusBadge";

describe("StatusBadge", () => {
  it.each<[StatusTone, string]>([
    ["neutral", "badge"],
    ["success", "badge--success"],
    ["warning", "badge--warning"],
    ["danger", "badge--danger"],
    ["info", "badge--info"],
  ])("renders text for tone %s", (tone, cls) => {
    render(<StatusBadge tone={tone}>Label</StatusBadge>);
    const el = screen.getByText("Label");
    expect(el).toHaveClass(cls);
  });

  it("defaults to neutral and keeps the icon decorative next to the text", () => {
    render(<StatusBadge icon="✓">Done</StatusBadge>);
    expect(screen.getByText("Done")).toHaveClass("badge");
    expect(screen.getByText("✓")).toHaveAttribute("aria-hidden", "true");
  });
});
