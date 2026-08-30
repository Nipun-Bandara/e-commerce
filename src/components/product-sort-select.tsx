"use client";

import { useRouter } from "next/navigation";
import { ChevronDownIcon } from "lucide-react";

import {
  PRODUCT_SORTS,
  filterHref,
  type ProductFilters,
  type ProductSort,
} from "@/lib/product-filters";

/**
 * Sort order for the catalogue, written to `?sort=`.
 *
 * A native `<select>` rather than a styled listbox: it is one linear choice,
 * and the platform control already handles keyboard, touch and screen readers
 * better than a reimplementation would.
 */
export default function ProductSortSelect({
  filters,
}: {
  filters: ProductFilters;
}) {
  const router = useRouter();

  return (
    <div className="relative">
      <label htmlFor="product-sort" className="sr-only">
        Sort products
      </label>
      <select
        id="product-sort"
        value={filters.sort}
        onChange={(event) =>
          router.push(
            filterHref(filters, { sort: event.target.value as ProductSort }),
            { scroll: false },
          )
        }
        className="h-9 w-full appearance-none rounded-lg border border-border bg-background pr-8 pl-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {PRODUCT_SORTS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDownIcon
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}
