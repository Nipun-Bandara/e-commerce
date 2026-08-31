import "server-only";

import bcrypt from "bcrypt";

import { Prisma } from "@/generated/prisma/client";
import { Role } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

/**
 * User accounts: the only module that reads or writes a password hash.
 *
 * Nothing here takes a role from its caller. `createUser` hard-codes
 * {@link Role.USER}, so a `role` field smuggled into a sign-up form has nothing
 * to bind to — promoting an account is a database operation, not a request.
 *
 * Passwords are hashed with bcrypt at cost 12: roughly a quarter of a second
 * per hash on current hardware, which is imperceptible on a login and ruinous
 * on an offline dictionary attack. Raise it as hardware improves; bcrypt stores
 * the cost inside the hash, so old hashes keep verifying at their old cost.
 */

/** Work factor. Each increment doubles the time it takes to hash. */
const BCRYPT_COST = 12;

/**
 * A valid bcrypt hash of a value nobody knows, compared against when the email
 * does not exist.
 *
 * Without it, a missing account returns in microseconds while a real one costs
 * a full bcrypt round, and the difference is enough to enumerate which emails
 * are registered. Hashing at the same cost either way removes the signal that
 * the generic "Invalid email or password" message is there to hide.
 */
const DUMMY_PASSWORD_HASH =
  "$2b$12$wbH9/x252OnKWGdSOL1qwOdxuptQe0B099w/ego8/USlIDY.cyB9e";

export type AuthenticatedUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

/** Emails are compared case-insensitively, so they are stored one way only. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Hash a plaintext password. The only place bcrypt.hash is called. */
export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export async function getUserByEmail(
  email: string,
): Promise<AuthenticatedUser | null> {
  return prisma.user.findUnique({
    where: { email: normalizeEmail(email) },
    select: { id: true, email: true, name: true, role: true },
  });
}

export async function getUserById(
  id: string,
): Promise<AuthenticatedUser | null> {
  return prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, name: true, role: true },
  });
}

/**
 * Check an email and password against the stored hash.
 *
 * Returns `null` for every kind of failure — unknown email, wrong password, an
 * account with no password set — and never says which. The caller has one
 * message for all of them, and this signature is what keeps it that way.
 */
export async function verifyCredentials(
  email: string,
  password: string,
): Promise<AuthenticatedUser | null> {
  const user = await prisma.user.findUnique({
    where: { email: normalizeEmail(email) },
    select: { id: true, email: true, name: true, role: true, passwordHash: true },
  });

  // `passwordHash` is nullable in the schema, and the seed writes a placeholder
  // that is not a bcrypt hash at all. Both are "cannot log in", and both still
  // pay for a comparison so they take as long as a wrong password.
  const hash = user?.passwordHash ?? DUMMY_PASSWORD_HASH;
  const matches = await bcrypt.compare(password, hash);

  if (!user || !matches) return null;

  // Rebuilt field by field rather than spread minus the hash: the return type
  // is what callers put on a session, and nothing should reach it by accident.
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

export type CreateUserResult =
  | { status: "created"; user: AuthenticatedUser }
  | { status: "email-taken" };

/**
 * Register a new account.
 *
 * The duplicate check is the `@unique` index on `email`, not a `findUnique`
 * before the insert: two sign-ups racing on the same address would both pass a
 * prior read and one would then fail anyway. Letting Postgres be the arbiter
 * makes "email taken" a single, honest outcome rather than a race.
 */
export async function createUser(input: {
  name: string;
  email: string;
  password: string;
}): Promise<CreateUserResult> {
  const passwordHash = await hashPassword(input.password);

  try {
    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: normalizeEmail(input.email),
        passwordHash,
        // Never `input.role`. A new account is a customer, full stop.
        role: Role.USER,
      },
      select: { id: true, email: true, name: true, role: true },
    });

    return { status: "created", user };
  } catch (error) {
    // P2002 is a unique constraint violation; `email` is the only unique column
    // this insert can trip.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { status: "email-taken" };
    }

    throw error;
  }
}
