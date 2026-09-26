import { describe, it, expect, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithIntl } from "./testUtils";
import { SortControl } from "@/components/SortControl";

const options = [
  { value: "date_desc", label: "Newest first" },
  { value: "date_asc", label: "Oldest first" },
];

describe("SortControl", () => {
  it("is a labelled select and reports changes", () => {
    const onChange = vi.fn();
    renderWithIntl(<SortControl value="date_desc" onChange={onChange} options={options} />);
    const select = screen.getByRole("combobox", { name: "Sort by" });
    expect(select).toHaveValue("date_desc");
    fireEvent.change(select, { target: { value: "date_asc" } });
    expect(onChange).toHaveBeenCalledWith("date_asc");
  });

  it("uses the Arabic default label and custom label override", () => {
    const { unmount } = renderWithIntl(<SortControl value="date_desc" onChange={() => {}} options={options} />, { locale: "ar" });
    expect(screen.getByRole("combobox", { name: "الترتيب حسب" })).toBeInTheDocument();
    unmount();
    renderWithIntl(<SortControl value="date_desc" onChange={() => {}} options={options} label="Order" />);
    expect(screen.getByRole("combobox", { name: "Order" })).toBeInTheDocument();
  });
});
