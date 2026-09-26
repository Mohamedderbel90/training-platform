import { describe, it, expect, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithIntl } from "./testUtils";
import { EmptyState, ErrorState } from "@/components/StateViews";

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
  it("shows a Reference line with the request id only when present", () => {
    const { unmount } = renderWithIntl(<ErrorState title="T" message="M" requestId="req_9" />);
    expect(screen.getByText(/Reference/)).toBeInTheDocument();
    expect(screen.getByText("req_9")).toBeInTheDocument();
    unmount();
    renderWithIntl(<ErrorState title="T" message="M" />);
    expect(screen.queryByText(/Reference/)).toBeNull();
  });
});
