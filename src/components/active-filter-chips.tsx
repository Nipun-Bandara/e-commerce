import Link from "next/link";
import { XIcon } from "lucide-react";

import { badgeVariants } from "@/components/ui/badge";
import { formatPrice, money } from "@/lib/money";
import {
  clearedFilters,
  filterHref,
  productsHref,
  type ProductFilters,
} from "@/lib/product-filters";
import { cn } from "@/lib/utils";

type CategoryOption = {
  name: string;
  slug: string;
};

export type FilterChip = {
  key: string;
  label: string;
  /** The catalogue URL with just this one filter removed. */
  href: string;
};

/**
 * One descriptor per active filter.
 *
 * Exported alongside the component because the empty state reuses the labels:
 * "nothing matched" is only useful if it says what it tried to match, and
 * saying it twice in two wordings invites the two to drift apart.
 *
 * Prices are formatted here, on the server. A `Decimal` cannot cross into a
 * Client Component, and `formatPrice` is the only formatter that will not send
 * the value through a float on the way.
 */
export function buildFilterChips(
  filters: ProductFilters,
  categories: CategoryOption[],
): FilterChip[] {
  const chips: FilterChip[] = [];

  if (filters.q) {
    chips.push({
      key: "q",
      label: `Search: “${filters.q}”`,
      href: filterHref(filters, { q: "" }),
    });
  }

  if (filters.category) {
    const category = categories.find((one) => one.slug === filters.category);

    chips.push({
      key: "category",
      // An unknown slug is still shown rather than dropped: the chip is the
      // only way back out of `?category=nonsense`.
      label: category?.name ?? filters.category,
      href: filterHref(filters, { category: undefined }),
    });
  }

  if (filters.minPrice !== undefined) {
    chips.push({
      key: "minPrice",
      label: `From ${formatPrice(money(String(filters.minPrice)))}`,
      href: filterHref(filters, { minPrice: undefined }),
    });
  }

  if (filters.maxPrice !== undefined) {
    chips.push({
      key: "maxPrice",
      label: `Up to ${formatPrice(money(String(filters.maxPrice)))}`,
      href: filterHref(filters, { maxPrice: undefined }),
    });
  }

  if (filters.inStockOnly) {
    chips.push({
      key: "inStock",
      label: "In stock only",
      href: filterHref(filters, { inStockOnly: false }),
    });
  }

  return chips;
}

/**
 * The active filters, each removable on its own.
 *
 * Every chip is a `<Link>` to the same listing minus that one filter, so
 * clearing a filter is a normal navigation: it works without JavaScript, and
 * the back button undoes it.
 */
export default function ActiveFilterChips({
  chips,
  filters,
}: {
  chips: FilterChip[];
  filters: ProductFilters;
}) {
  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">Filters:</span>

      {chips.map((chip) => (
        <Link
          key={chip.key}
          href={chip.href}
          aria-label={`Remove filter: ${chip.label}`}
          className={cn(
            badgeVariants({ variant: "outline" }),
            "h-7 gap-1 pr-1.5 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
          )}
        >
          {chip.label}
          <XIcon aria-hidden />
        </Link>
      ))}

      <Link
        href={productsHref(clearedFilters(filters))}
        className="rounded-md px-1 text-sm text-muted-foreground underline underline-offset-4 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        Clear all
      </Link>
    </div>
  );
}
