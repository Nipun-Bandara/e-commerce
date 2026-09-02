import "server-only";

import { Prisma } from "@/generated/prisma/client";
import {
  ADMIN_PRODUCTS_PAGE_SIZE,
  DEFAULT_ADMIN_SORT,
  type AdminActiveFilter,
  type AdminProductSort,
} from "@/lib/admin-product-filters";
import { adminError, adminSuccess, adminWarning, type AdminResult } from "@/lib/admin-result";
import { prisma } from "@/lib/prisma";
import type { ProductField, ProductInput } from "@/lib/product-schemas";

/**
 * Every query the admin product screens make, read and write.
 *
 * Separate from `products.ts`, which is the storefront's view of the same
 * table. That module filters `isActive: true` into almost every query, because
 * a shopper must not be shown a product that is not for sale; this one must
 * show exactly those. Adding an `includeInactive` flag to the storefront
 * functions would have put a boolean between a shopper and a hidden product,
 * and the day it is passed wrong is the day an unfinished draft goes on sale.
 * Two modules, two audiences, no flag.
 *
 * Nothing here is a Server Action. `admin-product-actions.ts` is the thin
 * `"use server"` file that exposes a chosen few of these to a browser, and it
 * is where `requireAdmin` runs.
 */

/** The columns the product table renders, and nothing else. */
const adminProductListSelect = {
  id: true,
  name: true,
  slug: true,
  sku: true,
  price: true,
  stock: true,
  isActive: true,
  createdAt: true,
  category: { select: { name: true, slug: true } },
  images: {
    orderBy: { position: "asc" },
    take: 1,
    select: { url: true, alt: true },
  },
} as const;

export type AdminProductListItem = Awaited<
  ReturnType<typeof listAdminProducts>
>["products"][number];

export type AdminProductDetail = NonNullable<
  Awaited<ReturnType<typeof getAdminProductById>>
>;

/**
 * Every sort the admin list offers, each with `id` as a tiebreaker.
 *
 * The tiebreaker is not decoration — see the note on `PRODUCT_ORDER_BY` in
 * `products.ts`. It matters more here: `stock` ties constantly (every sold-out
 * product is 0) and `isActive` filtering does nothing to spread them out, so
 * without a unique final key paging through a stock-sorted list would show the
 * same row twice.
 */
const ADMIN_PRODUCT_ORDER_BY: Record<
  AdminProductSort,
  Prisma.ProductOrderByWithRelationInput[]
> = {
  newest: [{ createdAt: "desc" }, { id: "asc" }],
  oldest: [{ createdAt: "asc" }, { id: "asc" }],
  "name-asc": [{ name: "asc" }, { id: "asc" }],
  "name-desc": [{ name: "desc" }, { id: "asc" }],
  "price-asc": [{ price: "asc" }, { id: "asc" }],
  "price-desc": [{ price: "desc" }, { id: "asc" }],
  "stock-asc": [{ stock: "asc" }, { id: "asc" }],
  "stock-desc": [{ stock: "desc" }, { id: "asc" }],
};

export type ListAdminProductsOptions = {
  /** 1-based. Clamped into range, so an out-of-range `?page=` is harmless. */
  page?: number;
  /** Free text matched against name or SKU, case insensitive. */
  q?: string;
  /** Category slug. Omit to list every category. */
  categorySlug?: string;
  active?: AdminActiveFilter;
  sort?: AdminProductSort;
};

/**
 * One page of the admin list, plus the total row count for the pagination.
 *
 * The search is name **or** SKU, which is the pair an admin actually has to
 * hand: a customer quotes a product name, a warehouse note quotes a SKU.
 * Description is deliberately not searched — it matches half the catalogue on
 * any common word, and this table is for finding one row.
 *
 * The count runs before the page query because the page number is clamped
 * against it: asking for page 9 of 3 returns the last page rather than an empty
 * table, which is what happens when a filter narrows the list you were paging.
 */
export async function listAdminProducts({
  page = 1,
  q,
  categorySlug,
  active = "all",
  sort = DEFAULT_ADMIN_SORT,
}: ListAdminProductsOptions = {}) {
  const take = ADMIN_PRODUCTS_PAGE_SIZE;
  const search = q?.trim();

  const where: Prisma.ProductWhereInput = {
    ...(categorySlug ? { category: { slug: categorySlug } } : {}),
    ...(active === "all" ? {} : { isActive: active === "active" }),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { sku: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const total = await prisma.product.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / take));
  const currentPage = Math.min(Math.max(1, Math.trunc(page)), pageCount);

  const products = await prisma.product.findMany({
    where,
    orderBy: ADMIN_PRODUCT_ORDER_BY[sort],
    select: adminProductListSelect,
    skip: (currentPage - 1) * take,
    take,
  });

  return { products, total, page: currentPage, pageCount };
}

/**
 * One product for the edit form, with its images in position order.
 *
 * By id, not slug, and with no `isActive` condition: the admin edits rows, and
 * an inactive product is the most likely thing to be opened here. The id is in
 * the URL rather than the slug precisely because this form can *change* the
 * slug — a slug-keyed edit page would navigate to a 404 on save.
 */
