"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { getRoleHome } from "@/lib/auth/roleHome";
import { LoadingState } from "@/components/StateViews";
import { NoRoleState } from "@/components/NoRoleState";

/** Landing route: never a screen of its own -- it only decides where
 * to send the visitor (M5 point 2's "session bootstrap"). */
export default function HomePage() {
  const t = useTranslations("Common");
  const { status, roles } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    } else if (status === "authenticated" && roles.length > 0) {
      router.replace(getRoleHome(roles));
    }
  }, [status, roles, router]);

  if (status === "authenticated" && roles.length === 0) {
    return <NoRoleState />;
  }

  return <LoadingState label={t("loadingSession")} />;
}
