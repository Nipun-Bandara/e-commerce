import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * Category reads. Every query that touches Category lives here — components
 * import these functions rather than reaching for `prisma` themselves.
 */

export function listCategories() {
  return prisma.category.findMany({
    orderBy: { name: "asc" },
  });
}

export function getCategoryBySlug(slug: string) {
  return prisma.category.findUnique({
    where: { slug },
  });
}
