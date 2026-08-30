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

/** Products per page when a caller does not ask for a specific size. */
export const DEFAULT_PAGE_SIZE = 12;

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

export type ProductListItem = Awaited<
  ReturnType<typeof getProducts>
>["products"][number];

export type ProductDetail = NonNullable<
  Awaited<ReturnType<typeof getProductBySlug>>
>;

export type GetProductsOptions = {
  /** 1-based. Clamped into range, so an out-of-range `?page=` is harmless. */
  page?: number;
  pageSize?: number;
  /** Omit to list the whole catalogue. */
  categorySlug?: string;
};

/**
 * One page of the public catalogue, newest first, plus the total row count so
 * callers can render pagination.
 *
 * `createdAt` alone is not a stable sort: the seed writes products in a tight
 * loop, so timestamps collide and a row could appear on two pages or neither.
 * `id` breaks the tie and makes paging deterministic.
 *
 * The count runs before the page query rather than alongside it because the
 * page number is clamped against it — asking for page 99 of 3 returns the last
 * page instead of an empty grid.
 */
export async function getProducts({
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
  categorySlug,
}: GetProductsOptions = {}) {
  const take = Math.max(1, Math.trunc(pageSize));
  const where = {
    isActive: true,
    ...(categorySlug ? { category: { slug: categorySlug } } : {}),
  };

  const total = await prisma.product.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / take));
  const currentPage = Math.min(Math.max(1, Math.trunc(page)), pageCount);

  const products = await prisma.product.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    select: productListSelect,
    skip: (currentPage - 1) * take,
    take,
  });

  return { products, total, page: currentPage, pageSize: take, pageCount };
}

/**
 * One product for its detail page, with images in gallery order.
 *
 * `findFirst` rather than `findUnique` because an inactive product must read as
 * missing to the storefront; `slug` is still unique, so this is an index hit.
 * Returns `null` when there is no match — callers decide whether that is a 404.
 */
export function getProductBySlug(slug: string) {
  return prisma.product.findFirst({
    where: { slug, isActive: true },
    include: {
      category: true,
      images: { orderBy: { position: "asc" } },
    },
  });
}
