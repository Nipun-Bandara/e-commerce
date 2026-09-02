import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { adminError, adminSuccess, type AdminResult } from "@/lib/admin-result";
import type { CategoryField, CategoryInput } from "@/lib/category-schemas";
import { prisma } from "@/lib/prisma";

/**
 * Every query the admin category screens make, read and write.
 *
 * Split from `categories.ts` for the reason `admin-products.ts` gives: that
 * module is the storefront's view — a plain alphabetical list for the filter
 * sidebar — and this one carries product counts and the three writes. Keeping
 * them apart means the nav query stays a two-line function and does not grow a
 * `_count` nobody renders.
 */

export type AdminCategoryListItem = Awaited<
  ReturnType<typeof listAdminCategories>
>[number];

/**
 * Every category, with how many products sit in it.
 *
 * The count comes from `_count` rather than a `products` include: the screen
 * shows a number, and fetching thirty product rows to call `.length` on them
 * would be thirty rows crossing the wire per category to render one integer.
 */
export function listAdminCategories() {
  return prisma.category.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      _count: { select: { products: true } },
    },
  });
}

/** One category for the edit form. By id, because this form can change the slug. */
export function getAdminCategoryById(id: string) {
  return prisma.category.findUnique({ where: { id } });
}

/** What the create/update helpers answer with. `field` names the input to blame. */
export type CategoryWriteResult =
  | { status: "created" | "updated"; id: string }
  | { status: "invalid"; field: CategoryField; message: string }
  | { status: "not-found" };

const SLUG_TAKEN = "That slug is already used by another category.";

/** P2002 on `slug` is the only unique constraint Category has. */
function isSlugConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
  );
}

export async function createCategory(
  input: CategoryInput,
): Promise<CategoryWriteResult> {
  try {
    const category = await prisma.category.create({
      data: input,
      select: { id: true },
    });

    return { status: "created", id: category.id };
  } catch (error) {
    if (isSlugConflict(error)) {
      return { status: "invalid", field: "slug", message: SLUG_TAKEN };
    }

    throw error;
  }
}

/**
 * Update a category.
 *
 * The uniqueness check excludes this row for free: `update` is keyed on
 * `id`, so a category keeping its own slug conflicts with nothing and P2002
 * only fires against a *different* row.
 */
export async function updateCategory(
  id: string,
  input: CategoryInput,
): Promise<CategoryWriteResult> {
  try {
    await prisma.category.update({ where: { id }, data: input });

    return { status: "updated", id };
  } catch (error) {
    if (isSlugConflict(error)) {
      return { status: "invalid", field: "slug", message: SLUG_TAKEN };
    }
    // P2025: the row was deleted between opening the form and saving it.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return { status: "not-found" };
    }

    throw error;
  }
}

/**
 * Delete a category, unless products still point at it.
 *
 * `Product.categoryId` is a non-null foreign key with no cascade, so Postgres
 * would refuse this anyway — but it would refuse it as a P2003 exception,
 * which reaches the admin as a crash. The count turns the same refusal into a
 * sentence that says how many products are in the way and what to do about it.
 *
 * The count and the delete are one transaction, so a product moved into this
 * category while the dialog was open cannot be orphaned by a check that was
 * true a moment ago.
 */
export async function deleteCategory(id: string): Promise<AdminResult> {
  return prisma.$transaction(async (tx) => {
    const category = await tx.category.findUnique({
      where: { id },
      select: { id: true, name: true, _count: { select: { products: true } } },
    });

    if (!category) {
      return adminError("That category no longer exists.");
    }

    const productCount = category._count.products;

    if (productCount > 0) {
      return adminError(
        `${category.name} still has ${productCount === 1 ? "1 product" : `${productCount} products`} in it. Move or delete ${productCount === 1 ? "it" : "them"} first.`,
      );
    }

    await tx.category.delete({ where: { id } });

    return adminSuccess(`${category.name} was deleted.`);
  });
}
