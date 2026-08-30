import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * Product reads. Every query that touches Product lives here — components
 * import these functions rather than reaching for `prisma` themselves.
 *
 * Note that `price` comes back as a Prisma Decimal, not a number. Format it
 * for display (see `formatPrice` in src/lib/money.ts); do not call
 * `Number()` on it.
 */

const productListSelect = {
  id: true,
  name: true,
  slug: true,
  price: true,
  stock: true,
  images: {
    orderBy: { position: "asc" },
    take: 1,
    select: { url: true, alt: true },
  },
} as const;

export function listActiveProducts() {
  return prisma.product.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
    select: productListSelect,
  });
}

export function listProductsByCategorySlug(categorySlug: string) {
  return prisma.product.findMany({
    where: { isActive: true, category: { slug: categorySlug } },
    orderBy: { createdAt: "desc" },
    select: productListSelect,
  });
}

export function getProductBySlug(slug: string) {
  return prisma.product.findUnique({
    where: { slug },
    include: {
      category: true,
      images: { orderBy: { position: "asc" } },
    },
  });
}
