"use client";

import { useRouter } from "next/navigation";
import { ChevronDownIcon } from "lucide-react";

import type { OrderStatus } from "@/generated/prisma/enums";
import {
  ORDER_STATUS_FILTERS,
  orderFilterHref,
  type OrderFilters,
} from "@/lib/order-status";

/**
 * The status filter, written to `?status=`.
 *
 * A native `<select>` rather than a styled listbox, for the reason
 * `ProductSortSelect` gives: one linear choice, and the platform control
 * already handles keyboard, touch and screen readers better than a
 * reimplementation would.
 *
 * "All orders" posts an empty value, which `orderFilterHref` drops from the
 * URL — so clearing the filter returns to a clean `/account/orders` rather
 * than `?status=`.
 */
export default function OrderStatusFilter({
  filters,
}: {
  filters: OrderFilters;
}) {
  const router = useRouter();

  return (
    <div className="relative">
      <label htmlFor="order-status" className="sr-only">
        Filter orders by status
      </label>
      <select
        id="order-status"
        value={filters.status ?? ""}
        onChange={(event) =>
          router.push(
            orderFilterHref(filters, {
              status: (event.target.value || undefined) as
                | OrderStatus
                | undefined,
            }),
            { scroll: false },
          )
        }
        className="h-9 w-full appearance-none rounded-lg border border-border bg-background pr-8 pl-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:w-48"
      >
        {ORDER_STATUS_FILTERS.map((option) => (
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
