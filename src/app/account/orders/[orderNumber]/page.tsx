import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeftIcon } from "lucide-react";

import CancelOrderButton from "@/components/cancel-order-button";
import OrderStatusBadge from "@/components/order-status-badge";
import OrderStatusTimeline from "@/components/order-status-timeline";
import { formatOrderDate } from "@/lib/dates";
import { formatPrice } from "@/lib/money";
import { isCancellable, ORDERS_PATH } from "@/lib/order-status";
import { getUserOrderByNumber } from "@/server/orders";

export const metadata: Metadata = {
  title: "Order details",
  description: "One of your orders.",
  // The URL contains an order number. Ownership is enforced in the query;
  // this keeps the page out of an index on top of that.
  robots: { index: false, follow: false },
};

export default async function OrderDetailPage({
  params,
}: PageProps<"/account/orders/[orderNumber]">) {
  const { orderNumber } = await params;

  // `getUserOrderByNumber` scopes the query to the signed-in user and returns
  // `null` for anyone else's order number — including one that does not exist.
  // Both render this 404. A 403 would confirm the number is real, which is
  // exactly what someone working through `ORD-…-AAAA`, `ORD-…-AAAB` wants to
  // learn.
  const order = await getUserOrderByNumber(orderNumber);
  if (!order) notFound();

  const { shipping, totals } = order;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-12 sm:px-6 lg:px-8">
      <Link
        href={ORDERS_PATH}
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeftIcon className="size-4" aria-hidden />
        Back to my orders
      </Link>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight tabular-nums">
            {order.orderNumber}
          </h1>
          <p className="text-sm text-muted-foreground">
            Placed {formatOrderDate(order.placedAt)}
          </p>
          <OrderStatusBadge status={order.status} className="w-fit" />
        </div>

        {/* Rendered on the same rule the action enforces. The button being
            absent is not what stops a SHIPPED order being cancelled — the
            transaction is — but showing one that would only ever be refused
            would be a lie about what is still possible. */}
        {isCancellable(order.status) && (
          <CancelOrderButton orderNumber={order.orderNumber} />
        )}
      </header>

      <section className="flex flex-col gap-4 rounded-xl border border-border p-5">
        <h2 className="text-sm font-medium">Progress</h2>
        <OrderStatusTimeline status={order.status} />
      </section>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <section className="flex min-w-0 flex-1 flex-col gap-4 rounded-xl border border-border p-5">
          <h2 className="text-sm font-medium">Items</h2>

          <ul className="flex flex-col divide-y divide-border">
            {order.items.map((item) => (
              <li
                key={item.id}
                className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  {/* The name is the OrderItem snapshot either way. The live
                      product only decides whether it is a link: a deleted or
                      deactivated one has no page to open, and a link that 404s
                      is worse than plain text. */}
                  {item.productSlug ? (
                    <Link
                      href={`/products/${item.productSlug}`}
                      className="text-sm leading-snug font-medium underline-offset-4 hover:underline"
                    >
                      {item.productName}
                    </Link>
                  ) : (
                    <p className="text-sm leading-snug font-medium">
                      {item.productName}
                    </p>
                  )}

                  <p className="text-xs text-muted-foreground tabular-nums">
                    {formatPrice(item.unitPrice)} × {item.quantity}
                  </p>
                </div>

                <p className="shrink-0 text-sm font-medium tabular-nums">
                  {formatPrice(item.lineTotal)}
                </p>
              </li>
            ))}
          </ul>

          <hr className="border-border" />

          <dl className="flex flex-col gap-2">
            <SummaryRow label="Subtotal" value={formatPrice(totals.subtotal)} />
            <SummaryRow label="Shipping" value={formatPrice(totals.shippingFee)} />

            <div className="mt-1 flex items-baseline justify-between gap-4 border-t border-border pt-3">
              <dt className="text-sm font-medium">Total</dt>
              <dd className="text-lg font-medium tabular-nums">
                {formatPrice(totals.total)}
              </dd>
            </div>
          </dl>
        </section>

        <section className="flex w-full shrink-0 flex-col gap-3 rounded-xl border border-border p-5 lg:w-80">
          <h2 className="text-sm font-medium">Shipped to</h2>

          {/* The order's own `shipping*` columns. Editing or deleting the saved
              address this was copied from must not change where this order
              says it went. */}
          <address className="flex flex-col gap-0.5 text-sm text-muted-foreground not-italic">
            <span className="font-medium text-foreground">{shipping.name}</span>
            <span>{shipping.line1}</span>
            {shipping.line2 ? <span>{shipping.line2}</span> : null}
            <span>
              {shipping.city} {shipping.postalCode}
            </span>
            <span className="tabular-nums">{shipping.phone}</span>
          </address>
        </section>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm tabular-nums">{value}</dd>
    </div>
  );
}
