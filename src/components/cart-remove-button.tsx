"use client";

import { Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCartMutation } from "@/components/use-cart-mutation";
import { removeCartItemAction } from "@/server/cart-actions";

/**
 * Removes one cart row. Two presentations, one behaviour: an icon in the row
 * itself, and a worded button inside a warning where the icon alone would not
 * be obvious enough.
 *
 * No confirmation dialog. Removing one line from a cart is trivially undone by
 * adding it again, and a modal for it is friction, not safety.
 */
export default function CartRemoveButton({
  cartItemId,
  productName,
  appearance = "icon",
}: {
  cartItemId: string;
  productName: string;
  appearance?: "icon" | "text";
}) {
  const { isPending, run } = useCartMutation();
  const remove = () => run(() => removeCartItemAction(cartItemId));

  if (appearance === "text") {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={remove}
      >
        {isPending ? "Removing…" : "Remove"}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={`Remove ${productName} from cart`}
      disabled={isPending}
      onClick={remove}
      className="text-muted-foreground hover:text-destructive"
    >
      <Trash2Icon aria-hidden />
    </Button>
  );
}
