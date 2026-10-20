import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

// Same-origin Operational API proxy (M5; see ADR-005 section 5 and
// ADR-006). The browser must only ever talk to this Next.js origin --
// never directly to Odoo -- so that the Odoo session_id cookie (which
// Odoo itself sets with no SameSite/Secure attribute; see ADR-005
// section 2) behaves as a normal same-origin cookie with no CORS
// configuration and no custom token scheme required.
//
// Next.js's `rewrites()` with an external destination acts as a
// transparent reverse proxy at the Next.js server layer: the full
// incoming request (method, headers -- including Cookie,
// Accept-Language, X-Request-ID -- and body) is forwarded to
// ODOO_INTERNAL_BASE_URL, and the upstream response (including
// Set-Cookie) is streamed back unmodified. Because the browser only
// ever connects to this origin, a Set-Cookie coming back through the
// proxy is scoped to THIS origin, not Odoo's -- exactly what
// same-origin session auth requires. ODOO_INTERNAL_BASE_URL is a
// server-only env var (no NEXT_PUBLIC_ prefix): the browser never
// sees or needs Odoo's real address.
const ODOO_INTERNAL_BASE_URL =
  process.env.ODOO_INTERNAL_BASE_URL ?? "http://localhost:8069";

const nextConfig: NextConfig = {
  // The password-reset token travels in the URL; never leak it through
  // the Referer header of any outbound request from that page.
  async headers() {
    return [
      {
        source: "/:locale/reset-password",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
    ];
  },
  // The trainee "My Surveys" page, and later the per-role "Training
  // Program" / "Attendance & Evaluation" / "My Reports" pages, were all
  // retired: their functionality folded into Training Days' own unified
  // toolbar (see lib/auth/roleNav.ts). Keep old bookmarks working.
  async redirects() {
    return [
      {
        source: "/:locale(ar|en)/trainee/surveys",
        destination: "/:locale/trainee/days",
        permanent: false,
      },
      {
        source: "/:locale(ar|en)/trainee/program",
        destination: "/:locale/trainee/days",
        permanent: false,
      },
      {
        source: "/:locale(ar|en)/supervisor/evaluations",
        destination: "/:locale/supervisor/days",
        permanent: false,
      },
      {
        source: "/:locale(ar|en)/trainer/reports",
        destination: "/:locale/trainer/days",
        permanent: false,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${ODOO_INTERNAL_BASE_URL}/api/v1/:path*`,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
