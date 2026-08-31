import type { Metadata } from "next";
import Link from "next/link";
import { ShoppingBagIcon } from "lucide-react";

import CartClearButton from "@/components/cart-clear-button";
import CartItemRow from "@/components/cart-item-row";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatPrice } from "@/lib/money";
import { cn } from "@/lib/utils";
import { getCart } from "@/server/cart";

export const metadata: Metadata = {
  title: "Your cart",
  description: "Review the items in your cart before checking out.",
};

export default async function CartPage() {
  const cart = await getCart();

  if (cart.items.length === 0) return <EmptyCart />;

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

            <div className="flex flex-col items-center gap-2">
              <Button size="lg" className="w-full" disabled>
                Proceed to checkout
              </Button>
              <Badge variant="secondary">Coming soon</Badge>
            </div>

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
