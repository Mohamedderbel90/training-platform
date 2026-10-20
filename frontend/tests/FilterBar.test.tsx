import { describe, it, expect, vi, afterEach } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  it("keeps the panel closed by default and open when a panel filter is already active", () => {
    const { unmount } = renderWithIntl(
      <FilterBar primary={<select aria-label="Sort" />} panelActiveCount={0}>
        <select aria-label="Status" />
      </FilterBar>,
    );
    expect(screen.getByRole("button", { name: /Filters/ })).toHaveAttribute("aria-expanded", "false");
    unmount();
    renderWithIntl(
      <FilterBar activeFilters={filters()} panelActiveCount={2}>
        <select aria-label="Status" />
      </FilterBar>,
    );
    const toggle = screen.getByRole("button", { name: /Filters/ });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).toHaveTextContent("2");
  });

  describe("narrow viewport (mobile filter sheet, point 11)", () => {
    const originalMatchMedia = window.matchMedia;

    function mockNarrowViewport() {
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: true,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })) as unknown as typeof window.matchMedia;
    }

    afterEach(() => {
      window.matchMedia = originalMatchMedia;
    });

    it("opens the panel as a dialog overlay instead of the inline accordion", () => {
      mockNarrowViewport();
      const { container } = renderWithIntl(
        <FilterBar activeFilters={filters()} panelActiveCount={2}>
          <select aria-label="Status" />
        </FilterBar>,
      );
      // No inline panel in the toolbar itself...
      expect(container.querySelector(".filter-bar__panel")).toBeNull();
      // ...the controls are portalled into a labelled, modal dialog instead.
      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveAttribute("aria-modal", "true");
      expect(dialog).toContainElement(screen.getByLabelText("Status"));
      expect(screen.getByRole("heading", { name: /Filters/ })).toBeInTheDocument();
    });

    it("closes via the sheet's own close button, not by picking a filter", async () => {
      const user = userEvent.setup();
      mockNarrowViewport();
      renderWithIntl(
        <FilterBar activeFilters={filters()} panelActiveCount={2}>
          <select aria-label="Status" />
        </FilterBar>,
      );
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      await user.selectOptions(screen.getByLabelText("Status"), []);
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Close" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("closes on Escape", async () => {
      const user = userEvent.setup();
      mockNarrowViewport();
      renderWithIntl(
        <FilterBar activeFilters={filters()} panelActiveCount={2}>
          <select aria-label="Status" />
        </FilterBar>,
      );
      await user.keyboard("{Escape}");
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("keeps primary controls outside the panel and the chips/results visible outside it", () => {
    const { container } = renderWithIntl(
      <FilterBar
        primary={<select aria-label="Sort" />}
        activeFilters={[{ id: "q", label: "Search: x", onRemove: vi.fn() }]}
        panelActiveCount={0}
        resultText="1 of 3"
        onClear={() => {}}
      >
        <select aria-label="Status" />
      </FilterBar>,
    );
    const panel = container.querySelector(".filter-bar__panel")!;
    expect(panel).toContainElement(screen.getByLabelText("Status"));
    expect(panel).not.toContainElement(screen.getByLabelText("Sort"));
    expect(panel).not.toContainElement(screen.getByText("Search: x"));
    expect(panel).not.toContainElement(screen.getByText("1 of 3"));
    // A search-only chip does not count towards the panel toggle badge.
    expect(screen.getByRole("button", { name: /Filters/ })).not.toHaveTextContent("1");
  });
});
