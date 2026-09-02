import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CircleAlertIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { OrderStatus } from "@/generated/prisma/enums";
import { formatPrice } from "@/lib/money";
import { paymentPath, paymentReturnPath } from "@/lib/payhere";
import { cn } from "@/lib/utils";
import { getCurrentUser } from "@/server/auth";
import { getPaymentOrderForUser } from "@/server/payments";

export const metadata: Metadata = {
  title: "Payment not completed",
  description: "Your payment was not completed.",
  robots: { index: false, follow: false },
};

/**
 * Where PayHere sends the browser when someone backs out of paying.
 *
 * Like the success page, this is only a redirect target and writes nothing.
 * Arriving here does not cancel anything — PayHere sends its own `cancelled`
 * notification to the webhook, and that is what closes the order and puts the
 * stock back. So the page reads the status and finds one of two situations:
 *
 *  - **Still `PENDING`.** The usual case, and often the only one, because the
 *    browser gets here faster than the webhook does. The order is intact, its
 *    stock is still held for it, and "try again" is a link back to the same
 *    hand-off page for the same order. There is deliberately no path from here
 *    that creates a second order — a visitor who paid on the second attempt
 *    would otherwise own two, one of them holding stock forever.
 *  - **`CANCELLED`.** The webhook has landed and the order is closed for good.
 *    Its stock has already gone back on sale, so offering to pay for it would
 *    be offering to buy units the shop may no longer have.
 *
 * An order that turns out to be paid is not a cancellation at all — a
 * notification that beat the redirect, or a stale tab — and belongs on the
 * confirmation page.
 */
export default async function PaymentCancelledPage({
  params,
}: PageProps<"/checkout/cancelled/[orderNumber]">) {
  const { orderNumber } = await params;

  // Same 404-for-everyone-else rule as the other two checkout pages: a
  // redirect to login would confirm the order number is real.
  const user = await getCurrentUser();
  if (!user) notFound();

  const order = await getPaymentOrderForUser(orderNumber, user.id);
  if (!order) notFound();

  if (
    order.status !== OrderStatus.PENDING &&
    order.status !== OrderStatus.CANCELLED
  ) {
    redirect(paymentReturnPath(orderNumber));
  }

  const canRetry = order.status === OrderStatus.PENDING;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-8 px-4 py-12 sm:px-6">
      <header className="flex flex-col items-center gap-3 text-center">
        <CircleAlertIcon className="size-10 text-foreground" aria-hidden />

        <h1 className="text-3xl font-semibold tracking-tight">
          Your payment was not completed
        </h1>

        <p className="text-sm text-muted-foreground">
          Order{" "}
          <span className="font-medium text-foreground tabular-nums">
            {order.orderNumber}
          </span>{" "}
          for{" "}
          <span className="tabular-nums">{formatPrice(order.total)}</span> was
          not paid for, and nothing has been charged.
        </p>

        <p className="max-w-prose pt-2 text-sm text-muted-foreground">
          {canRetry
            ? "The order is still here and the items are still reserved for it. You can pick up where you left off — this will not create a second order."
            : "The order has been closed and the items have gone back on sale. Nothing was charged. You are welcome to order them again."}
        </p>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        {canRetry ? (
          <Link
            href={paymentPath(order.orderNumber)}
            className={cn(buttonVariants())}
          >
            Try again
          </Link>
        ) : (
          <Link href="/products" className={cn(buttonVariants())}>
            Continue shopping
          </Link>
        )}

        <Link
          href="/account/orders"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          View my orders
        </Link>
      </div>
    </div>
  );
}
