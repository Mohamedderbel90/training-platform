import { describe, it, expect, vi, afterEach } from "vitest";
import { act, screen, fireEvent, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { renderWithIntl } from "./testUtils";
import { FormField } from "@/components/FormField";
import { PasswordField } from "@/components/PasswordField";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { LiveStatus } from "@/components/LiveStatus";
import { SubmitButton } from "@/components/SubmitButton";
import { FormError } from "@/components/FormError";
import { ApiError } from "@/lib/api/client";

vi.mock("@/i18n/navigation", () => import("./mocks/i18nNavigation"));

describe("FormField", () => {
  it("wires label, required text, helper and error to the control", () => {
    renderWithIntl(
      <FormField id="f" label="Name" required hint="As on your ID" error="Enter a name">
        {(c) => <input {...c} />}
      </FormField>,
    );
    const input = screen.getByRole("textbox", { name: /Name/ });
    expect(input).toBeRequired();
    expect(input).toHaveAttribute("aria-invalid", "true");
    const describedBy = input.getAttribute("aria-describedby")!.split(" ");
    expect(describedBy).toHaveLength(2);
    expect(document.getElementById(describedBy[0])).toHaveTextContent("As on your ID");
    expect(document.getElementById(describedBy[1])).toHaveTextContent("Enter a name");
    // Required is conveyed in text, not just by the asterisk.
    expect(screen.getByText("(required)")).toHaveClass("visually-hidden");
    expect(screen.getByText("*")).toHaveAttribute("aria-hidden", "true");
  });

  it("has no aria-invalid / describedby when there is no error or hint", () => {
    renderWithIntl(<FormField id="f" label="Name">{(c) => <input {...c} />}</FormField>);
    const input = screen.getByLabelText("Name");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).not.toHaveAttribute("aria-describedby");
  });
});

describe("PasswordField", () => {
  it("toggles visibility with an accessible button and keeps focus on it", async () => {
    renderWithIntl(
      <PasswordField id="p" label="Password" autoComplete="current-password" value="secret" onChange={vi.fn()} />,
    );
    const input = screen.getByLabelText("Password");
    expect(input).toHaveAttribute("type", "password");
    expect(input).toHaveAttribute("autocomplete", "current-password");
    const toggle = screen.getByRole("button", { name: "Show password" });
    await userEvent.click(toggle);
    expect(input).toHaveAttribute("type", "text");
    expect(toggle).toHaveFocus();
    expect(screen.getByRole("button", { name: "Hide password" })).toBe(toggle);
  });
});

describe("ConfirmDialog", () => {
  function Harness({ onConfirm = vi.fn() }: { onConfirm?: () => void }) {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button onClick={() => setOpen(true)}>Open</button>
        <ConfirmDialog
          open={open}
          title="Sure?"
          message="Cannot be undone"
          confirmLabel="Yes"
          cancelLabel="No"
          onConfirm={onConfirm}
          onCancel={() => setOpen(false)}
        />
      </>
    );
  }

  it("is a labelled modal dialog, focuses inside, traps Tab, closes on Escape and returns focus", async () => {
    renderWithIntl(<Harness />);
    const opener = screen.getByRole("button", { name: "Open" });
    opener.focus();
    await userEvent.click(opener);

    const dialog = screen.getByRole("dialog", { name: "Sure?" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription("Cannot be undone");
    const yes = screen.getByRole("button", { name: "Yes" });
    const no = screen.getByRole("button", { name: "No" });
    expect(no).toHaveFocus();

    await userEvent.tab();
    expect(yes).toHaveFocus(); // wrapped from last to first
    await userEvent.tab({ shift: true });
    expect(no).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(yes).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(no).toHaveFocus();

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it("locks body scroll and inerts the rest of the app while open, restoring both on close", async () => {
    const { container } = renderWithIntl(<Harness />);
    document.body.style.overflow = "auto";
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(document.body.style.overflow).toBe("hidden");
    const app = container.parentElement === document.body ? container : (container as HTMLElement);
    expect(app).toHaveAttribute("inert");
    expect(app).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(document.body.style.overflow).toBe("auto");
    expect(app).not.toHaveAttribute("inert");
    expect(app).not.toHaveAttribute("aria-hidden");
    document.body.style.overflow = "";
  });

  it("returns focus to the fallback when the opener is disabled as the dialog closes", async () => {
    function BusyHarness() {
      const [open, setOpen] = useState(false);
      const [busy, setBusy] = useState(false);
      const fallback = useRef<HTMLDivElement>(null);
      return (
        <div ref={fallback} tabIndex={-1} data-testid="fallback">
          <button disabled={busy} onClick={() => setOpen(true)}>
            Submit
          </button>
          <ConfirmDialog
            open={open}
            title="Sure?"
            message="m"
            confirmLabel="Yes"
            cancelLabel="No"
            returnFocusFallbackRef={fallback}
            onConfirm={() => {
              setOpen(false);
              setBusy(true);
            }}
            onCancel={() => setOpen(false)}
          />
        </div>
      );
    }
    renderWithIntl(<BusyHarness />);
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    await userEvent.click(screen.getByRole("button", { name: "Yes" }));
    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
    expect(screen.getByTestId("fallback")).toHaveFocus();
  });

  it("confirms via the confirm button", async () => {
    const onConfirm = vi.fn();
    renderWithIntl(<Harness onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    await userEvent.click(screen.getByRole("button", { name: "Yes" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

describe("LiveStatus", () => {
  afterEach(() => vi.useRealTimers());

  it("announces a message in a status region and clears itself", () => {
    vi.useFakeTimers();
    const { rerender } = render(<LiveStatus message="Saved" stamp={null} clearAfterMs={1000} />);
    const region = screen.getByRole("status");
    expect(region).toBeEmptyDOMElement();
    rerender(<LiveStatus message="Saved" stamp={1} clearAfterMs={1000} />);
    expect(region).toHaveTextContent("Saved");
    act(() => {
      vi.advanceTimersByTime(1001);
    });
    expect(region).toBeEmptyDOMElement();
    // A new event shows it again.
    rerender(<LiveStatus message="Saved" stamp={2} clearAfterMs={1000} />);
    expect(region).toHaveTextContent("Saved");
  });
});

describe("SubmitButton", () => {
  it("shows the loading label, is disabled and aria-busy while loading", () => {
    render(
      <SubmitButton loading loadingLabel="Saving...">
        Save
      </SubmitButton>,
    );
    const button = screen.getByRole("button", { name: "Saving..." });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });
});

describe("FormError", () => {
  it("shows the server message without the request id and takes focus", () => {
    const error = new ApiError({ code: "VALIDATION_ERROR", message: "Bad input.", fields: null }, 422, "req_9");
    const { container } = renderWithIntl(<FormError error={error} />);
    expect(screen.getByText("Bad input.")).toBeInTheDocument();
    expect(screen.queryByText("req_9")).not.toBeInTheDocument();
    expect(container.querySelector(".form-error")).toHaveFocus();
  });

  it("renders nothing without an error", () => {
    const { container } = renderWithIntl(<FormError error={null} />);
    expect(container.querySelector(".form-error")).toBeNull();
    fireEvent.focus(document.body);
  });
});