export function getAdminProductById(id: string) {
  return prisma.product.findUnique({
    where: { id },
    include: { images: { orderBy: { position: "asc" } } },
  });
}

/**
 * The catalogue counts on the dashboard.
 *
 * One `$transaction` so the three numbers describe the same instant. They are
 * independent queries and would be correct enough run separately, but a
 * dashboard that says "30 products, 31 of them out of stock" because a write
 * landed between two counts is the kind of thing that costs an hour to
 * disbelieve.
 *
 * The order count used to be a fourth entry here. It moved to
 * `getAdminOrderStats`, which counts orders several ways in one transaction of
 * its own — two order counts on one page that could disagree is exactly the
 * problem this function was grouped to avoid.
 */
export function getAdminStats() {
  return prisma.$transaction([
    prisma.product.count(),
    prisma.product.count({ where: { stock: 0 } }),
    prisma.category.count(),
  ]);
}

/**
 * Which field a unique-constraint violation was about.
 *
 * P2002 is the code; *which column* is the part that has to be dug out, and
 * where it lives depends on how Prisma is talking to Postgres.
 *
 * - Through the query engine, `meta.target` is an array of column names.
 * - Through a **driver adapter** — which is how this app is wired, see
 *   `src/lib/prisma.ts` — `meta.target` is `undefined`. The information is
 *   instead at `meta.driverAdapterError.cause.constraint`, as either the
 *   index's name (`{ index: "Product_slug_key" }`) or its columns
 *   (`{ fields: ["slug"] }`), depending on the adapter.
 *
 * Both are read, because getting this wrong is not a cosmetic failure: an
 * unrecognised conflict falls through to the rethrow below and reaches the
 * admin as a 500 instead of "that SKU is taken".
 *
 * Index names are split on `_` and matched as whole tokens rather than by
 * substring. `Product_slug_key` yields `slug`, and nothing accidentally matches
 * a column whose name is a fragment of another's.
 *
 * Anything that is not a recognised unique conflict returns `null` and is
 * rethrown by the caller, because "slug or SKU is taken" is a terrible way to
 * describe a dropped connection.
 */
function uniqueViolationField(error: unknown): ProductField | null {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return null;
  if (error.code !== "P2002") return null;

  const columns = new Set<string>();

  const target = error.meta?.target;
  if (Array.isArray(target)) {
    for (const column of target) columns.add(String(column));
  } else if (typeof target === "string") {
    for (const part of target.split("_")) columns.add(part);
  }

  const constraint = (
    error.meta?.driverAdapterError as
      | { cause?: { constraint?: { index?: string; fields?: string[] } } }
      | undefined
  )?.cause?.constraint;

  if (constraint?.index) {
    for (const part of constraint.index.split("_")) columns.add(part);
  }
  for (const field of constraint?.fields ?? []) columns.add(field);

  if (columns.has("slug")) return "slug";
  if (columns.has("sku")) return "sku";

  return null;
}

/** What the create/update helpers answer with. `field` names the input to blame. */
export type ProductWriteResult =
  | { status: "created" | "updated"; id: string }
  | { status: "invalid"; field: ProductField; message: string }
  | { status: "not-found" };

const TAKEN_MESSAGE: Record<"slug" | "sku", string> = {
  slug: "That slug is already used by another product.",
  sku: "That SKU is already used by another product.",
};

/**
 * The image rows for a product, in the order the admin arranged them.
 *
 * `position` is the array index, so the first image is position 0 — which is
 * what makes it the thumbnail, since every query that wants one orders by
 * position and takes one. `alt` is left NULL: the admin was not asked for it,
 * and `ProductCard` already falls back to the product name, which is a better
 * description than a blank string would be.
 */
function imageRows(urls: string[]) {
  return urls.map((url, index) => ({ url, position: index }));
}

/**
 * Create a product and its images.
 *
 * One transaction: a product whose images half-wrote is a product with a
 * missing thumbnail and no sign of why.
 *
 * The category is checked here rather than in the schema because only a query
 * can answer it, and it is checked *inside* the transaction so the answer is
 * still true when the row is written. Without that, deleting a category
 * concurrently would turn a friendly message into a foreign-key exception.
 *
 * `price` is handed to Prisma as the string the admin typed. That is the whole
 * discipline: `numeric(10, 2)` receives the exact decimal, and there is no
 * moment at which the value passed through a float.
 */
export async function createProduct(
  input: ProductInput,
): Promise<ProductWriteResult> {
  try {
    const id = await prisma.$transaction(async (tx) => {
      const category = await tx.category.findUnique({
        where: { id: input.categoryId },
        select: { id: true },
      });
      if (!category) return null;

      const product = await tx.product.create({
        data: {
          name: input.name,
          slug: input.slug,
          description: input.description,
          price: input.price,
          stock: input.stock,
          sku: input.sku,
          isActive: input.isActive,
          categoryId: category.id,
          images: { create: imageRows(input.imageUrls) },
        },
        select: { id: true },
      });

      return product.id;
    });

    if (!id) {
      return {
        status: "invalid",
        field: "categoryId",
        message: "That category no longer exists. Pick another one.",
      };
    }

    return { status: "created", id };
  } catch (error) {
    const field = uniqueViolationField(error);
    if (field === "slug" || field === "sku") {
      return { status: "invalid", field, message: TAKEN_MESSAGE[field] };
    }

    throw error;
  }
}

