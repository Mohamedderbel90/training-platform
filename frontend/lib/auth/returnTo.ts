/** Same-app, locale-less path only (the i18n router adds the locale).
 * The value comes from a query string the browser controls, so anything
 * absolute, protocol-relative, backslashed or pointing back at the
 * public auth pages is rejected. */
export function safeReturnTo(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return null;
  }
  if (/^\/(login|forgot-password|reset-password)(\/|\?|$)/.test(value)) {
    return null;
  }
  return value;
}

export function loginHrefFor(path: string): string {
  const safe = safeReturnTo(path);
  return safe ? `/login?returnTo=${encodeURIComponent(safe)}` : "/login";
}
