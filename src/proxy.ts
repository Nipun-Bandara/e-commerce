import { NextResponse } from "next/server";
import NextAuth from "next-auth";

import { authConfig } from "@/auth.config";
import { loginPath } from "@/lib/callback-url";

/**
 * Route protection, run before a matched request reaches the app.
 *
 * Next 16 renamed Middleware to Proxy; the file is `src/proxy.ts` and the
 * export is `proxy`. Same feature, and it now runs on the Node.js runtime.
 *
 * **This is an optimistic check, not the authorisation.** All it does is read
 * an already-issued session cookie. It never runs for a Server Action, it sees
 * no page's own rules, and a bug in the matcher below silently exposes whatever
 * it stops matching. What it buys is the redirect: someone who is not logged in
 * is sent to the login page instead of loading a page that would only redirect
 * them from the inside. The real gate is `requireAuth` / `requireAdmin` in
 * `src/server/auth.ts`, and every protected page calls one.
 *
 * The role check is deliberately *not* here. A non-admin needs a 403 page, and
 * a proxy can redirect or rewrite but cannot render one with the right status.
 * `requireAdmin` does it, in `src/app/admin/layout.tsx`, for every route below
 * /admin.
 *
 * Auth.js is instantiated from `authConfig` alone — no provider, no database,
 * no bcrypt. See the note in `src/auth.config.ts`.
 */

const { auth } = NextAuth(authConfig);

/** Signed in, these are pointless; a logged-in visitor is sent home instead. */
const GUEST_ONLY_PATHS = new Set(["/login", "/register"]);

export const proxy = auth((request) => {
  const { nextUrl } = request;
  const isLoggedIn = Boolean(request.auth?.user);

  if (GUEST_ONLY_PATHS.has(nextUrl.pathname)) {
    return isLoggedIn
      ? NextResponse.redirect(new URL("/", nextUrl))
      : NextResponse.next();
  }

  if (!isLoggedIn) {
    // `pathname + search` so a filtered or paginated URL survives the round
    // trip. `loginPath` is what keeps the value from becoming an open redirect
    // when it comes back.
    const target = `${nextUrl.pathname}${nextUrl.search}`;
    return NextResponse.redirect(new URL(loginPath(target), nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  // Only these paths. Everything else — the catalogue, the cart, the sign-in
  // endpoints — is public and must not pay for a session read on every request.
  //
  // `/checkout` exactly, not `/checkout/:path*`. A confirmation page under it
  // answers a stranger with 404 rather than a redirect, precisely so that order
  // numbers cannot be probed; a redirect to login would tell them the URL was
  // worth signing in for.
  matcher: [
    "/account/:path*",
    "/admin/:path*",
    "/checkout",
    "/login",
    "/register",
  ],
};
