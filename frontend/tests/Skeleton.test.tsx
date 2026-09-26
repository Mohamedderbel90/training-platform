import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithIntl } from "./testUtils";
import { Skeleton, SkeletonCard, SkeletonRows, SkeletonTable } from "@/components/Skeleton";
import { LoadingState } from "@/components/StateViews";

describe("Skeleton", () => {
  it("bare skeleton is aria-hidden", () => {
    const { container } = renderWithIntl(<Skeleton width={10} />);
    expect(container.querySelector(".skeleton")).toHaveAttribute("aria-hidden", "true");
  });

  it.each([
    ["card", <SkeletonCard key="c" label="Loading" />],
    ["rows", <SkeletonRows key="r" label="Loading" />],
    ["table", <SkeletonTable key="t" label="Loading" />],
  ])("%s exposes exactly one status label and hides shapes", (_n, ui) => {
    const { container } = renderWithIntl(ui);
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent("Loading");
    expect(container.querySelector(".skeleton-group__body")).toHaveAttribute("aria-hidden", "true");
  });

  it("group without label is fully aria-hidden", () => {
    const { container } = renderWithIntl(<SkeletonCard />);
    expect(screen.queryByRole("status")).toBeNull();
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });

  it("LoadingState skeleton variant has a single status label", () => {
    renderWithIntl(<LoadingState label="Loading days" variant="skeleton" />);
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByText("Loading days")).toHaveClass("visually-hidden");
  });

  it("LoadingState default is still the spinner", () => {
    const { container } = renderWithIntl(<LoadingState label="Loading" />);
    expect(container.querySelector(".spinner")).not.toBeNull();
  });
});
