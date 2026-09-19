"use client";

/**
 * Route protection is UX only (M5 point 11) -- Odoo's ACLs/record
 * rules remain the real security boundary; every DTO already comes
 * back scoped to the caller by the server. This component just avoids
 * flashing a role's screen at a user who will get a 403 the instant
 * they call the API, and sends them somewhere useful instead.
 */
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useAuth } from "./AuthContext";
import { getRoleHome } from "./roleHome";
import type { OperationalRole } from "@/lib/api/types";
import { LoadingState, ErrorState } from "@/components/StateViews";

function isSafeReturnPath(path: string): boolean {
  // Only ever redirect back to a path inside this same app, never an
  // absolute/external URL (open-redirect hardening for a value that
  // ultimately comes from a query string).
  return path.startsWith("/") && !path.startsWith("//");
}

export function ProtectedRoute({
  role,
  children,
}: {
  role: OperationalRole;
  children: React.ReactNode;
}) {
  const { status, roles } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("Common");

  const hasRole = roles.includes(role);

  useEffect(() => {
    if (status === "unauthenticated") {
      const returnTo = isSafeReturnPath(pathname) ? pathname : undefined;
      router.replace(
        returnTo ? `/login?returnTo=${encodeURIComponent(returnTo)}` : "/login",
      );
    }
  }, [status, pathname, router]);

  if (status === "loading") {
    return <LoadingState label={t("loadingSession")} />;
  }

  if (status === "unauthenticated") {
    // Redirect effect above is in flight; render nothing meaningful.
    return <LoadingState label={t("loadingSession")} />;
  }

  if (!hasRole) {
    const home = getRoleHome(roles);
    return (
      <ErrorState
        title={t("forbiddenTitle")}
        message={t("forbiddenMessage")}
        actionLabel={t("goToMyDashboard")}
        onAction={() => router.replace(home)}
      />
    );
  }

  return <>{children}</>;
}
