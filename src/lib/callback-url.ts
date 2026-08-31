/**
 * Where to send someone after they sign in.
 *
 * The destination arrives in a query string, which means an attacker can put
 * anything in it and send the link to someone else. `?callbackUrl=https://evil.example`
 * on a page that redirects wherever it is told is an open redirect: the victim
 * sees this site's domain in the link, lands on the attacker's, and the login
 * page they are shown there looks exactly right.
 *
 * So a callback is only ever a path on this site. Not a URL, not a protocol —
 * a path. Anything else falls back to the home page rather than erroring,
 * because a mangled callback is not worth a failed login.
 */

/** Where a visitor with nowhere in particular to go ends up. */
const DEFAULT_CALLBACK = "/";

/**
 * Reduce an untrusted value to a safe same-site path.
 *
 * Rejected: absolute URLs, protocol-relative `//evil.example` (a URL wearing a
 * path's clothes), and the backslash variant `/\evil.example`, which some
 * browsers normalise into the same thing. What survives is a string that
 * begins with exactly one `/`.
 */
export function safeCallbackUrl(value: unknown): string {
  if (typeof value !== "string") return DEFAULT_CALLBACK;
  if (!value.startsWith("/")) return DEFAULT_CALLBACK;
  if (value.startsWith("//") || value.startsWith("/\\")) return DEFAULT_CALLBACK;

  return value;
}

/** The login URL that returns to `callbackUrl` once signed in. */
export function loginPath(callbackUrl?: string): string {
  const target = safeCallbackUrl(callbackUrl);
  if (target === DEFAULT_CALLBACK) return "/login";

  return `/login?callbackUrl=${encodeURIComponent(target)}`;
}
