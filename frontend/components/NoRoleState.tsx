"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { ErrorState } from "@/components/StateViews";

/** Shown to a signed-in account that holds none of the operational
 * roles (trainee/supervisor/trainer), e.g. a back-office admin who
 * reached this UI. There is no role home to route to, so instead of an
 * endless "checking session" spinner offer the only useful action:
 * sign out. The GS/admin experience lives in Odoo, not here. */
export function NoRoleState() {
  const t = useTranslations("Common");
  const { logout } = useAuth();
  const router = useRouter();
  return (
    <ErrorState
      title={t("noRoleTitle")}
      message={t("noRoleMessage")}
      actionLabel={t("logout")}
      onAction={async () => {
        await logout();
        router.replace("/login");
      }}
    />
  );
}
