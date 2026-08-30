"use client";

import { useRouter } from "next/navigation";

import { filterHref, type ProductFilters } from "@/lib/product-filters";

/** The `?inStock=true` toggle. Applies immediately — there is nothing to type. */
export default function InStockFilter({
  filters,
}: {
  filters: ProductFilters;
}) {
  const router = useRouter();

  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={filters.inStockOnly}
        onChange={(event) =>
          router.push(filterHref(filters, { inStockOnly: event.target.checked }), {
            scroll: false,
          })
        }
        className="size-4 rounded border-border accent-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      In stock only
    </label>
  );
}
