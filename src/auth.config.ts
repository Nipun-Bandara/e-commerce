import type { DefaultSession, NextAuthConfig } from "next-auth";
// Imported for its side effect only: TypeScript will not let a module be
// augmented until it has been loaded, and the JWT augmentation below needs it.
import "next-auth/jwt";

import type { Role } from "@/generated/prisma/enums";

/**
 * The half of the Auth.js configuration that carries no dependencies.
 *
 * Auth.js is instantiated twice: once in [`src/auth.ts`](./auth.ts) with the
 * Credentials provider for the app, and once in [`src/proxy.ts`](./proxy.ts) to
 * read the session on protected routes. Only the app instance may reach the
 * database or bcrypt — the proxy runs on every matched request and has no
 * business opening a connection pool to decide whether a cookie exists.
 *
 * So `providers` is deliberately empty here. Verifying a password needs the
 * provider; *reading* an already-issued token does not, and that is all the
 * proxy does.
 *
 * There is no Prisma adapter. An adapter stores accounts, sessions and
 * verification tokens, which needs three tables this schema does not have — and
 * the schema is fixed. It would also be dead weight: the `jwt` session strategy
 * that the Credentials provider requires keeps the session in the cookie, so
 * Auth.js never asks an adapter to persist one. Credentials are checked against
 * the `User` table directly in `src/server/users.ts`.
 */

/**
 * What the app puts on the session on top of Auth.js's defaults.
 *
 * `role` is read from the token, never from the request, so a client cannot ask
 * to be an admin. `id` is non-optional here because the `jwt` callback below
 * always sets it.
 */
declare module "next-auth" {
  interface User {
    role: Role;
  }

  interface Session {
    user: {
      id: string;
      role: Role;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
  }
}

export const authConfig = {
  // Self-hosted deployments have no platform-provided host to trust, and
  // without this Auth.js refuses to serve its endpoints in production.
  trustHost: true,

  // Credentials only works with `jwt`: a database session would need an
  // adapter, and there is none. See the note above.
  session: { strategy: "jwt" },

  pages: {
    // Auth.js's own sign-in screen is never shown; anything it would redirect
    // to lands on ours instead.
    signIn: "/login",
  },

  callbacks: {
    /**
     * `user` is only present on the request that signs in. Everything copied
     * onto the token then rides along in the cookie until it expires, so the
     * session is readable without a query — including in the proxy.
     *
     * The flip side: a role changed in the database does not reach an already
     * issued token. Anything that must not go stale has to be re-read from the
     * database at the point of use.
     */
    jwt({ token, user }) {
      if (user) {
        token.id = user.id ?? token.sub ?? "";
        token.role = user.role;
      }

      return token;
    },

    session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;

      return session;
    },
  },

  providers: [],
} satisfies NextAuthConfig;
