"use client";

import { TriangleAlertIcon } from "lucide-react";

import CartRemoveButton from "@/components/cart-remove-button";
import { Button } from "@/components/ui/button";
import { useCartMutation } from "@/components/use-cart-mutation";
import type { CartItemIssue } from "@/server/cart";
import { updateCartItemQuantityAction } from "@/server/cart-actions";

/**
 * The banner on a cart row whose product has moved on since it was added —
 * deactivated, sold out, or down to fewer units than the row asks for.
 *
 * Each case gets a way out rather than just a complaint. Where stock is merely
 * short, "Update to N" is one press; where the product cannot be bought at all,
 * removal is the only honest option, so that is the only button offered.
 *
 * `CartItemIssue` is imported as a type from the server module. Type imports
 * are erased before bundling, so the `server-only` guard there is not tripped
 * and no query code follows it into the browser.
 */
export default function CartItemWarning({
  cartItemId,
  productName,
  issue,
  stock,
}: {
  cartItemId: string;
  productName: string;
  issue: CartItemIssue;
  stock: number;
}) {
  const { isPending, run } = useCartMutation();

  const message =
    issue === "unavailable"
      ? "This product is no longer available."
      : issue === "out-of-stock"
        ? "This product is now out of stock."
        : `Only ${stock} left in stock.`;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between">
      <p className="flex items-center gap-2">
        <TriangleAlertIcon className="size-4 shrink-0" aria-hidden />
        {message}
      </p>

      <div className="flex shrink-0 items-center gap-2">
        {issue === "insufficient-stock" && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() =>
              run(() => updateCartItemQuantityAction(cartItemId, stock))
            }
          >
            {isPending ? "Updating…" : `Update to ${stock}`}
          </Button>
        )}

        <CartRemoveButton
          cartItemId={cartItemId}
          productName={productName}
          appearance="text"
        />
      </div>
    </div>
  );
}
