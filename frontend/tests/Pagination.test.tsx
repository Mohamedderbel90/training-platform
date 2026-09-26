import { describe, it, expect, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithIntl } from "./testUtils";
import { Pagination } from "@/components/Pagination";

describe("Pagination", () => {
  it("renders nothing for a single page", () => {
    const { container } = renderWithIntl(<Pagination page={1} pageCount={1} onPageChange={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("disables previous on the first page and navigates next", () => {
    const onPageChange = vi.fn();
    renderWithIntl(<Pagination page={1} pageCount={3} onPageChange={onPageChange} />);
    expect(screen.getByRole("navigation", { name: "Pagination" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();
    expect(screen.getByText("Page 1 of 3")).toHaveAttribute("aria-current", "page");
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("disables next on the last page and navigates previous", () => {
    const onPageChange = vi.fn();
    renderWithIntl(<Pagination page={3} pageCount={3} onPageChange={onPageChange} />);
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Previous page" }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("uses direction-aware icon classes (not row-reverse) and Arabic labels", () => {
    renderWithIntl(<Pagination page={2} pageCount={4} onPageChange={() => {}} />, { locale: "ar" });
    const prev = screen.getByRole("button", { name: "الصفحة السابقة" });
    const next = screen.getByRole("button", { name: "الصفحة التالية" });
    expect(prev.querySelector(".icon-prev")).not.toBeNull();
    expect(next.querySelector(".icon-next")).not.toBeNull();
    expect(screen.getByText("الصفحة 2 من 4")).toBeInTheDocument();
  });

  it("offers a page-size select when requested", () => {
    const onSize = vi.fn();
    renderWithIntl(
      <Pagination page={1} pageCount={1} onPageChange={() => {}} pageSize={10} pageSizeOptions={[10, 25]} onPageSizeChange={onSize} />,
    );
    fireEvent.change(screen.getByRole("combobox", { name: "Items per page" }), { target: { value: "25" } });
    expect(onSize).toHaveBeenCalledWith(25);
  });
});
