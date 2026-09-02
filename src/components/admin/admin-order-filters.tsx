"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDownIcon, SearchIcon, XIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import type { OrderStatus } from "@/generated/prisma/enums";
import {
  ADMIN_ORDER_SORTS,
  adminOrderFilterCount,
  adminOrderFilterHref,
  adminOrdersHref,
  clearedAdminOrderFilters,
  type AdminOrderFilters,
  type AdminOrderSort,
} from "@/lib/admin-order-filters";
import { ORDER_STATUS_FILTERS } from "@/lib/order-status";
import { cn } from "@/lib/utils";

/**
 * Search, the status filter, the date range and the sort order for the order
 * table.
 *
 * Every control writes to the URL and nothing else — the table is rendered from
 * `searchParams` on the server, so these five inputs hold no results state
 * between them. That is what makes a filtered view survive a refresh, open the
 * same way in a second tab, and come back unchanged after opening an order.
 *
 * The search box debounces; everything else navigates immediately. A dropdown or
 * a date picker is a finished decision, and waiting 300ms to act on one only
 * feels broken.
 *
 * "Clear filters" appears only when something is narrowing the list, and it
 * keeps the chosen sort order — clearing a search should not also un-sort the
 * table you were reading.
 */

/** Long enough to skip the letters of a word, short enough to feel live. */
const DEBOUNCE_MS = 300;

export default function AdminOrderFiltersBar({
  filters,
  today,
}: {
  filters: AdminOrderFilters;
  /**
   * Today in Colombo, as `YYYY-MM-DD`. Computed on the server and passed down
   * rather than read from the browser clock, so the rendered `max` is the same
   * on both sides of hydration.
   */
  today: string;
}) {
  const router = useRouter();
  const narrowed = adminOrderFilterCount(filters) > 0;

  /** One filter changed: rebuild the URL and go there. */
  function apply(patch: Partial<AdminOrderFilters>) {
    router.push(adminOrderFilterHref(filters, patch), { scroll: false });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchBox filters={filters} />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:ml-auto lg:w-auto">
          <Select
            id="admin-order-status"
            label="Filter by status"
            value={filters.status ?? ""}
            onChange={(value) =>
              // `""` is "every status", which must clear the param rather than
              // set it to an empty string — the serialiser drops `undefined`,
              // so the URL goes back to being clean.
              apply({ status: (value || undefined) as OrderStatus | undefined })
            }
          >
            {ORDER_STATUS_FILTERS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>

          <Select
            id="admin-order-sort"
            label="Sort orders"
            value={filters.sort}
            onChange={(value) => apply({ sort: value as AdminOrderSort })}
          >
            {ADMIN_ORDER_SORTS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        {/* Two bounds rather than a range picker: `type="date"` is the platform
            control, so it comes with a keyboard path, a native calendar on
            touch, and a text format the browser localises for free. `max` stops
            the obvious mistake of a future date; an inverted range is still
            possible and honestly matches nothing. */}
        <DateField
          id="admin-order-from"
          label="From"
          value={filters.from ?? ""}
          max={filters.to ?? today}
          onChange={(value) => apply({ from: value || undefined })}
        />

        <DateField
          id="admin-order-to"
          label="To"
          value={filters.to ?? ""}
          min={filters.from}
          max={today}
          onChange={(value) => apply({ to: value || undefined })}
        />

        {narrowed ? (
          <Link
            href={adminOrdersHref(clearedAdminOrderFilters(filters))}
            // `cn` is not optional: it is what drops the `border-transparent`
            // in the button base that would otherwise beat `border-border`.
            className={cn(
              buttonVariants({ variant: "outline" }),
              "sm:ml-auto",
            )}
          >
            <XIcon aria-hidden />
            Clear filters
          </Link>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The search box, debounced.
 *
 * Same shape as `AdminProductFiltersBar`'s, and for the same reasons: the input
 * holds local state so typing stays responsive, `pushed` stops our own
 * late-arriving navigation from resetting the box to what was typed 300ms ago,
 * and `replace` keeps the back button from retyping the query backwards.
 *
 * What differs is the scope — this searches an order number, a customer name or
 * a customer email, which is what an admin has in front of them when somebody
 * gets in touch.
 */
function SearchBox({ filters }: { filters: AdminOrderFilters }) {
  const router = useRouter();
  const [value, setValue] = useState(filters.q);
  const pushed = useRef(filters.q);

  // The URL is the source of truth, so `q` can change without us: a back
  // navigation, a "clear filters" link, the customer link on a detail page, a
  // pasted URL. Follow it.
  useEffect(() => {
    if (filters.q === pushed.current) return;
    pushed.current = filters.q;
    setValue(filters.q);
  }, [filters.q]);

  useEffect(() => {
    if (value === filters.q) return;

    const timer = setTimeout(() => {
      pushed.current = value;
      router.replace(adminOrderFilterHref(filters, { q: value }), {
        scroll: false,
      });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [value, filters, router]);

  /** Skip the debounce for the deliberate actions: Enter, and the clear button. */
  function commit(next: string) {
    setValue(next);
    pushed.current = next;
    router.replace(adminOrderFilterHref(filters, { q: next }), {
      scroll: false,
    });
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
        placeholder="Search by order number, name or email"
        aria-label="Search orders by order number, customer name or email"
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
 * One end of the date range. The label is visible rather than `sr-only`: an
 * empty date input reads as an empty box, and "From"/"To" is the only thing
 * that says which end of the range it is.
 */
function DateField({
  id,
  label,
  value,
  min,
  max,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  min?: string;
  max?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <input
        id={id}
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:w-44"
      />
    </div>
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
        className="h-9 w-full appearance-none rounded-lg border border-border bg-background pr-8 pl-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:w-48"
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
