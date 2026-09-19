"use client";

/**
 * Frontend session state (M5 point 2). This deliberately holds ONLY
 * what `GET /api/v1/auth/me` returns (id, partner_id, name, locale,
 * roles, capabilities) -- never a password, token, or anything else
 * that would make this a second credential store. Odoo's own
 * `session_id` cookie (HttpOnly, same-origin via the proxy -- see
 * ADR-005/ADR-006) is the actual credential; this context only caches
 * the *result* of asking Odoo "who am I" so pages don't all re-fetch
 * it themselves.
 */
import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useLocale } from "next-intl";
import { authApi } from "@/lib/api/endpoints";
import type { OperationalProfile, OperationalRole } from "@/lib/api/types";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  profile: OperationalProfile | null;
  /** Roles from the last successful /auth/me or /auth/login response --
   * the client NEVER decides its own role; this is purely a display/
   * routing cache of what the server already authorized (ADR-005
   * section 9). */
  roles: OperationalRole[];
  login: (login: string, password: string) => Promise<OperationalProfile>;
  logout: () => Promise<void>;
  /** Re-run the /auth/me session bootstrap (e.g. after a 401 elsewhere
   * in the app, to confirm the session is really gone before redirecting). */
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const locale = useLocale();
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [profile, setProfile] = useState<OperationalProfile | null>(null);

  const bootstrap = useCallback(async () => {
    setStatus("loading");
    try {
      const me = await authApi.me(locale);
      setProfile(me);
      setStatus("authenticated");
    } catch {
      // Any failure (no session, expired session, or a network error)
      // is treated as unauthenticated for routing purposes -- pages
      // that make their own direct API calls surface a richer error
      // state independently of this context.
      setProfile(null);
      setStatus("unauthenticated");
    }
  }, [locale]);

  useEffect(() => {
    // See useApiResource.ts's identical comment: bootstrap() sets
    // state synchronously as its first statement, so the initial,
    // effect-triggered call is wrapped in startTransition to satisfy
    // react-hooks' set-state-in-effect rule. Re-runs whenever the
    // active locale changes so a stale session check from a previous
    // language never lingers (bootstrap() itself is recreated when
    // locale changes, so this still only re-runs once per change).
    startTransition(() => {
      bootstrap();
    });
  }, [bootstrap]);

  const login = useCallback(
    async (loginValue: string, password: string) => {
      const me = await authApi.login(loginValue, password, locale);
      setProfile(me);
      setStatus("authenticated");
      return me;
    },
    [locale],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout(locale);
    } finally {
      setProfile(null);
      setStatus("unauthenticated");
    }
  }, [locale]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      profile,
      roles: profile?.roles ?? [],
      login,
      logout,
      refresh: bootstrap,
    }),
    [status, profile, login, logout, bootstrap],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