/**
 * Update a product, replacing its image list wholesale.
 *
 * Images are deleted and rewritten rather than diffed. They have no natural key
 * — two rows for the same URL at different positions are both legitimate — so
 * a diff would have to match on `(url, position)` and would still rewrite every
 * row after a reorder. The seed makes the same call for the same reason.
 *
 * Uniqueness excludes this row without a single extra query: the `WHERE` on
 * `updateMany` is `id = ?`, so a product keeping its own slug conflicts with
 * nothing. The P2002 handler below only ever fires for a *different* row's
 * slug or SKU, which is exactly the case that deserves a field error.
 */
export async function updateProduct(
  id: string,
  input: ProductInput,
): Promise<ProductWriteResult> {
  try {
    const status = await prisma.$transaction(async (tx) => {
      const existing = await tx.product.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!existing) return "not-found" as const;

      const category = await tx.category.findUnique({
        where: { id: input.categoryId },
        select: { id: true },
      });
      if (!category) return "no-category" as const;

      await tx.product.update({
        where: { id },
        data: {
          name: input.name,
          slug: input.slug,
          description: input.description,
          price: input.price,
          stock: input.stock,
          sku: input.sku,
          isActive: input.isActive,
          categoryId: category.id,
        },
      });

      await tx.productImage.deleteMany({ where: { productId: id } });
      if (input.imageUrls.length > 0) {
        await tx.productImage.createMany({
          data: imageRows(input.imageUrls).map((row) => ({
            ...row,
            productId: id,
          })),
        });
      }

      return "updated" as const;
    });

    if (status === "not-found") return { status: "not-found" };
    if (status === "no-category") {
      return {
        status: "invalid",
        field: "categoryId",
        message: "That category no longer exists. Pick another one.",
      };
    }

    return { status: "updated", id };
  } catch (error) {
    const field = uniqueViolationField(error);
    if (field === "slug" || field === "sku") {
      return { status: "invalid", field, message: TAKEN_MESSAGE[field] };
    }

    throw error;
  }
}

/**
 * Remove a product — by deleting it, or by taking it off sale.
 *
 * **The rule this enforces.** A product that appears on a past order is never
 * hard-deleted. `OrderItem` snapshots the name and unit price, so history would
 * survive the delete and read correctly either way; what would not survive is
 * the link back to the live row, and with it the admin's ability to answer "is
 * this the same product they bought in March". Archiving keeps the row, keeps
 * the link, and takes it off the storefront — which is what "delete" means for
 * something that has been sold.
 *
 * The `orderItem` count and the delete are one transaction. Separately, an
 * order placed in the gap would be checked against a product that is about to
 * stop existing.
 *
 * A product with no order history is deleted outright, and its images and cart
 * items go with it — both relations are `onDelete: Cascade`, so Postgres does
 * it in the same statement rather than this function racing to tidy up first.
 * Someone with it in their basket finds it gone, which is true.
 */
export async function deleteProduct(id: string): Promise<AdminResult> {
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({
      where: { id },
      select: { id: true, name: true, isActive: true },
    });

    if (!product) {
      return adminError("That product no longer exists.");
    }

    const orderLines = await tx.orderItem.count({ where: { productId: id } });

    if (orderLines > 0) {
      // Already archived: say so rather than reporting a change that did not
      // happen. `updateMany` because the row is known to exist and the count is
      // not interesting.
      if (!product.isActive) {
        return adminWarning(
          `${product.name} appears in past orders, so it cannot be deleted. It is already archived.`,
        );
      }

      await tx.product.updateMany({
        where: { id },
        data: { isActive: false },
      });

      return adminWarning(
        `${product.name} appears in ${orderLines === 1 ? "a past order" : `${orderLines} past orders`}, so it was archived instead of deleted. It is no longer on the storefront.`,
      );
    }

    await tx.product.delete({ where: { id } });

    return adminSuccess(`${product.name} was deleted.`);
  });
}

/**
 * Set a product's stock from the inline control on the list.
 *
 * A plain assignment, not an increment: the admin is stating a count they have
 * just taken off a shelf, and `+= 3` would be a different feature with a
 * different race. `update` rather than `updateMany` so a product deleted in
 * another tab reports as missing instead of silently doing nothing.
 */
export async function setProductStock(
  productId: string,
  stock: number,
): Promise<AdminResult> {
  const { count } = await prisma.product.updateMany({
    where: { id: productId },
    data: { stock },
  });

  if (count === 0) {
    return adminError("That product no longer exists.");
  }

  return adminSuccess(
    stock === 0 ? "Stock set to 0 — marked out of stock." : `Stock set to ${stock}.`,
  );
}
