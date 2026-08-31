"use client";

import { ShoppingCartIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCartMutation } from "@/components/use-cart-mutation";
import { addToCartAction } from "@/server/cart-actions";

/**
 * One-tap "add one of these" for a product card.
 *
 * The card navigates via a stretched link — a `::after` pseudo-element covering
 * the whole tile — rather than wrapping its contents in an `<a>`, so this
 * button is a sibling of the link, not a descendant of one. That is what keeps
 * the markup valid; `z-10` is what keeps the button on top of the overlay so a
 * press lands here instead of navigating. `stopPropagation` is belt and braces
 * for the same.
 */
export default function QuickAddToCartButton({
  productId,
  productName,
}: {
  productId: string;
  /** Only for the accessible name — the card's title is already on screen. */
  productName: string;
}) {
  const { isPending, run } = useCartMutation();

  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      aria-label={`Add ${productName} to cart`}
      disabled={isPending}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        run(() => addToCartAction(productId, 1));
      }}
      className="absolute right-2 bottom-2 z-10 shadow-sm"
    >
      <ShoppingCartIcon aria-hidden />
      {isPending ? "Adding…" : "Add to cart"}
    </Button>
  );
}
