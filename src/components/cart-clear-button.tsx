"use client";

import { Button } from "@/components/ui/button";
import { useCartMutation } from "@/components/use-cart-mutation";
import { clearCartAction } from "@/server/cart-actions";

/** Empties the whole cart. Deliberately understated, and never the primary action. */
export default function CartClearButton() {
  const { isPending, run } = useCartMutation();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={isPending}
      onClick={() => run(() => clearCartAction())}
      className="text-muted-foreground hover:text-destructive"
    >
      {isPending ? "Clearing…" : "Clear cart"}
    </Button>
  );
}
