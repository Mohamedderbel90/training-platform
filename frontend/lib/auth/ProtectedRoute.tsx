"use client";

/**
 * Route protection is UX only (M5 point 11) -- Odoo's ACLs/record
 * rules remain the real security boundary; every DTO already comes
 * back scoped to the caller by the server. This component just avoids
 * flashing a role's screen at a user who will get a 403 the instant
 * they call the API, and sends them somewhere useful instead.
 */
import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useAuth } from "./AuthContext";
import { getRoleHome } from "./roleHome";
import { loginHrefFor } from "./returnTo";
import type { OperationalRole } from "@/lib/api/types";
import { LoadingState, ErrorState } from "@/components/StateViews";
import { NoRoleState } from "@/components/NoRoleState";

export function ProtectedRoute({
  role,
  children,
}: {
  /** Omit for a screen any authenticated operational user may see
   * regardless of which specific role(s) they hold (e.g. `/profile`,
   * a PROJECT_SPEC section 9 "Shared" screen) -- only session status
   * is checked in that case, not a specific role membership. */
  role?: OperationalRole;
  children: React.ReactNode;
}) {
  const { status, roles } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("Common");
  // A visitor who arrives already logged out is sent back to the page
  // they asked for after signing in. A session that ends while this
  // page is open (logout, expiry) goes to a plain /login so the next
  // person to sign in on the device isn't taken to this user's page.
  const wasAuthenticated = useRef(false);

  const hasRole = role ? roles.includes(role) : true;

  useEffect(() => {
    if (status === "authenticated") {
      wasAuthenticated.current = true;
    }
    if (status === "unauthenticated") {
      router.replace(wasAuthenticated.current ? "/login" : loginHrefFor(pathname));
    }
  }, [status, router, pathname]);

  if (status === "loading") {
    return <LoadingState label={t("loadingSession")} />;
  }

  if (status === "unauthenticated") {
    // Redirect effect above is in flight; render nothing meaningful.
    return <LoadingState label={t("loadingSession")} />;
  }

  if (!hasRole && roles.length === 0) {
    return <NoRoleState />;
  }

  if (!hasRole) {
    const home = getRoleHome(roles);
    return (
      <ErrorState
        headingLevel={1}
        title={t("forbiddenTitle")}
        message={t("forbiddenMessage")}
        actionLabel={t("goToMyDashboard")}
        onAction={() => router.replace(home)}
      />
    );
  }

  return <>{children}</>;
}
