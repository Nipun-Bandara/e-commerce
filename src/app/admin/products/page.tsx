import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { PencilIcon, PlusIcon } from "lucide-react";

import AdminPageHeader from "@/components/admin/admin-page-header";
import AdminProductFiltersBar from "@/components/admin/admin-product-filters";
import DeleteProductButton from "@/components/admin/delete-product-button";
import InlineStockField from "@/components/admin/inline-stock-field";
import Pagination from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  adminActiveFilterCount,
  adminProductsHref,
  clearedAdminFilters,
  parseAdminProductFilters,
  withAdminFilters,
} from "@/lib/admin-product-filters";
import { formatPrice } from "@/lib/money";
import { cn } from "@/lib/utils";
import { listAdminProducts, type AdminProductListItem } from "@/server/admin-products";
import { requireAdmin } from "@/server/auth";
import { listCategories } from "@/server/categories";

export const metadata: Metadata = {
  title: "Products · Admin",
};

/**
 * The product table: everything in the catalogue, including what shoppers
 * cannot see.
 *
 * All of the list state — search, both filters, sort and page — is read from
 * the URL and validated by `parseAdminProductFilters`, which falls every field
 * back to a default rather than throwing. `?sort=drop-table` sorts by newest.
 * That matters more here than on the storefront: these params reach a query
 * that can see inactive rows.
 *
 * No Suspense boundary around the table. The storefront wraps its results
 * because the filter sidebar is worth showing while a slow query runs; here the
 * page *is* the table, and a skeleton of it would be the same shape as the
 * thing it is standing in for.
 */
export default async function AdminProductsPage({
  searchParams,
}: PageProps<"/admin/products">) {
  await requireAdmin("/admin/products");

  const filters = parseAdminProductFilters(await searchParams);

  // The category list does not depend on the filters, so both queries go out
  // together rather than the dropdown waiting on the table.
  const [{ products, total, page, pageCount }, categories] = await Promise.all([
    listAdminProducts({
      page: filters.page,
      q: filters.q,
      categorySlug: filters.category,
      active: filters.active,
      sort: filters.sort,
    }),
    listCategories(),
  ]);

  const narrowed = adminActiveFilterCount(filters) > 0;

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <AdminPageHeader
        title="Products"
        description={
          total === 1 ? "1 product matches." : `${total} products match.`
        }
        actions={
          <Link
            href="/admin/products/new"
            // `cn` is not optional: it is what drops the `border-transparent`
            // in the button base that would otherwise beat a later border.
            className={cn(buttonVariants({ size: "lg" }))}
          >
            <PlusIcon aria-hidden />
            Add product
          </Link>
        }
      />

      <AdminProductFiltersBar filters={filters} categories={categories} />

      {products.length === 0 ? (
        <EmptyState narrowed={narrowed} clearHref={adminProductsHref(clearedAdminFilters(filters))} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-background">
          {/* The table scrolls sideways inside its own box rather than making
              the page scroll. Nine columns do not fit a phone, and squeezing
              them into one would cost the thumbnail and the SKU. */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[64rem] text-sm">
              <caption className="sr-only">
                Products, with stock editable in the table.
              </caption>

              <thead className="border-b border-border bg-muted/50 text-left text-xs text-muted-foreground uppercase">
                <tr>
                  <th scope="col" className="w-16 px-3 py-2.5 font-medium">
                    <span className="sr-only">Image</span>
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Product</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">SKU</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Category</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Price</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Stock</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border">
                {products.map((product) => (
                  <ProductRow key={product.id} product={product} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Pagination
        page={page}
        pageCount={pageCount}
        // The filters have to survive paging, or page 2 silently resets the
        // list to something else.
        hrefForPage={(next) => adminProductsHref(withAdminFilters(filters, { page: next }))}
      />
    </div>
  );
}

/**
 * One row.
 *
 * Out of stock is marked twice on purpose: a tinted row, which is what you see
 * scanning the table, and a badge, which is what a screen reader and anyone who
 * cannot distinguish the tint gets. Colour alone is not a status.
 */
function ProductRow({ product }: { product: AdminProductListItem }) {
  const [image] = product.images;
  const isOutOfStock = product.stock === 0;

  return (
    <tr className={cn(isOutOfStock && "bg-destructive/5")}>
      <td className="px-3 py-2">
        <div className="relative size-10 overflow-hidden rounded-md border border-border bg-muted">
          {image ? (
            <Image
              src={image.url}
              alt=""
              fill
              sizes="40px"
              className="object-cover"
            />
          ) : (
            <span className="grid h-full place-items-center text-[0.6rem] text-muted-foreground">
              None
            </span>
          )}
        </div>
      </td>

      <td className="px-3 py-2">
        <div className="flex flex-col">
          <Link
            href={`/admin/products/${product.id}/edit`}
            className="font-medium underline-offset-4 outline-none hover:underline focus-visible:underline"
          >
            {product.name}
          </Link>
          <span className="text-xs text-muted-foreground">/{product.slug}</span>
        </div>
      </td>

      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
        {product.sku}
      </td>

      <td className="px-3 py-2 text-muted-foreground">{product.category.name}</td>

      {/* Formatted on the server: `price` is a Decimal, and one handed straight
          to JSX would not survive serialisation to the client. */}
      <td className="px-3 py-2 text-right tabular-nums">
        {formatPrice(product.price)}
      </td>

      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <InlineStockField
            productId={product.id}
            productName={product.name}
            stock={product.stock}
          />
          {isOutOfStock ? (
            <Badge variant="destructive" className="shrink-0">
              Out of stock
            </Badge>
          ) : null}
        </div>
      </td>

      <td className="px-3 py-2">
        <Badge variant={product.isActive ? "secondary" : "outline"}>
          {product.isActive ? "Active" : "Inactive"}
        </Badge>
      </td>

      <td className="px-3 py-2">
        <div className="flex items-center justify-end gap-1">
          <Link
            href={`/admin/products/${product.id}/edit`}
            aria-label={`Edit ${product.name}`}
            className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
          >
            <PencilIcon aria-hidden />
          </Link>

          <DeleteProductButton
            productId={product.id}
            productName={product.name}
          />
        </div>
      </td>
    </tr>
  );
}

/**
 * Nothing matched.
 *
 * The two cases are genuinely different: an empty catalogue needs a way to add
 * the first product, a filtered-to-nothing table needs a way back out. Offering
 * "clear filters" on an empty database would be a button that changes nothing.
 */
function EmptyState({
  narrowed,
  clearHref,
}: {
  narrowed: boolean;
  clearHref: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-background px-6 py-16 text-center">
      <p className="text-sm text-muted-foreground">
        {narrowed
          ? "No products match these filters."
          : "There are no products yet."}
      </p>

      <Link
        href={narrowed ? clearHref : "/admin/products/new"}
        className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
      >
        {narrowed ? "Clear filters" : "Add the first product"}
      </Link>
    </div>
  );
}
