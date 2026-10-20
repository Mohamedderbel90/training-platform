import { describe, it, expect, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithIntl } from "./testUtils";
import { EmptyState, ErrorState, ListPageFallback } from "@/components/StateViews";

describe("EmptyState", () => {
  it("default variant shows title/message and no action", () => {
    renderWithIntl(<EmptyState title="Nothing" message="Later" />);
    expect(screen.getByText("Nothing")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("search variant names the query and renders the action slot", () => {
    const onClear = vi.fn();
    renderWithIntl(
      <EmptyState variant="search" query="xyz" action={<button onClick={onClear}>Clear search</button>} />,
    );
    expect(screen.getByText("No results for “xyz”")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(onClear).toHaveBeenCalled();
  });

  it("filtered variant has its own wording, Arabic too", () => {
    const { unmount } = renderWithIntl(<EmptyState variant="filtered" />);
    expect(screen.getByText("No items match the selected filters")).toBeInTheDocument();
    unmount();
    renderWithIntl(<EmptyState variant="filtered" />, { locale: "ar" });
    expect(screen.getByText("لا توجد عناصر تطابق عوامل التصفية المحددة")).toBeInTheDocument();
  });

  it("is not announced as an alert", () => {
    renderWithIntl(<EmptyState variant="search" />);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("ErrorState", () => {
  it("has no Reference line (request ids are logged, not shown)", () => {
    renderWithIntl(<ErrorState title="T" message="M" />);
    expect(screen.queryByText(/Reference/)).toBeNull();
  });
});

describe("state titles and list fallback", () => {
  it("renders titles as h2 by default and honours headingLevel, keeping the visual class", () => {
    const { rerender } = renderWithIntl(<EmptyState title="Nothing" />);
    const h = screen.getByRole("heading", { level: 2, name: "Nothing" });
    expect(h).toHaveClass("state-view__title");
    rerender(<EmptyState title="Nothing" headingLevel={3} />);
    expect(screen.getByRole("heading", { level: 3, name: "Nothing" })).toBeInTheDocument();
    rerender(<ErrorState title="Broke" message="m" />);
    expect(screen.getByRole("heading", { level: 2, name: "Broke" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  });

  it("ListPageFallback shows the skeleton loading state (not a blank frame)", () => {
    const { container } = renderWithIntl(<ListPageFallback />);
    expect(container.querySelector(".skeleton-card")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
  });
});
