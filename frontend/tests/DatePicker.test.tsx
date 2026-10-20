import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithIntl } from "./testUtils";
import { DatePicker } from "@/components/DatePicker";

function setup(props: Partial<React.ComponentProps<typeof DatePicker>> = {}, locale: "en" | "ar" = "en") {
  const onChange = vi.fn();
  renderWithIntl(
    <DatePicker label="From" value="" onChange={onChange} placeholder="Choose date" {...props} />,
    { locale },
  );
  return onChange;
}

describe("DatePicker", () => {
  it("shows the placeholder, then the formatted value", () => {
    setup({ value: "2026-09-10" });
    expect(screen.getByRole("button", { name: "From" })).toHaveTextContent("Sep 10, 2026");
  });

  it("opens on the value's month, picks a day by click and closes", async () => {
    const user = userEvent.setup();
    const onChange = setup({ value: "2026-09-10" });
    await user.click(screen.getByRole("button", { name: "From" }));
    expect(screen.getByRole("dialog", { name: "From" })).toBeInTheDocument();
    expect(screen.getByText("September 2026")).toBeInTheDocument();
    await user.click(screen.getByRole("gridcell", { name: "Sep 15, 2026" }));
    expect(onChange).toHaveBeenCalledWith("2026-09-15");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("is keyboard operable: arrows move focus, Enter picks, Escape closes", async () => {
    const user = userEvent.setup();
    const onChange = setup({ value: "2026-09-10" });
    const trigger = screen.getByRole("button", { name: "From" });
    trigger.focus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("gridcell", { name: "Sep 10, 2026" })).toHaveFocus();
    await user.keyboard("{ArrowRight}{ArrowDown}");
    expect(screen.getByRole("gridcell", { name: "Sep 18, 2026" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith("2026-09-18");

    await user.keyboard("{ArrowDown}{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("mirrors the arrow keys in Arabic", async () => {
    const user = userEvent.setup();
    setup({ value: "2026-09-10" }, "ar");
    screen.getByRole("button", { name: "From" }).focus();
    await user.keyboard("{ArrowDown}{ArrowLeft}");
    expect(document.activeElement?.getAttribute("data-date")).toBe("2026-09-11");
  });

  it("disables days outside min/max and ignores clicking them", async () => {
    const user = userEvent.setup();
    const onChange = setup({ value: "2026-09-15", min: "2026-09-10", max: "2026-09-20" });
    await user.click(screen.getByRole("button", { name: "From" }));
    const early = screen.getByRole("gridcell", { name: "Sep 9, 2026" });
    expect(early).toHaveAttribute("aria-disabled", "true");
    await user.click(early);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Previous month" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next month" })).toBeDisabled();
  });

  it("changes month with the header buttons and clears the value", async () => {
    const user = userEvent.setup();
    const onChange = setup({ value: "2026-09-10" });
    await user.click(screen.getByRole("button", { name: "From" }));
    await user.click(screen.getByRole("button", { name: "Next month" }));
    expect(screen.getByText("October 2026")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(onChange).toHaveBeenCalledWith("");
  });
});
