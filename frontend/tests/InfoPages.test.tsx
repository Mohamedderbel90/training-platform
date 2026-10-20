import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithIntl } from "./testUtils";
import HelpPage from "@/app/[locale]/help/page";
import TermsPage from "@/app/[locale]/terms/page";
import PrivacyPage from "@/app/[locale]/privacy/page";
import { useAuth } from "@/lib/auth/AuthContext";
import { ACCOUNT_NAV, FOOTER_NAV } from "@/lib/auth/roleNav";
import { SUPPORT_EMAIL } from "@/lib/config/contact";
import en from "@/messages/en.json";
import ar from "@/messages/ar.json";

vi.mock("@/i18n/navigation", () => import("./mocks/i18nNavigation"));
vi.mock("@/lib/auth/AuthContext", () => ({ useAuth: vi.fn() }));

function signedIn() {
  vi.mocked(useAuth).mockReturnValue({
    status: "authenticated",
    profile: { id: 1, partner_id: 1, name: "Dev Trainee", locale: "en_US", roles: ["trainee"], capabilities: [] },
    roles: ["trainee"],
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
  });
}

describe("Help, Terms and Privacy pages (DEC-50, DEC-51)", () => {
  it("Help shows the approved contact as a mailto link", () => {
    signedIn();
    renderWithIntl(<HelpPage />);
    expect(screen.getByRole("heading", { name: "Help" })).toBeInTheDocument();
    for (const link of screen.getAllByRole("link", { name: SUPPORT_EMAIL })) {
      expect(link).toHaveAttribute("href", `mailto:${SUPPORT_EMAIL}`);
    }
    expect(screen.queryByText(/\{email\}/)).not.toBeInTheDocument();
  });

  it("Privacy states retention until requested and anonymisation", () => {
    signedIn();
    renderWithIntl(<PrivacyPage />);
    expect(screen.getByRole("heading", { name: "Privacy notice" })).toBeInTheDocument();
    expect(screen.getByText(/until you ask us to delete it/)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: SUPPORT_EMAIL }).length).toBeGreaterThan(0);
  });

  it("Terms renders without a contact link", () => {
    signedIn();
    renderWithIntl(<TermsPage />);
    expect(screen.getByRole("heading", { name: "Terms of use" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: SUPPORT_EMAIL })).not.toBeInTheDocument();
  });

  it("the sidebar keeps only Profile; Help, Terms and Privacy live in the footer", () => {
    expect(ACCOUNT_NAV.map((item) => item.key)).toEqual(["profile"]);
    expect(FOOTER_NAV.map((item) => item.key)).toEqual(["help", "terms", "privacy"]);
    expect(FOOTER_NAV.map((item) => item.href)).toEqual(["/help", "/terms", "/privacy"]);
  });

  it("Arabic and English catalogs have the same Info structure", () => {
    for (const section of ["help", "terms", "privacy"] as const) {
      expect(ar.Info[section].blocks).toHaveLength(en.Info[section].blocks.length);
    }
  });
});
