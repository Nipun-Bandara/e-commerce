import type { Metadata } from "next";
import Link from "next/link";
import { ShoppingBagIcon, TriangleAlertIcon } from "lucide-react";

import CartClearButton from "@/components/cart-clear-button";
import CartItemRow from "@/components/cart-item-row";
import CheckoutButton from "@/components/checkout-button";
import { buttonVariants } from "@/components/ui/button";
import { formatPrice } from "@/lib/money";
import { cn } from "@/lib/utils";
import { getCart } from "@/server/cart";

export const metadata: Metadata = {
  title: "Your cart",
  description: "Review the items in your cart before checking out.",
};

/** What checkout sets on the query string when it sends someone back here. */
const BOUNCED_FROM_CHECKOUT = "changed";

export default async function CartPage({ searchParams }: PageProps<"/cart">) {
  const { checkout } = await searchParams;
  const cart = await getCart();

  if (cart.items.length === 0) return <EmptyCart />;

  // The same three conditions checkout revalidates against. Rows carry their
  // own explanation — `CartItemRow` renders a warning with a way out of each —
  // so this only decides whether the way forward is open.
  const blockedItems = cart.items.filter((item) => item.issue).length;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
      <header className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">Your cart</h1>
          <p className="text-sm text-muted-foreground">
            {cart.itemCount === 1 ? "1 item" : `${cart.itemCount} items`}
          </p>
        </div>

        <CartClearButton />
      </header>

      {checkout === BOUNCED_FROM_CHECKOUT ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
        >
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          Some of these items changed while they were in your cart, so checkout
          stopped rather than order something different from what you reviewed.
          Each affected row below says what happened.
        </p>
      ) : null}

      <div className="flex flex-col gap-10 lg:flex-row lg:items-start">
        <ul className="min-w-0 flex-1">
          {cart.items.map((item) => (
            <CartItemRow key={item.id} item={item} />
          ))}
        </ul>

        <aside className="w-full shrink-0 lg:sticky lg:top-20 lg:w-80">
          <div className="flex flex-col gap-4 rounded-xl border border-border p-5">
            <h2 className="text-sm font-medium">Order summary</h2>

            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">Subtotal</span>
              <span className="text-lg font-medium tabular-nums">
                {formatPrice(cart.subtotal)}
              </span>
            </div>

            <p className="text-xs text-muted-foreground">
              Delivery is calculated at checkout.
            </p>

            {/* The empty case is checked here as well as by the early return
                above, so the rule "no items, no checkout" does not depend on a
                branch somewhere else in the file staying where it is. */}
            <CheckoutButton
              blocked={cart.items.length === 0 || blockedItems > 0}
              blockedReason={
                blockedItems > 0
                  ? `Sort out ${blockedItems === 1 ? "the item" : `the ${blockedItems} items`} flagged above to continue.`
                  : undefined
              }
            />

            <Link
              href="/products"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "w-full",
              )}
            >
              Continue shopping
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

function EmptyCart() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-semibold tracking-tight">Your cart</h1>

      <div className="rounded-xl border border-dashed border-border px-6 py-16 text-center">
        <ShoppingBagIcon
          className="mx-auto size-8 text-muted-foreground"
          aria-hidden
        />
        <p className="mt-3 text-sm font-medium">Your cart is empty</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          Nothing here yet. Browse the catalogue and add something you like.
        </p>
        <div className="mt-4 flex justify-center">
          <Link
            href="/products"
            className={cn(buttonVariants({ variant: "default", size: "lg" }))}
          >
            Browse products
          </Link>
        </div>
      </div>
    </div>
  );
}
