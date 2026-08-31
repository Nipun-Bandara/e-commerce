import "server-only";

import { forbidden, redirect } from "next/navigation";

import { auth } from "@/auth";
import type { Role } from "@/generated/prisma/enums";
import { loginPath } from "@/lib/callback-url";

/**
 * Reading the session, and the two guards that act on it.
 *
 * The proxy redirects unauthenticated visitors away from protected paths, but
 * it is an optimistic check: it sees a signed cookie, not the page's own rules,
 * and it never runs for a Server Action. These helpers are the real gate, and
 * every page and action under /account and /admin calls one of them.
 */

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

/**
 * The signed-in user, or `null`.
 *
 * Read straight from the session token, so it costs no query. That also means
 * it reflects the account as it was when the token was issued — anything that
 * must be current (stock, orders, a role that may have been revoked) has to be
 * fetched from the database with the id.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth();
  if (!session?.user) return null;

  const { id, name, email, role } = session.user;

  // `name` and `email` are optional on Auth.js's session type even though both
  // are non-null columns. Defaulting beats asserting.
  return { id, name: name ?? "", email: email ?? "", role };
}

/**
 * Demand a signed-in user, or send the visitor to the login page.
 *
 * `callbackUrl` is what they come back to afterwards. A Server Component cannot
 * discover its own URL, so pass it explicitly where the return trip matters;
 * omitted, login returns to the home page.
 */
export async function requireAuth(callbackUrl?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(loginPath(callbackUrl));

  return user;
}

/**
 * Demand an administrator.
 *
 * A signed-in non-admin gets a 403, not a redirect: bouncing them to login
 * would be a lie — they are logged in — and would loop straight back here the
 * moment login succeeded.
 */
export async function requireAdmin(callbackUrl?: string): Promise<CurrentUser> {
  const user = await requireAuth(callbackUrl);
  if (user.role !== "ADMIN") forbidden();

  return user;
}
