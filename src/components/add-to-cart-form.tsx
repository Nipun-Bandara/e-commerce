"use client";

import { useState } from "react";

import QuantityStepper from "@/components/quantity-stepper";
import { Button } from "@/components/ui/button";
import { useCartMutation } from "@/components/use-cart-mutation";
import { addToCartAction } from "@/server/cart-actions";

/**
 * Quantity picker plus "Add to cart" for the product detail page.
 *
 * `stock` bounds the stepper so the obvious mistake is unavailable, but it is
 * only a courtesy: this number came from the last render and the server clamps
 * against the live figure regardless. If someone else buys the last two between
 * this page loading and the button being pressed, the action says so.
 */
export default function AddToCartForm({
  productId,
  stock,
}: {
  productId: string;
  stock: number;
}) {
  const [quantity, setQuantity] = useState(1);
  const { isPending, run } = useCartMutation();

  const isOutOfStock = stock === 0;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <QuantityStepper
        value={quantity}
        min={1}
        max={stock}
        disabled={isOutOfStock || isPending}
        onChange={setQuantity}
        label="Quantity"
      />

      <Button
        size="lg"
        className="w-full sm:w-64"
        disabled={isOutOfStock || isPending}
        onClick={() => run(() => addToCartAction(productId, quantity))}
      >
        {isOutOfStock ? "Out of stock" : isPending ? "Adding…" : "Add to cart"}
      </Button>
    </div>
  );
}
