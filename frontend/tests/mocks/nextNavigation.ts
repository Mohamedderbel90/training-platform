/** Shared mock for "next/navigation" -- only `useSearchParams` is used
 * anywhere in this app (the login page's `returnTo` query param). */
let params = new URLSearchParams();

export function __setMockSearchParams(next: Record<string, string>) {
  params = new URLSearchParams(next);
}

export function useSearchParams() {
  return params;
}
