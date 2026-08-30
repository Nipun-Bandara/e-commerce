import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";

import ActiveFilterChips, {
  buildFilterChips,
  type FilterChip,
} from "@/components/active-filter-chips";
import FiltersDrawer from "@/components/filters-drawer";
import Pagination from "@/components/pagination";
import ProductFiltersPanel from "@/components/product-filters-panel";
import ProductGrid from "@/components/product-grid";
import ProductResultsSkeleton from "@/components/product-results-skeleton";
import ProductSearch from "@/components/product-search";
import ProductSortSelect from "@/components/product-sort-select";
import { buttonVariants } from "@/components/ui/button";
import {
  activeFilterCount,
  clearedFilters,
  parseProductFilters,
  productsHref,
  withFilters,
  type ProductFilters,
} from "@/lib/product-filters";
import { cn } from "@/lib/utils";
import { listCategories } from "@/server/categories";
import { getPriceRange, getProducts } from "@/server/products";

export const metadata: Metadata = {
  title: "Products",
  description: "Search, filter and sort the full catalogue.",
};

export default async function ProductsPage({
  searchParams,
}: PageProps<"/products">) {
  const filters = parseProductFilters(await searchParams);

  // Neither of these depends on the filters, so they render immediately and
  // the controls stay interactive while the results below are still coming.
  const [categories, priceRange] = await Promise.all([
    listCategories(),
    getPriceRange(),
  ]);

  const chips = buildFilterChips(filters, categories);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">All products</h1>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <ProductSearch filters={filters} />
          <ProductSortSelect filters={filters} />
        </div>
      </header>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-10">
        <FiltersDrawer activeCount={activeFilterCount(filters)}>
          <ProductFiltersPanel
            filters={filters}
            categories={categories}
            priceRange={priceRange}
          />
        </FiltersDrawer>

        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <ActiveFilterChips chips={chips} filters={filters} />

          {/*
            Keyed on the URL the filters produce, so every change tears the
            boundary down and shows the skeleton again. Without the key React
            would keep the previous results on screen through the refetch,
            with no sign that anything is happening.
          */}
          <Suspense
            key={productsHref(filters)}
            fallback={<ProductResultsSkeleton />}
          >
            <ProductResults filters={filters} chips={chips} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

/**
 * The filtered results: count, grid and pagination.
 *
 * Split out of the page so the single slow query sits behind its own Suspense
 * boundary, leaving the header and sidebar rendered while it runs.
 */
async function ProductResults({
  filters,
  chips,
}: {
  filters: ProductFilters;
  chips: FilterChip[];
}) {
  const { products, total, page, pageCount } = await getProducts({
    page: filters.page,
    q: filters.q,
    categorySlug: filters.category,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    inStockOnly: filters.inStockOnly,
    sort: filters.sort,
  });

  return (
    <>
      <p aria-live="polite" className="text-sm text-muted-foreground">
        {total === 1 ? "1 product found" : `${total} products found`}
      </p>

      <ProductGrid
        products={products}
        emptyMessage={
          chips.length > 0
            ? // Names the filters rather than just reporting a blank grid, so
              // it is obvious which one to drop.
              `No products match ${chips.map((chip) => chip.label).join(" + ")}. Try removing a filter.`
            : "There are no products in the catalogue right now. Please check back soon."
        }
        emptyAction={
          chips.length > 0 && (
            <Link
              href={productsHref(clearedFilters(filters))}
              // `cn` is not optional here: it is what drops the `border-transparent`
              // in the button base that would otherwise beat `border-border`.
              className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
            >
              Clear all filters
            </Link>
          )
        }
      />

      <Pagination
        page={page}
        pageCount={pageCount}
        hrefForPage={(next) => productsHref(withFilters(filters, { page: next }))}
      />
    </>
  );
}
