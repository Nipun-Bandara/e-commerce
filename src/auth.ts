import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { authConfig } from "@/auth.config";
import { verifyCredentials } from "@/server/users";

/**
 * The application's Auth.js instance.
 *
 * Lives at the root of `src/` rather than under `server/` because it is not a
 * data-access module: it is wiring that `src/app/api/auth/[...nextauth]/route.ts`,
 * the sign-in actions and `src/server/auth.ts` all mount. The database work it
 * needs is delegated to `src/server/users.ts`, which keeps the "prisma is
 * imported in two places" rule intact.
 *
 * Not for use in pages or components — go through `src/server/auth.ts`, which
 * wraps `auth()` in helpers that return exactly what a caller needs.
 */

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,

  providers: [
    Credentials({
      // Auth.js renders a sign-in form from this when it has one of its own to
      // show. Ours is at /login, so these fields exist purely to declare what
      // `authorize` receives.
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },

      /**
       * The credentials arrive over the network, so they are `unknown` no
       * matter what the type says. Shape is checked here; the sign-in action
       * has already run the same values through Zod, and neither check trusts
       * the other.
       *
       * Returning `null` is how Auth.js is told the attempt failed. It never
       * distinguishes an unknown email from a wrong password, and neither does
       * anything downstream.
       */
      async authorize(credentials) {
        const email = credentials?.email;
        const password = credentials?.password;

        if (typeof email !== "string" || typeof password !== "string") {
          return null;
        }

        return verifyCredentials(email, password);
      },
    }),
  ],
});
