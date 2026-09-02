import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeftIcon, MailIcon } from "lucide-react";

import OrderStatusControl from "@/components/admin/order-status-control";
import AdminPageHeader from "@/components/admin/admin-page-header";
import OrderStatusBadge from "@/components/order-status-badge";
import OrderStatusTimeline from "@/components/order-status-timeline";
import {
  ADMIN_ORDERS_PATH,
  customerOrdersHref,
} from "@/lib/admin-order-filters";
import { formatOrderDate, formatOrderDateTime } from "@/lib/dates";
import { formatPrice } from "@/lib/money";
import { getAdminOrderByNumber } from "@/server/admin-orders";
import { requireAdmin } from "@/server/auth";

export const metadata: Metadata = {
  title: "Order · Admin",
  // A customer's name, address and phone number are on this page.
  robots: { index: false, follow: false },
};

/**
 * One order, in full, with the control that moves it along.
 *
 * ## Everything shown here is a snapshot
 *
 * The line items are `OrderItem.productName` and `OrderItem.unitPrice`; the
 * address is the order's own `shipping*` columns. `getAdminOrderByNumber` does
 * not select the `Product` relation at all, so there is no live row on this page
 * to read by accident. Renaming a product, repricing it, deleting it or editing
 * the saved address the order was copied from must not change what this order
 * says it was — and this is the screen somebody opens to settle exactly that.
 *
 * The names are therefore not links to product pages, unlike the customer's own
 * order view. There is nothing here to link *from*: the snapshot is a string,
 * and finding today's product for it is what the product search is for.
 *
 * ## The timeline is derived, not recorded
 *
 * The schema stores `createdAt` and `updatedAt` and no per-transition history,
 * so the progress bar draws the stages up to the current one and the header
 * gives the two timestamps that do exist. Inventing dates for the stages in
 * between would be worse than not showing them.
 */
export default async function AdminOrderDetailPage({
  params,
}: PageProps<"/admin/orders/[orderNumber]">) {
  const { orderNumber } = await params;

  await requireAdmin(`${ADMIN_ORDERS_PATH}/${orderNumber}`);

  const order = await getAdminOrderByNumber(orderNumber);
  if (!order) notFound();

  const { customer, shipping, totals } = order;

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <Link
        href={ADMIN_ORDERS_PATH}
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeftIcon className="size-4" aria-hidden />
        Back to orders
      </Link>

      <AdminPageHeader
        title={order.orderNumber}
        description={
          <>
            Placed {formatOrderDate(order.placedAt)} · Last updated{" "}
            {formatOrderDateTime(order.updatedAt)}
          </>
        }
        actions={<OrderStatusBadge status={order.status} />}
      />

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <Section title="Progress">
            <OrderStatusTimeline status={order.status} />
          </Section>

          <Section title="Change status">
            <OrderStatusControl
              orderNumber={order.orderNumber}
              status={order.status}
            />
          </Section>

          <Section title="Items">
            <ul className="flex flex-col divide-y divide-border">
              {order.items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    {/* The `OrderItem` snapshot. Not the live product name, and
                        not a link to it — see the note at the top. */}
                    <p className="text-sm leading-snug font-medium">
                      {item.productName}
                    </p>
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
              <SummaryRow
                label="Shipping"
                value={formatPrice(totals.shippingFee)}
              />

              <div className="mt-1 flex items-baseline justify-between gap-4 border-t border-border pt-3">
                <dt className="text-sm font-medium">Total</dt>
                <dd className="text-lg font-medium tabular-nums">
                  {formatPrice(totals.total)}
                </dd>
              </div>
            </dl>
          </Section>
        </div>

        <div className="flex w-full shrink-0 flex-col gap-6 lg:w-80">
          <Section title="Customer">
            <div className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{customer.name}</span>

              {customer.email ? (
                <a
                  href={`mailto:${customer.email}`}
                  className="flex items-center gap-1.5 text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  <MailIcon className="size-3.5 shrink-0" aria-hidden />
                  {customer.email}
                </a>
              ) : (
                <span className="text-muted-foreground">
                  This account has been deleted. The order keeps its own copy of
                  the name and address below.
                </span>
              )}
            </div>

            {customer.email ? (
              // The list, filtered by this email. The search covers customer
              // email, so this is the same screen an admin would have reached
              // by typing it into the box.
              <Link
                href={customerOrdersHref(customer.email)}
                className="text-sm underline underline-offset-4 hover:text-muted-foreground"
              >
                See their other orders
              </Link>
            ) : null}
          </Section>

          <Section title="Shipped to">
            {/* The order's own `shipping*` columns. Editing or deleting the
                saved address this was copied from must not change where this
                order says it went. */}
            <address className="flex flex-col gap-0.5 text-sm text-muted-foreground not-italic">
              <span className="font-medium text-foreground">
                {shipping.name}
              </span>
              <span>{shipping.line1}</span>
              {shipping.line2 ? <span>{shipping.line2}</span> : null}
              <span>
                {shipping.city} {shipping.postalCode}
              </span>
              <span className="tabular-nums">{shipping.phone}</span>
            </address>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-background p-5">
      <h2 className="text-sm font-medium">{title}</h2>
      {children}
    </section>
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
