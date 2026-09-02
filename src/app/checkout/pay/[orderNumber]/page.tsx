import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LockIcon } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { formatPrice } from "@/lib/money";
import { OrderStatus } from "@/generated/prisma/enums";
import {
  buildCheckoutFields,
  getPayHereConfig,
  paymentCancelPath,
  paymentReturnPath,
} from "@/lib/payhere";
import { cn } from "@/lib/utils";
import { getCurrentUser } from "@/server/auth";
import { getPaymentOrderForUser } from "@/server/payments";

export const metadata: Metadata = {
  title: "Pay for your order",
  description: "Complete your payment with PayHere.",
  // Same reasoning as the confirmation page: an order number in a URL is not a
  // secret worth publishing, and ownership is enforced below regardless.
  robots: { index: false, follow: false },
};

/**
 * The hand-off to PayHere.
 *
 * `createOrder` has already committed the order and its stock as `PENDING`;
 * this page is the step between that and a payment. It exists as a page rather
 * than a redirect because PayHere's Checkout API is a **form POST**, and the
 * only thing that can POST a form from the visitor's browser is markup in their
 * browser.
 *
 * Every value in that form is built here, on the server, from the stored `Order`
 * row — never from the checkout form the visitor filled in a moment ago, and
 * never from a query string. The `hash` binds the merchant id, order number,
 * amount and currency together, so a browser that edits the `amount` input
 * produces a payload PayHere refuses. The merchant secret is what computes that
 * hash and it never leaves the server: `src/lib/payhere.ts` is `server-only`,
 * and what reaches this page is the 32-character digest, which is meant to be
 * public.
 *
 * The button is deliberately a button rather than a script that submits on
 * load. An auto-submitting page cannot be navigated back to, and this URL is
 * exactly where the cancelled page's "try again" link needs to land.
 */
export default async function PaymentPage({
  params,
}: PageProps<"/checkout/pay/[orderNumber]">) {
  const { orderNumber } = await params;

  // Deliberately not `requireAuth`. Bouncing a signed-out visitor to the login
  // page would confirm this order number exists before anyone has proved they
  // own it. Everyone who is not the owner gets the same 404.
  const user = await getCurrentUser();
  if (!user) notFound();

  const order = await getPaymentOrderForUser(orderNumber, user.id);
  if (!order) notFound();

  // Already settled one way or the other. Both of these are ordinary — a
  // reloaded tab, a back button after paying, a webhook that landed while this
  // page was open — and both have a page that explains themselves properly.
  if (order.status === OrderStatus.CANCELLED) {
    redirect(paymentCancelPath(orderNumber));
  }
  if (order.status !== OrderStatus.PENDING) {
    redirect(paymentReturnPath(orderNumber));
  }

  const config = getPayHereConfig();

  const { shipping } = order;

  const fields = config
    ? buildCheckoutFields(config, {
        orderNumber: order.orderNumber,
        total: order.total,
        items: `Order ${order.orderNumber} (${order.itemCount} ${
          order.itemCount === 1 ? "item" : "items"
        })`,
        customer: {
          fullName: shipping.name,
          // The account's email, not a field on the order — `Order` has no
          // email column, and this is only the address PayHere sends its own
          // receipt to.
          email: user.email,
          phone: shipping.phone,
          address: [shipping.line1, shipping.line2].filter(Boolean).join(", "),
          city: shipping.city,
        },
      })
    : null;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-8 px-4 py-12 sm:px-6">
      <header className="flex flex-col items-center gap-3 text-center">
        <LockIcon className="size-8 text-foreground" aria-hidden />

        <h1 className="text-3xl font-semibold tracking-tight">
          One step left — payment
        </h1>

        <p className="text-sm text-muted-foreground">
          Order{" "}
          <span className="font-medium text-foreground tabular-nums">
            {order.orderNumber}
          </span>{" "}
          is reserved for you. Paying takes you to PayHere and back.
        </p>
      </header>

      <div className="flex flex-col gap-5 rounded-xl border border-border p-5">
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-sm text-muted-foreground">Amount due</span>
          <span className="text-lg font-medium tabular-nums">
            {formatPrice(order.total)}
          </span>
        </div>

        <hr className="border-border" />

        {fields && config ? (
          <>
            {/* A plain, un-enhanced form post: no `action`, no Server Action,
                no fetch. It leaves this origin entirely, which is why every
                field is a hidden input rather than state a script assembles. */}
            <form method="post" action={config.checkoutUrl}>
              {Object.entries(fields).map(([name, value]) => (
                <input key={name} type="hidden" name={name} value={value} />
              ))}

              <Button type="submit" size="lg" className="w-full">
                Pay {formatPrice(order.total)}
              </Button>
            </form>

            <p className="text-xs text-muted-foreground">
              {config.isSandbox
                ? "Sandbox mode — this is PayHere's test gateway and no real money moves."
                : "You will be redirected to PayHere to complete the payment securely."}{" "}
              Your order stays reserved until the payment is confirmed.
            </p>
          </>
        ) : (
          // `getPayHereConfig` returns null when the merchant variables are
          // missing, and has already logged which. The visitor gets the fact,
          // not the list — which variables a deployment is missing is a hint
          // about the deployment.
          <p className="text-sm text-muted-foreground">
            Payments are not configured on this deployment, so this order cannot
            be paid for right now. It is saved under your account and nothing has
            been charged.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
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
