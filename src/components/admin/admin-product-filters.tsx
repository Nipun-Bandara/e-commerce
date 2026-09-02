"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDownIcon, SearchIcon, XIcon } from "lucide-react";

import {
  ADMIN_ACTIVE_FILTERS,
  ADMIN_PRODUCT_SORTS,
  adminFilterHref,
  type AdminActiveFilter,
  type AdminProductFilters,
  type AdminProductSort,
} from "@/lib/admin-product-filters";

/**
 * Search, the two filters and the sort order for the product table.
 *
 * Every control writes to the URL and nothing else — the table is rendered from
 * `searchParams` on the server, so these four inputs hold no results state
 * between them. That is what makes a filtered view survive a refresh, open the
 * same way in a second tab, and come back unchanged after editing a row.
 *
 * The search box debounces; the selects navigate immediately. A dropdown is a
 * finished decision, and waiting 300ms to act on one only feels broken.
 */

/** Long enough to skip the letters of a word, short enough to feel live. */
const DEBOUNCE_MS = 300;

export default function AdminProductFiltersBar({
  filters,
  categories,
}: {
  filters: AdminProductFilters;
  /** Every category, for the filter dropdown. Slug is what goes in the URL. */
  categories: { name: string; slug: string }[];
}) {
  const router = useRouter();

  /** One filter changed: rebuild the URL and go there. */
  function apply(patch: Partial<AdminProductFilters>) {
    router.push(adminFilterHref(filters, patch), { scroll: false });
  }

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <SearchBox filters={filters} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:ml-auto lg:w-auto">
        <Select
          id="admin-product-category"
          label="Filter by category"
          value={filters.category ?? ""}
          onChange={(value) =>
            // `""` is "every category", which must clear the param rather than
            // set it to an empty string — `adminProductFiltersToQuery` drops
            // `undefined`, so the URL goes back to being clean.
            apply({ category: value || undefined })
          }
        >
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.slug} value={category.slug}>
              {category.name}
            </option>
          ))}
        </Select>

        <Select
          id="admin-product-active"
          label="Filter by status"
          value={filters.active}
          onChange={(value) => apply({ active: value as AdminActiveFilter })}
        >
          {ADMIN_ACTIVE_FILTERS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>

        <Select
          id="admin-product-sort"
          label="Sort products"
          value={filters.sort}
          onChange={(value) => apply({ sort: value as AdminProductSort })}
        >
          {ADMIN_PRODUCT_SORTS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}

/**
 * The search box, debounced.
 *
 * Same shape as the storefront's `ProductSearch`, and for the same reasons: the
 * input holds local state so typing stays responsive, `pushed` stops our own
 * late-arriving navigation from resetting the box to what was typed 300ms ago,
 * and `replace` keeps the back button from retyping the query backwards.
 *
 * What differs is the scope — this searches name **or SKU**, which is the pair
 * an admin has to hand.
 */
function SearchBox({ filters }: { filters: AdminProductFilters }) {
  const router = useRouter();
  const [value, setValue] = useState(filters.q);
  const pushed = useRef(filters.q);

  // The URL is the source of truth, so `q` can change without us: a back
  // navigation, a "clear filters" link, a pasted URL. Follow it.
  useEffect(() => {
    if (filters.q === pushed.current) return;
    pushed.current = filters.q;
    setValue(filters.q);
  }, [filters.q]);

  useEffect(() => {
    if (value === filters.q) return;

    const timer = setTimeout(() => {
      pushed.current = value;
      router.replace(adminFilterHref(filters, { q: value }), { scroll: false });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [value, filters, router]);

  /** Skip the debounce for the deliberate actions: Enter, and the clear button. */
  function commit(next: string) {
    setValue(next);
    pushed.current = next;
    router.replace(adminFilterHref(filters, { q: next }), { scroll: false });
  }

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        commit(value);
      }}
      className="relative w-full lg:max-w-sm"
    >
      <SearchIcon
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <input
        type="search"
        name="q"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search by name or SKU"
        aria-label="Search products by name or SKU"
        className="h-9 w-full rounded-lg border border-border bg-background pr-9 pl-9 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => commit("")}
          aria-label="Clear search"
          className="absolute top-1/2 right-1.5 grid size-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <XIcon aria-hidden className="size-4" />
        </button>
      )}
    </form>
  );
}

/**
 * A native `<select>`, for the reason `ProductSortSelect` gives: each of these
 * is one linear choice, and the platform control already handles keyboard,
 * touch and screen readers better than a reimplementation would.
 */
function Select({
  id,
  label,
  value,
  onChange,
  children,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full appearance-none rounded-lg border border-border bg-background pr-8 pl-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:w-44"
      >
        {children}
      </select>
      <ChevronDownIcon
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}
