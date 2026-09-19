// M10 deployment requirement: "Frontend/backend health checks."
// Deliberately outside the `[locale]` segment (proxy.ts's matcher
// already excludes `/api/*` from locale routing) and independent of
// Odoo: this only confirms the Next.js server process itself is up,
// so a load balancer can distinguish "frontend is down" from
// "frontend is up but Odoo is unreachable" (checked separately via
// GET /api/v1/health, proxied straight through to Odoo).
export async function GET() {
  return Response.json({ status: "ok" });
}
