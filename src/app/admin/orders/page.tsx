import Link from "next/link";
import type { Metadata } from "next";
import { ChevronRightIcon } from "lucide-react";

import AdminOrderFiltersBar from "@/components/admin/admin-order-filters";
import AdminPageHeader from "@/components/admin/admin-page-header";
import OrderStatusBadge from "@/components/order-status-badge";
import Pagination from "@/components/pagination";
import { buttonVariants } from "@/components/ui/button";
import {
  ADMIN_ORDERS_PATH,
  adminOrderFilterCount,
  adminOrdersHref,
  clearedAdminOrderFilters,
  parseAdminOrderFilters,
  withAdminOrderFilters,
} from "@/lib/admin-order-filters";
import { colomboToday, formatOrderDate } from "@/lib/dates";
import { formatPrice } from "@/lib/money";
import { cn } from "@/lib/utils";
import { listAdminOrders, type AdminOrderListItem } from "@/server/admin-orders";
import { requireAdmin } from "@/server/auth";

export const metadata: Metadata = {
  title: "Orders · Admin",
  // These rows carry other people's names, addresses and order numbers.
  // `requireAdmin` is what protects them; this keeps them out of an index too.
  robots: { index: false, follow: false },
};

/**
 * Every order in the shop, from every customer.
 *
 * That is the difference from `/account/orders`, which scopes its query to the
 * signed-in user. The query behind this one has no ownership condition at all,
 * which is why `requireAdmin` runs before it — here, in the layout above, and
 * again in the Server Action, because none of the three covers the other two.
 *
 * All of the list state — search, status, both date bounds, sort and page — is
 * read from the URL and validated by `parseAdminOrderFilters`, which falls every
 * field back to a default rather than throwing. `?sort=drop-table` sorts newest
 * first; `?from=2026-02-31` is not a date and becomes no filter. That matters
 * more here than on the storefront: these params reach a query over every
 * customer's orders.
 *
 * The five axes compose. Searching a name, narrowing to Processing, bounding it
 * to last week and sorting by total is one `where` and one `orderBy`, not four
 * passes that overwrite each other.
 */
export default async function AdminOrdersPage({
  searchParams,
}: PageProps<"/admin/orders">) {
  await requireAdmin(ADMIN_ORDERS_PATH);

  const filters = parseAdminOrderFilters(await searchParams);

  const { orders, total, page, pageCount } = await listAdminOrders({
    page: filters.page,
    q: filters.q,
    status: filters.status,
    from: filters.from,
    to: filters.to,
    sort: filters.sort,
  });

  const narrowed = adminOrderFilterCount(filters) > 0;

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <AdminPageHeader
        title="Orders"
        description={total === 1 ? "1 order matches." : `${total} orders match.`}
      />

      <AdminOrderFiltersBar filters={filters} today={colomboToday()} />

      {orders.length === 0 ? (
        <EmptyState
          narrowed={narrowed}
          clearHref={adminOrdersHref(clearedAdminOrderFilters(filters))}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-background">
          {/* The table scrolls sideways inside its own box rather than making
              the page scroll. An email address and an order number do not fit
              a phone together, and squeezing them would cost one of them. */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[56rem] text-sm">
              <caption className="sr-only">
                Every order, newest first unless sorted otherwise. Each row opens
                the order.
              </caption>

              <thead className="border-b border-border bg-muted/50 text-left text-xs text-muted-foreground uppercase">
                <tr>
                  <th scope="col" className="px-3 py-2.5 font-medium">Order</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Customer</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Placed</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Items</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Total</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
                  <th scope="col" className="w-10 px-3 py-2.5">
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border">
                {orders.map((order) => (
                  <OrderRow key={order.orderNumber} order={order} />
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
        hrefForPage={(next) =>
          adminOrdersHref(withAdminOrderFilters(filters, { page: next }))
        }
      />
    </div>
  );
}

/**
 * One row, and the whole of it is the link.
 *
 * A `<tr>` cannot be an anchor, and wrapping the click in JavaScript would break
 * middle-click, ⌘-click and "copy link address" — the three things anyone
 * working through a list of orders actually does. So the order number is a real
 * `<a href>` and its `::after` is stretched over the positioned row. One link,
 * one target, every browser affordance intact.
 */
function OrderRow({ order }: { order: AdminOrderListItem }) {
  return (
    <tr className="relative transition-colors hover:bg-muted/50 focus-within:bg-muted/50">
      <td className="px-3 py-2.5">
        <Link
          href={`${ADMIN_ORDERS_PATH}/${order.orderNumber}`}
          className="font-medium tabular-nums underline-offset-4 outline-none after:absolute after:inset-0 hover:underline focus-visible:underline"
        >
          {order.orderNumber}
        </Link>
      </td>

      <td className="px-3 py-2.5">
        <div className="flex flex-col">
          <span className="font-medium">{order.customerName}</span>
          {/* Not a `mailto:` link — a second anchor inside the row would sit
              under the stretched one and be unclickable anyway. */}
          <span className="text-xs text-muted-foreground">
            {order.customerEmail ?? "Account deleted"}
          </span>
        </div>
      </td>

      <td className="px-3 py-2.5 text-muted-foreground">
        {formatOrderDate(order.placedAt)}
      </td>

      <td className="px-3 py-2.5 text-right tabular-nums">{order.itemCount}</td>

      {/* Formatted on the server: `total` is a Decimal, and one handed straight
          to JSX would not survive serialisation to the client. */}
      <td className="px-3 py-2.5 text-right font-medium tabular-nums">
        {formatPrice(order.total)}
      </td>

      <td className="px-3 py-2.5">
        <OrderStatusBadge status={order.status} />
      </td>

      <td className="px-3 py-2.5">
        <ChevronRightIcon
          aria-hidden
          className="size-4 text-muted-foreground"
        />
      </td>
    </tr>
  );
}

/**
 * Nothing matched.
 *
 * The two cases are genuinely different: a shop that has never sold anything
 * needs no action, a filtered-to-nothing table needs the way back out. Offering
 * "clear filters" when nothing is filtered would be a button that changes
 * nothing.
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
          ? "No orders match these filters."
          : "No orders have been placed yet."}
      </p>

      {narrowed ? (
        <Link
          href={clearHref}
          // `cn` is not optional here: it is what drops the
          // `border-transparent` in the button base that would otherwise beat
          // `border-border`.
          className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
        >
          Clear filters
        </Link>
      ) : null}
    </div>
  );
}
