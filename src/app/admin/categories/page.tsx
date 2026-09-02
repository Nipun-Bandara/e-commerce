import Link from "next/link";
import type { Metadata } from "next";
import { PencilIcon, PlusIcon } from "lucide-react";

import AdminPageHeader from "@/components/admin/admin-page-header";
import DeleteCategoryButton from "@/components/admin/delete-category-button";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { listAdminCategories } from "@/server/admin-categories";
import { requireAdmin } from "@/server/auth";

export const metadata: Metadata = {
  title: "Categories · Admin",
};

/**
 * The category table.
 *
 * No search, filters or pagination, unlike the product list. A store has a
 * handful of categories and they all fit on one screen; controls for narrowing
 * a five-row table are furniture.
 *
 * The product count is the important column. It is what decides whether a
 * category can be deleted, and it links to that category's products so
 * "move them first" has somewhere to start.
 */
export default async function AdminCategoriesPage() {
  await requireAdmin("/admin/categories");

  const categories = await listAdminCategories();

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <AdminPageHeader
        title="Categories"
        description={
          categories.length === 1 ? "1 category." : `${categories.length} categories.`
        }
        actions={
          <Link
            href="/admin/categories/new"
            className={cn(buttonVariants({ size: "lg" }))}
          >
            <PlusIcon aria-hidden />
            Add category
          </Link>
        }
      />

      {categories.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-background px-6 py-16 text-center">
          <p className="text-sm text-muted-foreground">
            There are no categories yet. Every product needs one, so this is the
            place to start.
          </p>
          <Link
            href="/admin/categories/new"
            className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
          >
            Add the first category
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-background">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="border-b border-border bg-muted/50 text-left text-xs text-muted-foreground uppercase">
                <tr>
                  <th scope="col" className="px-3 py-2.5 font-medium">Category</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Description</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">
                    Products
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border">
                {categories.map((category) => (
                  <tr key={category.id}>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-col">
                        <Link
                          href={`/admin/categories/${category.id}/edit`}
                          className="font-medium underline-offset-4 outline-none hover:underline focus-visible:underline"
                        >
                          {category.name}
                        </Link>
                        <span className="text-xs text-muted-foreground">
                          /{category.slug}
                        </span>
                      </div>
                    </td>

                    <td className="max-w-sm px-3 py-2.5 text-muted-foreground">
                      <span className="line-clamp-2">
                        {category.description ?? "—"}
                      </span>
                    </td>

                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {category._count.products === 0 ? (
                        <span className="text-muted-foreground">0</span>
                      ) : (
                        // Straight to this category's products, which is what
                        // "move or delete them first" needs as a starting point.
                        <Link
                          href={`/admin/products?category=${category.slug}`}
                          className="underline underline-offset-4"
                        >
                          {category._count.products}
                        </Link>
                      )}
                    </td>

                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/admin/categories/${category.id}/edit`}
                          aria-label={`Edit ${category.name}`}
                          className={cn(
                            buttonVariants({ variant: "ghost", size: "icon-sm" }),
                          )}
                        >
                          <PencilIcon aria-hidden />
                        </Link>

                        <DeleteCategoryButton
                          categoryId={category.id}
                          categoryName={category.name}
                          productCount={category._count.products}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
