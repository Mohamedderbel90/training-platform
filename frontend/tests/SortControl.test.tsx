import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithIntl } from "./testUtils";
import { SortControl } from "@/components/SortControl";

const options = [
  { value: "date_desc", label: "Newest first" },
  { value: "date_asc", label: "Oldest first" },
  { value: "name", label: "Name" },
];

describe("SortControl (themed dropdown)", () => {
  it("is a labelled combobox showing the selected option, and reports clicks", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithIntl(<SortControl value="date_desc" onChange={onChange} options={options} />);
    const trigger = screen.getByRole("combobox", { name: "Sort by" });
    expect(trigger).toHaveTextContent("Newest first");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("option", { name: "Newest first" })).toHaveAttribute("aria-selected", "true");
    await user.click(screen.getByRole("option", { name: "Oldest first" }));
    expect(onChange).toHaveBeenCalledWith("date_asc");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("supports keyboard: open, move, select, Escape and typeahead", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithIntl(<SortControl value="date_desc" onChange={onChange} options={options} />);
    const trigger = screen.getByRole("combobox", { name: "Sort by" });
    trigger.focus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("date_asc");
    expect(trigger).toHaveFocus();

    await user.keyboard("{Enter}{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    await user.keyboard("n");
    expect(onChange).toHaveBeenLastCalledWith("name");
  });

  it("uses the Arabic default label and custom label override", () => {
    const { unmount } = renderWithIntl(<SortControl value="date_desc" onChange={() => {}} options={options} />, { locale: "ar" });
    expect(screen.getByRole("combobox", { name: "الترتيب حسب" })).toBeInTheDocument();
    unmount();
    renderWithIntl(<SortControl value="date_desc" onChange={() => {}} options={options} label="Order" />);
    expect(screen.getByRole("combobox", { name: "Order" })).toBeInTheDocument();
  });
});
