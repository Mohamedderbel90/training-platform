import { describe, it, expect, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithIntl } from "./testUtils";
import { FilterBar } from "@/components/FilterBar";

const filters = (onRemove = vi.fn()) => [
  { id: "status", label: "Status: Open", onRemove },
  { id: "course", label: "Course: A", onRemove: vi.fn() },
];

describe("FilterBar", () => {
  it("shows active count, chips and result count (polite live region)", () => {
    renderWithIntl(
      <FilterBar activeFilters={filters()} onClear={() => {}} resultCount={3}>
        <select aria-label="Status" />
      </FilterBar>,
    );
    expect(screen.getByRole("button", { name: /Filters/ })).toHaveTextContent("2");
    expect(screen.getByText("Status: Open")).toBeInTheDocument();
    const live = screen.getByText("3 results");
    expect(live).toHaveAttribute("aria-live", "polite");
  });

  it("removes a single chip via its accessible button", () => {
    const onRemove = vi.fn();
    renderWithIntl(<FilterBar activeFilters={filters(onRemove)} onClear={() => {}}><select aria-label="S" /></FilterBar>);
    fireEvent.click(screen.getByRole("button", { name: "Remove filter: Status: Open" }));
    expect(onRemove).toHaveBeenCalledOnce();
  });

  it("shows Clear filters only when something is active", () => {
    const onClear = vi.fn();
    const { rerender } = renderWithIntl(<FilterBar activeFilters={[]} onClear={onClear}><select aria-label="S" /></FilterBar>);
    expect(screen.queryByRole("button", { name: "Clear filters" })).toBeNull();
    rerender(<FilterBar activeFilters={filters()} onClear={onClear}><select aria-label="S" /></FilterBar>);
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(onClear).toHaveBeenCalledOnce();
  });

  it("toggle exposes aria-expanded and controls the panel", () => {
    renderWithIntl(<FilterBar><select aria-label="Status" /></FilterBar>);
    const toggle = screen.getByRole("button", { name: /Filters/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(document.getElementById(toggle.getAttribute("aria-controls")!)).toHaveAttribute("data-open", "true");
  });

  it("renders Arabic result count with plural forms", () => {
    renderWithIntl(<FilterBar resultCount={2} />, { locale: "ar" });
    expect(screen.getByText("نتيجتان")).toBeInTheDocument();
  });
});
