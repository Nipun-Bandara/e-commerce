import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { DEFAULT_SORT, type ProductSort } from "@/lib/product-filters";

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
  /** Free text matched against name or description, case insensitive. */
  q?: string;
  /** Omit to list the whole catalogue. */
  categorySlug?: string;
  /** Inclusive price bounds, in LKR. Either end may be omitted. */
  minPrice?: number;
  maxPrice?: number;
  /** Hide products with no stock. */
  inStockOnly?: boolean;
  sort?: ProductSort;
};

/**
 * Every sort the listing offers, each with `id` as a tiebreaker.
 *
 * The tiebreaker is not decoration. `createdAt` collides — the seed writes
 * products in a tight loop — and so do `price` and `name`. Without a unique
 * final key the database is free to order tied rows differently between the
 * page-2 query and the page-3 query, which makes a row appear twice or not at
 * all. `id` is unique, so paging is deterministic.
 */
const PRODUCT_ORDER_BY: Record<
  ProductSort,
  Prisma.ProductOrderByWithRelationInput[]
> = {
  newest: [{ createdAt: "desc" }, { id: "asc" }],
  "price-asc": [{ price: "asc" }, { id: "asc" }],
  "price-desc": [{ price: "desc" }, { id: "asc" }],
  "name-asc": [{ name: "asc" }, { id: "asc" }],
};

/**
 * One page of the public catalogue, plus the total row count so callers can
 * render pagination that stays correct under the same filters.
 *
 * Filters combine with AND: they narrow each other rather than competing. The
 * text search is the one internal OR — a term may match the name or the
 * description — and Prisma nests it under the same AND as everything else.
 *
 * The count runs before the page query rather than alongside it because the
 * page number is clamped against it — asking for page 99 of 3 returns the last
 * page instead of an empty grid.
 */
export async function getProducts({
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
  q,
  categorySlug,
  minPrice,
  maxPrice,
  inStockOnly = false,
  sort = DEFAULT_SORT,
}: GetProductsOptions = {}) {
  const take = Math.max(1, Math.trunc(pageSize));
  const search = q?.trim();

  const where: Prisma.ProductWhereInput = {
    isActive: true,
    ...(categorySlug ? { category: { slug: categorySlug } } : {}),
    ...(inStockOnly ? { stock: { gt: 0 } } : {}),
    ...(minPrice !== undefined || maxPrice !== undefined
      ? {
          price: {
            // Bounds are handed to Prisma as decimal strings, not numbers, for
            // the same reason every price in this codebase is: `numeric(10, 2)`
            // compared against a float literal is a comparison against an
            // approximation of the value the visitor typed.
            ...(minPrice !== undefined ? { gte: String(minPrice) } : {}),
            ...(maxPrice !== undefined ? { lte: String(maxPrice) } : {}),
          },
        }
      : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const total = await prisma.product.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / take));
  const currentPage = Math.min(Math.max(1, Math.trunc(page)), pageCount);

  const products = await prisma.product.findMany({
    where,
    orderBy: PRODUCT_ORDER_BY[sort],
    select: productListSelect,
    skip: (currentPage - 1) * take,
    take,
  });

  return { products, total, page: currentPage, pageSize: take, pageCount };
}

/**
 * Cheapest and dearest active product, for the bounds of the price filter.
 *
 * Deliberately unfiltered by anything but `isActive`: these are the ends of the
 * slider, and a range that moved every time you ticked a box would be unusable.
 *
 * Both are `null` when the catalogue is empty — the caller decides whether to
 * render a price filter at all. The values stay `Decimal`; format them with
 * `formatPrice`, or hand `toFixed(2)` to an input's `min`/`max` attribute.
 */
export async function getPriceRange() {
  const { _min, _max } = await prisma.product.aggregate({
    where: { isActive: true },
    _min: { price: true },
    _max: { price: true },
  });

  return { min: _min.price, max: _max.price };
}

export type PriceRange = Awaited<ReturnType<typeof getPriceRange>>;

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
