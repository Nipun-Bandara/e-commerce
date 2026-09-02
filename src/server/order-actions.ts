"use server";

import { revalidatePath } from "next/cache";

import {
  orderError,
  orderSuccess,
  orderWarning,
  type OrderResult,
} from "@/lib/order-result";
import { cancelOrder } from "@/server/orders";

/**
 * The one thing the order history lets a browser invoke.
 *
 * Split from `orders.ts` for the reason `cart-actions.ts` gives: `"use server"`
 * turns every export in a file into a public HTTP endpoint, and `createOrder`,
 * `getUserOrders` and the rest have no business being callable from outside.
 * This file is the complete, reviewable list of what the client can reach.
 *
 * Note what is *not* here. Authentication, ownership, whether the order is
 * still cancellable and restoring the stock are all inside `cancelOrder`, in
 * one transaction. Doing any of them here would put a rule outside the lock
 * that makes it hold.
 */

export async function cancelOrderAction(
  orderNumber: string,
): Promise<OrderResult> {
  // The argument crossed the network, so its TypeScript type is a claim rather
  // than a fact. This guard is what actually holds.
  if (typeof orderNumber !== "string" || orderNumber.length === 0) {
    return orderError("That request was not valid.");
  }

  const result = await cancelOrder(orderNumber);

  if (result.status === "cancelled") {
    // The whole account section: the detail page shows the new status, the
    // list shows the new badge, and /account shows the order count. One call
    // rather than three paths that could fall out of step with the routes.
    revalidatePath("/account", "layout");

    return orderSuccess(result.message);
  }

  return result.status === "already-cancelled"
    ? orderWarning(result.message)
    : orderError(result.message);
}
