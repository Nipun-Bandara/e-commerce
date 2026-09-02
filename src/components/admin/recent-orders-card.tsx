import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";

import OrderStatusBadge from "@/components/order-status-badge";
import { ADMIN_ORDERS_PATH } from "@/lib/admin-order-filters";
import { formatOrderDate } from "@/lib/dates";
import { formatPrice } from "@/lib/money";
import type { AdminOrderListItem } from "@/server/admin-orders";

/**
 * The newest orders, on the dashboard.
 *
 * A Server Component that fetches nothing: the page hands it rows, so the money
 * is formatted here on the server — a `Decimal` handed to a Client Component
 * would not survive serialisation, and `Number(total)` to work around that is
 * the float round-trip `lib/money.ts` exists to prevent.
 *
 * Same stretched-link row as the full table, for the same reason: a `<tr>`
 * cannot be an anchor, and a JavaScript click handler would break ⌘-click.
 * These are `<li>`s rather than a table because five rows with no headers is a
 * list, and a table of them would be a table for the sake of alignment.
 */
export default function RecentOrdersCard({
  orders,
}: {
  orders: AdminOrderListItem[];
}) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-background p-5">
      <header className="flex items-baseline justify-between gap-4">
        <h2 className="text-sm font-medium">Recent orders</h2>

        <Link
          href={ADMIN_ORDERS_PATH}
          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          See all orders
        </Link>
      </header>

      {orders.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No orders have been placed yet.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {orders.map((order) => (
            <li
              key={order.orderNumber}
              className="relative flex items-center gap-3 py-3 transition-colors first:pt-0 last:pb-0 hover:bg-muted/40 focus-within:bg-muted/40"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Link
                    href={`${ADMIN_ORDERS_PATH}/${order.orderNumber}`}
                    className="text-sm font-medium tabular-nums underline-offset-4 outline-none after:absolute after:inset-0 hover:underline focus-visible:underline"
                  >
                    {order.orderNumber}
                  </Link>
                  <OrderStatusBadge status={order.status} />
                </div>

                <p className="truncate text-xs text-muted-foreground">
                  {order.customerName} · {formatOrderDate(order.placedAt)}
                </p>
              </div>

              <span className="shrink-0 text-sm font-medium tabular-nums">
                {formatPrice(order.total)}
              </span>

              <ChevronRightIcon
                aria-hidden
                className="size-4 shrink-0 text-muted-foreground"
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
