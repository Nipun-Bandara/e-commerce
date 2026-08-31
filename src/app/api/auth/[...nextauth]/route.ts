import { handlers } from "@/auth";

/**
 * Auth.js's own endpoints, mounted at /api/auth/*.
 *
 * The app signs in and out through Server Actions rather than by posting here,
 * but the route still has to exist: Auth.js issues its CSRF token and resolves
 * the session from these handlers, and `signIn()` calls into them internally.
 */
export const { GET, POST } = handlers;
