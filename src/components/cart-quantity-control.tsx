"use client";

import { useState } from "react";

import QuantityStepper from "@/components/quantity-stepper";
import { useCartMutation } from "@/components/use-cart-mutation";
import { updateCartItemQuantityAction } from "@/server/cart-actions";

/**
 * The quantity stepper on a cart row.
 *
 * Optimistic in the plainest way: the number moves as soon as it is pressed and
 * the action runs behind it, so a slow round trip does not feel like a dead
 * button. The value is keyed to the server's figure through `serverQuantity` —
 * when the revalidated cart comes back with something different (a clamp, a
 * concurrent change), the row re-syncs rather than sitting on a stale local
 * number.
 *
 * Stepping to zero is a legitimate way to empty a row: the action treats it as
 * a removal.
 */
export default function CartQuantityControl({
  cartItemId,
  quantity,
  max,
  disabled = false,
  productName,
}: {
  cartItemId: string;
  quantity: number;
  /** Live stock. The server clamps against it too. */
  max: number;
  /** Set when the row cannot be bought as it stands. */
  disabled?: boolean;
  productName: string;
}) {
  const [optimistic, setOptimistic] = useState(quantity);
  const [serverQuantity, setServerQuantity] = useState(quantity);
  const { isPending, run } = useCartMutation();

  // Cheaper and less surprising than an effect: React re-renders with the new
  // prop, we notice it disagrees with what we last saw, and adopt it.
  if (serverQuantity !== quantity) {
    setServerQuantity(quantity);
    setOptimistic(quantity);
  }

  return (
    <QuantityStepper
      value={optimistic}
      // 0 is reachable so a row can be emptied from the stepper itself.
      min={0}
      max={max}
      size="sm"
      disabled={disabled || isPending}
      label={`Quantity for ${productName}`}
      onChange={(next) => {
        setOptimistic(next);
        run(() => updateCartItemQuantityAction(cartItemId, next));
      }}
    />
  );
}
