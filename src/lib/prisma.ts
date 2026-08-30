import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

/**
 * Prisma Client singleton.
 *
 * Next.js clears the module registry on every hot reload in development, so a
 * plain `new PrismaClient()` at module scope would open a fresh connection pool
 * on each edit until Postgres refuses new connections. Caching the instance on
 * `globalThis` — which survives hot reload — keeps exactly one pool alive.
 *
 * In production the module is evaluated once, so the cache is a no-op.
 */

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and fill it in.",
    );
  }

  // Prisma 7 talks to Postgres through a driver adapter rather than a binary
  // engine, so the connection string is supplied here rather than in schema.prisma.
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["error"],
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
