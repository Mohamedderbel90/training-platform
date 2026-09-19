import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Next.js 16 renamed the middleware.ts file convention to proxy.ts
// (function/export name unchanged); see
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md
export default createMiddleware(routing);

export const config = {
  // Match every route except static files and Next.js internals.
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
