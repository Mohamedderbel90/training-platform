import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// jsdom does no layout, so the 44px rule is checked in the stylesheet;
// the rendered sizes were measured live in a 390px browser.
const css = readFileSync(join(__dirname, "../app/globals.css"), "utf8");

function mobileRule(selector: string): string | null {
  const re = new RegExp(`@media \\(max-width: 640px\\) \\{\\s*${selector.replace(/[.\[\]="]/g, "\\$&")} \\{([^}]*)\\}`);
  return css.match(re)?.[1] ?? null;
}

describe("mobile touch targets", () => {
  it.each([".back-link", ".auth-page__lang-switch a"])("%s is at least 44px high on phones", (selector) => {
    expect(mobileRule(selector)).toMatch(/min-height:\s*2\.75rem/);
  });
});

// Mobile layout rules added with the UX audit (DI-2 / DI-3 / DI-4). jsdom does
// no layout, so these guard the stylesheet; the rendered result was checked
// live at 390px.
describe("mobile layout rules", () => {
  it("DI-2: attendance rows are single-line flex rows on phones", () => {
    expect(css).toMatch(/\.data-table--stacked tbody tr \{\s*display: flex;\s*flex-wrap: wrap;/);
  });

  it("DI-3: the three summary tiles keep one row on narrow containers", () => {
    expect(css).toMatch(/@container \(max-width: 479\.98px\) \{\s*\.stat-grid--three \{\s*grid-template-columns: repeat\(3,/);
  });

  it("DI-4: the program strip is hidden by default and shown on phones", () => {
    expect(css).toMatch(/\.program-strip \{\s*display: none;/);
    expect(css).toMatch(/@media \(max-width: 560px\) \{[^@]*\.program-strip \{\s*display: block;/);
  });
});

describe("footer layout", () => {
  it("wide footers put the links on the physical right, out of flow, beside the centred note", () => {
    expect(css).toMatch(/@container \(min-width: 760px\) \{[\s\S]*?\.app-footer__nav \{\s*position: absolute;\s*right: var\(--space-4\);/);
  });
});
