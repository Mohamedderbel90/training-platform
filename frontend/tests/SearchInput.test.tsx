import { describe, it, expect, vi, afterEach } from "vitest";
import { act, fireEvent, screen } from "@testing-library/react";
import { useState } from "react";
import { renderWithIntl } from "./testUtils";
import { SearchInput } from "@/components/SearchInput";

function Harness({ debounceMs = 0, onChange }: { debounceMs?: number; onChange: (v: string) => void }) {
  const [v, setV] = useState("");
  return (
    <SearchInput
      value={v}
      debounceMs={debounceMs}
      onChange={(n) => {
        setV(n);
        onChange(n);
      }}
    />
  );
}

afterEach(() => vi.useRealTimers());

describe("SearchInput", () => {
  it("is a labelled search input and emits immediately without debounce", () => {
    const onChange = vi.fn();
    renderWithIntl(<Harness onChange={onChange} />);
    const input = screen.getByRole("searchbox", { name: "Search" });
    expect(input).toHaveAttribute("type", "search");
    fireEvent.change(input, { target: { value: "abc" } });
    expect(onChange).toHaveBeenLastCalledWith("abc");
  });

  it("debounces typed input", () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    renderWithIntl(<Harness debounceMs={300} onChange={onChange} />);
    const input = screen.getByRole("searchbox");
    fireEvent.change(input, { target: { value: "ab" } });
    expect(onChange).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(onChange).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("ab");
  });

  it("clear button appears only when non-empty, clears immediately and has an accessible name", () => {
    const onChange = vi.fn();
    renderWithIntl(<Harness debounceMs={300} onChange={onChange} />);
    expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(onChange).toHaveBeenLastCalledWith("");
    expect(screen.getByRole("searchbox")).toHaveValue("");
    expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull();
  });

  it("Escape clears", () => {
    const onChange = vi.fn();
    renderWithIntl(<Harness onChange={onChange} />);
    const input = screen.getByRole("searchbox");
    fireEvent.change(input, { target: { value: "hello" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onChange).toHaveBeenLastCalledWith("");
    expect(input).toHaveValue("");
  });

  it("localises label and clear name in Arabic", () => {
    renderWithIntl(<SearchInput value="س" onChange={() => {}} />, { locale: "ar" });
    expect(screen.getByRole("searchbox", { name: "بحث" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "مسح البحث" })).toBeInTheDocument();
  });
});
