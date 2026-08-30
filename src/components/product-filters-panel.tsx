import Link from "next/link";

import InStockFilter from "@/components/in-stock-filter";
import PriceRangeFilter from "@/components/price-range-filter";
import { buttonVariants } from "@/components/ui/button";
import {
  clearedFilters,
  filterHref,
  hasActiveFilters,
  productsHref,
  type ProductFilters,
} from "@/lib/product-filters";
import { cn } from "@/lib/utils";
import type { PriceRange } from "@/server/products";

type CategoryOption = {
  name: string;
  slug: string;
};

/**
 * Contents of the filter sidebar.
 *
 * A Server Component: the category list is plain links, so switching category
 * is ordinary navigation that works before hydration and can be opened in a
 * new tab. Only the two controls that need to read input — the price bounds
 * and the stock checkbox — are client-side.
 */
export default function ProductFiltersPanel({
  filters,
  categories,
  priceRange,
}: {
  filters: ProductFilters;
  categories: CategoryOption[];
  priceRange: PriceRange;
}) {
  const entries = [
    { name: "All categories", slug: undefined },
    ...categories.map(({ name, slug }) => ({ name, slug })),
  ];

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Category</h3>
        <ul className="flex flex-col gap-0.5">
          {entries.map((entry) => {
            const isActive = entry.slug === filters.category;

            return (
              <li key={entry.slug ?? "all"}>
                <Link
                  href={filterHref(filters, { category: entry.slug })}
                  aria-current={isActive ? "true" : undefined}
                  className={cn(
                    "flex rounded-lg px-2 py-1.5 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    isActive
                      ? "bg-muted font-medium text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {entry.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {priceRange.min && priceRange.max && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">Price (LKR)</h3>
          <PriceRangeFilter
            // Remounts when the bounds change elsewhere — a cleared chip, a
            // back navigation — so the boxes show the URL rather than a stale
            // draft of what was typed into them.
            key={`${filters.minPrice ?? ""}-${filters.maxPrice ?? ""}`}
            filters={filters}
            lowest={priceRange.min.toFixed(2)}
            highest={priceRange.max.toFixed(2)}
          />
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Availability</h3>
        <InStockFilter filters={filters} />
      </section>

      {hasActiveFilters(filters) && (
        <Link
          href={productsHref(clearedFilters(filters))}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "self-start",
          )}
        >
          Clear all filters
        </Link>
      )}
    </div>
  );
}
