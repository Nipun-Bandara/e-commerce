import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import CheckoutForm from "@/components/checkout-form";
import OrderSummary from "@/components/order-summary";
import { listAddresses } from "@/server/addresses";
import { requireAuth } from "@/server/auth";
import { getCheckoutSummary } from "@/server/checkout";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Confirm where your order is going.",
};

export default async function CheckoutPage() {
  // Not a formality because the proxy already redirected: the proxy reads a
  // cookie, this reads the session the page renders from, and it is the one
  // that runs if the matcher ever stops covering this route.
  const user = await requireAuth("/checkout");

  const summary = await getCheckoutSummary(user.id);

  // Nothing to buy — most often because the order was just placed and the back
  // button came here. The cart page says so properly.
  if (summary.status === "empty") redirect("/cart");

  // Something moved in the catalogue while this cart sat there. The cart page
  // re-reads it and labels each affected row; `?checkout=changed` is only what
  // tells it to explain why the visitor is back.
  if (summary.status === "changed") redirect("/cart?checkout=changed");

  const addresses = await listAddresses(user.id);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">Checkout</h1>
        <p className="text-sm text-muted-foreground">
          Where should this order go?{" "}
          <Link href="/cart" className="underline underline-offset-4">
            Back to cart
          </Link>
        </p>
      </header>

      <div className="flex flex-col gap-10 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          <CheckoutForm addresses={addresses} suggestedName={user.name} />
        </div>

        <aside className="w-full shrink-0 lg:sticky lg:top-20 lg:w-80">
          {/* Priced from the Product table a moment ago, and priced again the
              same way inside the transaction. These are the figures that get
              stored on the order. */}
          <OrderSummary
            lines={summary.lines.map((line) => ({
              id: line.productId,
              name: line.name,
              unitPrice: line.unitPrice,
              quantity: line.quantity,
              lineTotal: line.lineTotal,
            }))}
            totals={summary.totals}
          />
        </aside>
      </div>
    </div>
  );
}
