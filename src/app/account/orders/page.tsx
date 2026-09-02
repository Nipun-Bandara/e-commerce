import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRightIcon, PackageIcon } from "lucide-react";

import OrderStatusBadge from "@/components/order-status-badge";
import OrderStatusFilter from "@/components/order-status-filter";
import Pagination from "@/components/pagination";
import { buttonVariants } from "@/components/ui/button";
import { formatOrderDate } from "@/lib/dates";
import { formatPrice } from "@/lib/money";
import {
  ORDER_STATUS_LABELS,
  ordersHref,
  parseOrderFilters,
  withOrderFilters,
  type OrderFilters,
} from "@/lib/order-status";
import { cn } from "@/lib/utils";
import { requireAuth } from "@/server/auth";
import { getUserOrders } from "@/server/orders";

export const metadata: Metadata = {
  title: "My orders",
  description: "Every order you have placed.",
  // Nothing under /account is for a crawler, and these URLs carry order
  // numbers. Ownership is enforced in the query; this stops the pages being
  // indexed on top of it.
  robots: { index: false, follow: false },
};

export default async function OrdersPage({
  searchParams,
}: PageProps<"/account/orders">) {
  const filters = parseOrderFilters(await searchParams);

  // Not a formality because the proxy already redirected: the proxy reads a
  // cookie, this reads the session the page renders from, and it is the one
  // that runs if the matcher ever stops covering this route. The callback URL
  // carries the filters, so logging back in returns to the view that was open.
  await requireAuth(ordersHref(filters));

  const { orders, total, page, pageCount } = await getUserOrders({
    page: filters.page,
    status: filters.status,
  });

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-12 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">My orders</h1>
          <p className="text-sm text-muted-foreground">
            Everything you have ordered, newest first.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p aria-live="polite" className="text-sm text-muted-foreground">
            {total === 1 ? "1 order" : `${total} orders`}
            {filters.status
              ? ` · ${ORDER_STATUS_LABELS[filters.status].toLowerCase()}`
              : ""}
          </p>

          <OrderStatusFilter filters={filters} />
        </div>
      </header>

      {orders.length === 0 ? (
        <EmptyOrders filters={filters} />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {orders.map((order) => (
            <li key={order.orderNumber}>
              {/* The whole row is the link, so the target is the row rather
                  than a word inside it. */}
              <Link
                href={`/account/orders/${order.orderNumber}`}
                className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-sm font-medium tabular-nums">
                      {order.orderNumber}
                    </span>
                    <OrderStatusBadge status={order.status} />
                  </div>

                  <p className="text-sm text-muted-foreground">
                    {formatOrderDate(order.placedAt)} ·{" "}
                    {order.itemCount === 1 ? "1 item" : `${order.itemCount} items`}
                  </p>
                </div>

                <span className="shrink-0 text-sm font-medium tabular-nums">
                  {formatPrice(order.total)}
                </span>

                <ChevronRightIcon
                  aria-hidden
                  className="size-4 shrink-0 text-muted-foreground"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Pagination
        page={page}
        pageCount={pageCount}
        hrefForPage={(next) => ordersHref(withOrderFilters(filters, { page: next }))}
      />
    </div>
  );
}

/**
 * Nothing to show — which is two different situations.
 *
 * A filtered view with no matches is not an empty history, and telling someone
 * with forty delivered orders that they have never ordered anything because
 * they picked "Cancelled" would be nonsense. So the filtered case names the
 * filter and offers the way back out of it.
 */
function EmptyOrders({ filters }: { filters: OrderFilters }) {
  const { status } = filters;

  if (status !== undefined) {
    return (
      <EmptyState
        title={`No ${ORDER_STATUS_LABELS[status].toLowerCase()} orders`}
        body="Nothing here matches that status. Try another one, or show them all."
      >
        <Link
          href={ordersHref(withOrderFilters(filters, { status: undefined }))}
          // `cn` is not optional here: it is what drops the
          // `border-transparent` in the button base that would otherwise beat
          // `border-border`.
          className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
        >
          Show all orders
        </Link>
      </EmptyState>
    );
  }

  return (
    <EmptyState
      title="You have not placed any orders yet"
      body="When you order something, it will show up here with its status and total."
    >
      <Link href="/products" className={cn(buttonVariants({ size: "lg" }))}>
        Browse products
      </Link>
    </EmptyState>
  );
}

function EmptyState({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border px-6 py-16 text-center">
      <PackageIcon className="mx-auto size-8 text-muted-foreground" aria-hidden />
      <p className="mt-3 text-sm font-medium">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{body}</p>
      <div className="mt-4 flex justify-center">{children}</div>
    </div>
  );
}
