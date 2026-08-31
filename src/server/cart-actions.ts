"use server";

import { revalidatePath } from "next/cache";

import { cartError, type CartResult } from "@/lib/cart-result";
import {
  addToCart,
  clearCart,
  removeCartItem,
  updateCartItemQuantity,
} from "@/server/cart";

/**
 * Server Actions for the cart.
 *
 * Split from `cart.ts` on purpose. `"use server"` turns every export in a file
 * into a public HTTP endpoint, and only the four mutations below should be
 * callable from a browser — `getCart` and `getOrCreateCart` have no business
 * being reachable from outside. Keeping the actions in their own module means
 * the query layer stays a plain server module, and this file is the complete,
 * reviewable list of what the client can invoke.
 *
 * Two things happen here that do not belong in the query layer:
 *
 *  1. **Argument checks.** These arguments arrive over the network, so
 *     TypeScript's word for their types is worthless. The runtime guards below
 *     are what actually holds. Everything past them — product existence, stock
 *     clamping, and above all proving the cart item belongs to this session —
 *     is enforced in `cart.ts`, on every call.
 *
 *  2. **Revalidation.** `revalidatePath("/", "layout")` rather than `/cart`,
 *     because the header badge renders on every route: revalidating one page
 *     would leave a stale count everywhere else.
 */

function revalidateCart() {
  revalidatePath("/", "layout");
}

export async function addToCartAction(
  productId: string,
  quantity: number,
): Promise<CartResult> {
  if (typeof productId !== "string" || typeof quantity !== "number") {
    return cartError("That request was not valid.");
  }

  const result = await addToCart(productId, quantity);
  revalidateCart();
  return result;
}

export async function updateCartItemQuantityAction(
  cartItemId: string,
  quantity: number,
): Promise<CartResult> {
  if (typeof cartItemId !== "string" || typeof quantity !== "number") {
    return cartError("That request was not valid.");
  }

  const result = await updateCartItemQuantity(cartItemId, quantity);
  revalidateCart();
  return result;
}

export async function removeCartItemAction(
  cartItemId: string,
): Promise<CartResult> {
  if (typeof cartItemId !== "string") {
    return cartError("That request was not valid.");
  }

  const result = await removeCartItem(cartItemId);
  revalidateCart();
  return result;
}

export async function clearCartAction(): Promise<CartResult> {
  const result = await clearCart();
  revalidateCart();
  return result;
}
