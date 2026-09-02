"use server";

import { revalidatePath } from "next/cache";

import { ADMIN_ORDERS_PATH } from "@/lib/admin-order-filters";
import {
  adminError,
  adminSuccess,
  adminWarning,
  type AdminResult,
} from "@/lib/admin-result";
import { isOrderStatus } from "@/lib/order-status";
import { updateOrderStatus } from "@/server/admin-orders";
import { requireAdmin } from "@/server/auth";

/**
 * The one thing the admin order screens let a browser invoke.
 *
 * `"use server"` turns every export in a file into a public HTTP endpoint, so
 * this file is the complete, reviewable list of what is reachable from outside.
 * `listAdminOrders`, `getAdminOrderByNumber` and `getAdminOrderStats` stay in
 * `admin-orders.ts`, unreachable — a listing of every customer's orders is not
 * something to expose by accident.
 *
 * ## `requireAdmin` on the first line
 *
 * Not because the pages already call it. **The pages are irrelevant here.** A
 * Server Action is a POST to a URL, and nothing about it goes through
 * `src/app/admin/layout.tsx` or the proxy — a signed-in USER who knows the
 * action id can invoke this directly, and the only thing standing between them
 * and every order in the shop is this line. `requireAdmin` throws:
 * `forbidden()` for a signed-in non-admin, a redirect for a signed-out one, so
 * there is no path past it for either. `updateOrderStatus` calls it again for
 * the benefit of any future caller that is not this file.
 *
 * ## What is not here
 *
 * The transition rules, the ownership of the row, and the stock restoration are
 * all inside `updateOrderStatus`, in one transaction. Checking "is this move
 * allowed" here would put the rule outside the lock that makes it hold, and a
 * concurrent request could change the status between the check and the write.
 */

export async function updateOrderStatusAction(
  orderNumber: string,
  newStatus: string,
): Promise<AdminResult> {
  await requireAdmin(ADMIN_ORDERS_PATH);

  // Both arguments crossed the network, so their TypeScript types are claims
  // rather than facts. These guards are what actually hold.
  if (typeof orderNumber !== "string" || orderNumber.length === 0) {
    return adminError("That request was not valid.");
  }

  // Anything that is not one of the six enum members is rejected before it
  // reaches a query — Postgres would refuse it anyway, but with a 500 rather
  // than a sentence. Whether the move is *allowed* is decided further in.
  if (!isOrderStatus(newStatus)) {
    return adminError("That is not an order status.");
  }

  const result = await updateOrderStatus(orderNumber, newStatus);

  if (result.status === "updated") {
    // `"/"` rather than a list of routes. A status change touches the admin
    // list, the order's own admin page, the dashboard figures and the
    // customer's copy of the same order under /account — and cancelling also
    // moves stock, which changes the storefront. Naming those five means the
    // sixth screen somebody adds is stale until they remember this file.
    revalidatePath("/", "layout");

    return adminSuccess(result.message);
  }

  // "Already cancelled" is neither a success nor a failure: the order is in the
  // state that was asked for, and nothing happened. Saying so is the honest
  // answer, and it is what tells an admin their second click did not restore
  // the stock a second time.
  return result.status === "unchanged"
    ? adminWarning(result.message)
    : adminError(result.message);
}
