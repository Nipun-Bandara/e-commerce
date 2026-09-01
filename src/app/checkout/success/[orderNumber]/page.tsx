import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CircleCheckIcon } from "lucide-react";

import OrderSummary from "@/components/order-summary";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getCurrentUser } from "@/server/auth";
import { getOrderByNumberForUser } from "@/server/orders";

export const metadata: Metadata = {
  title: "Order confirmed",
  description: "Your order has been placed.",
  // An order number in a URL is not a secret worth publishing. Ownership is
  // already enforced below; this stops the page being indexed on top of it.
  robots: { index: false, follow: false },
};

/** The store ships from Colombo, so that is the day an order was placed on. */
const placedAtFormat = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "long",
  timeZone: "Asia/Colombo",
});

export default async function OrderConfirmationPage({
  params,
}: PageProps<"/checkout/success/[orderNumber]">) {
  const { orderNumber } = await params;

  // Deliberately not `requireAuth`. Bouncing a signed-out visitor to the login
  // page would confirm that this order number exists before anyone has proved
  // they own it. Everyone who is not the owner — signed out, signed in as
  // someone else, or guessing — gets the same 404, which is the only answer
  // that reveals nothing.
  const user = await getCurrentUser();
  if (!user) notFound();

  const order = await getOrderByNumberForUser(orderNumber, user.id);
  if (!order) notFound();

  const { shipping } = order;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-12 sm:px-6 lg:px-8">
      <header className="flex flex-col items-center gap-3 text-center">
        <CircleCheckIcon className="size-10 text-foreground" aria-hidden />

        <h1 className="text-3xl font-semibold tracking-tight">
          Thank you — your order is placed
        </h1>

        <p className="text-sm text-muted-foreground">
          Order{" "}
          <span className="font-medium text-foreground tabular-nums">
            {order.orderNumber}
          </span>
          , placed {placedAtFormat.format(order.placedAt)}.
        </p>

        <Badge variant="secondary">{titleCase(order.status)}</Badge>
      </header>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <section className="flex min-w-0 flex-1 flex-col gap-3 rounded-xl border border-border p-5">
          <h2 className="text-sm font-medium">Shipping to</h2>

          {/* Read from the order's own `shipping*` columns. Editing or deleting
              the saved Address this was copied from must not change what this
              page says. */}
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

        <div className="w-full shrink-0 lg:w-80">
          {/* Every figure here is a stored column: the item names and unit
              prices are OrderItem snapshots, the totals are the ones written
              when the order was created. Renaming or repricing a product does
              not touch any of them. */}
          <OrderSummary
            lines={order.items.map((item) => ({
              id: item.id,
              name: item.productName,
              unitPrice: item.unitPrice,
              quantity: item.quantity,
              lineTotal: item.lineTotal,
            }))}
            totals={order.totals}
            heading="What you ordered"
          />
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        {/* Order history is a later feature; /account is where it will live,
            and is the page that already knows who is asking. */}
        <Link href="/account" className={cn(buttonVariants({ variant: "outline" }))}>
          View my orders
        </Link>

        <Link href="/products" className={cn(buttonVariants())}>
          Continue shopping
        </Link>
      </div>
    </div>
  );
}

/** `PENDING` reads as shouting in a sentence people are meant to be reassured by. */
function titleCase(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase();
}
