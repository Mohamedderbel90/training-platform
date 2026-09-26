import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, act } from "@testing-library/react";
import { renderWithIntl } from "./testUtils";
import { AppShell } from "@/components/AppShell";
import { FormField } from "@/components/FormField";
import { SubmittedState } from "@/components/SubmittedState";
import { useAuth } from "@/lib/auth/AuthContext";
import { __setMockPathname } from "./mocks/i18nNavigation";

vi.mock("@/i18n/navigation", () => import("./mocks/i18nNavigation"));
vi.mock("@/lib/auth/AuthContext", () => ({ useAuth: vi.fn() }));

function signedInAsTrainee() {
  vi.mocked(useAuth).mockReturnValue({
    status: "authenticated",
    profile: { id: 1, partner_id: 1, name: "Dev Trainee", locale: "en_US", roles: ["trainee"], capabilities: [] },
    roles: ["trainee"],
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
  });
}

describe("AppShell page entrance", () => {
  beforeEach(() => {
    __setMockPathname("/trainee");
    signedInAsTrainee();
  });

  it("wraps page content in a route-keyed .page-enter element inside <main>", () => {
    renderWithIntl(
      <AppShell>
        <div>page body</div>
      </AppShell>,
    );
    const wrapper = screen.getByText("page body").parentElement!;
    expect(wrapper).toHaveClass("page-enter");
    expect(wrapper.parentElement).toBe(screen.getByRole("main"));
  });

  it("re-mounts the wrapper on a route change but not on a same-route re-render", () => {
    const { rerender } = renderWithIntl(
      <AppShell>
        <div>page body</div>
      </AppShell>,
    );
    const first = screen.getByText("page body").parentElement!;

    // Same pathname (e.g. a filter/search re-render): same element, no replay.
    rerender(
      <AppShell>
        <div>page body</div>
      </AppShell>,
    );
    expect(screen.getByText("page body").parentElement).toBe(first);

    // New pathname: keyed wrapper is replaced, so the entrance replays.
    __setMockPathname("/trainee/days");
    rerender(
      <AppShell>
        <div>page body</div>
      </AppShell>,
    );
    expect(screen.getByText("page body").parentElement).not.toBe(first);
  });
});

describe("AppShell focus management", () => {
  beforeEach(() => {
    __setMockPathname("/trainee");
    signedInAsTrainee();
  });

  it("moves focus into the drawer on open and back to the menu button on Escape", () => {
    renderWithIntl(
      <AppShell>
        <div>page body</div>
      </AppShell>,
    );
    const toggle = screen.getByRole("button", { name: "Menu" });
    fireEvent.click(toggle);
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(toggle).toHaveFocus();
  });

  it("closes the notifications popover on outside click and on Escape (focus back to the bell)", () => {
    renderWithIntl(
      <AppShell>
        <div>page body</div>
      </AppShell>,
    );
    const bell = screen.getByRole("button", { name: "Notifications" });
    fireEvent.click(bell);
    expect(screen.getByRole("dialog", { name: "Notifications" })).toBeInTheDocument();

    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(bell);
    act(() => bell.focus());
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(bell).toHaveFocus();
  });
});

describe("FormField", () => {
  it("passes labelId separately so spreading the control props leaks no unknown DOM attribute", () => {
    let received = "";
    renderWithIntl(
      <FormField id="f" label="Name">
        {(control, labelId) => {
          received = labelId;
          return <input {...control} />;
        }}
      </FormField>,
    );
    expect(received).toBe("f-label");
    expect(screen.getByLabelText("Name")).not.toHaveAttribute("labelid");
  });

  it("reserves a message slot in the icon (auth) layout so an error never shifts the layout", () => {
    const { container, rerender } = renderWithIntl(
      <FormField id="f" label="Name" icon={<span />}>
        {(c) => <input {...c} />}
      </FormField>,
    );
    const slot = container.querySelector(".field__messages");
    expect(slot).toBeInTheDocument();
    expect(slot).toBeEmptyDOMElement();
    rerender(
      <FormField id="f" label="Name" icon={<span />} error="Required">
        {(c) => <input {...c} />}
      </FormField>,
    );
    expect(container.querySelector(".field__messages")).toBe(slot);
    expect(slot).toHaveTextContent("Required");
  });
});

describe("SubmittedState heading", () => {
  it("renders an h2 by default and an h1 when it is the whole page", () => {
    vi.mocked(useAuth).mockReturnValue({ profile: null } as never);
    const { rerender } = renderWithIntl(<SubmittedState />);
    expect(screen.getByRole("heading", { level: 2, name: "Thank you" })).toBeInTheDocument();
    rerender(<SubmittedState headingLevel={1} />);
    expect(screen.getByRole("heading", { level: 1, name: "Thank you" })).toBeInTheDocument();
  });
});
