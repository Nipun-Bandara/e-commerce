import "server-only";

import { OrderStatus } from "@/generated/prisma/enums";
import { CURRENCY, type Money } from "@/lib/money";
import type { PaymentOutcome } from "@/lib/payhere";
import { prisma } from "@/lib/prisma";
import { restoreStock } from "@/server/stock";

/**
 * The order rows the payment step reads, and the one write that a gateway
 * notification is allowed to make.
 *
 * `src/lib/payhere.ts` owns the protocol — endpoints, hashes, status codes.
 * This module owns what any of it means for an `Order`, and it is the only
 * place in the app that moves an order to `PAID`.
 *
 * ## The rule the whole feature rests on
 *
 * `return_url` is where PayHere sends the *browser* when a payment is
 * approved. Anyone can type it. It is a hint that something probably happened,
 * and it is never evidence: nothing on the success page writes a status.
 * `notify_url` is a server-to-server POST signed with the merchant secret, and
 * {@link applyPayHereNotification} — reached only after that signature has been
 * verified — is what actually decides.
 *
 * ## Idempotency and stock, in one mechanism
 *
 * PayHere retries a notification it did not get a `200` for, so every path
 * below has to survive being run twice with the same input. Both status changes
 * are `updateMany` with `status: PENDING` in the `where`, exactly as
 * `cancelOrder` does it, and for the same three reasons:
 *
 *  - Postgres evaluates the condition against the row as it stands at the
 *    moment of the write, holding the row lock, so of two concurrent deliveries
 *    exactly one matches a row.
 *  - A repeat delivery matches nothing and takes the no-op path, so a second
 *    `success` does not re-apply anything and a second `cancelled` does not
 *    restore stock twice.
 *  - An order that is already `PAID`, or `SHIPPED`, or cancelled by its owner,
 *    is not `PENDING` — so no notification can move one backwards, in either
 *    direction.
 *
 * Restoring stock happens inside the branch that won the update and nowhere
 * else. That is what makes "exactly once per order" a property of the database
 * rather than a promise about how often PayHere calls.
 */

export type PaymentOrderView = {
  orderNumber: string;
  status: OrderStatus;
  /** The stored total. This is the figure that gets hashed and charged. */
  total: Money;
  shipping: {
    name: string;
    phone: string;
    line1: string;
    line2: string | null;
    city: string;
  };
  /** Units, for the one-line description PayHere shows on its own page. */
  itemCount: number;
};

/**
 * The order a payment is for, if it belongs to this user.
 *
 * Ownership is in the `where`, not a check on the result — the same reasoning
 * `getOrderByNumberForUser` sets out at length. A stranger's order number and a
 * made-up one both come back `null`, and both render the same 404, so the
 * payment pages cannot be used to find out which order numbers are real.
 *
 * The status comes back unfiltered rather than the query demanding `PENDING`.
 * The hand-off page has somewhere useful to send a visitor whose order is
 * already paid or already cancelled, and it can only do that if it can tell the
 * difference between those and an order that does not exist.
 */
export async function getPaymentOrderForUser(
  orderNumber: string,
  userId: string,
): Promise<PaymentOrderView | null> {
  const order = await prisma.order.findFirst({
    where: { orderNumber, userId },
    select: {
      orderNumber: true,
      status: true,
      total: true,
      shippingName: true,
      shippingPhone: true,
      shippingLine1: true,
      shippingLine2: true,
      shippingCity: true,
      // Quantities only. The gateway's line is "3 items", not a basket.
      items: { select: { quantity: true } },
    },
  });
  if (!order) return null;

  return {
    orderNumber: order.orderNumber,
    status: order.status,
    total: order.total,
    shipping: {
      name: order.shippingName,
      phone: order.shippingPhone,
      line1: order.shippingLine1,
      line2: order.shippingLine2,
      city: order.shippingCity,
    },
    itemCount: order.items.reduce((count, item) => count + item.quantity, 0),
  };
}

export type PaymentNotification = {
  /** PayHere's `order_id`, which is our `Order.orderNumber`. */
  orderNumber: string;
  /** What the status code means. Mapped in `lib/payhere.ts`. */
  outcome: PaymentOutcome;
  /** `payhere_amount`, parsed exactly. Checked against the stored total. */
  amount: Money;
  /** `payhere_currency`, as received. */
  currency: string;
};

export type PaymentNotificationResult =
  /**
   * No order with that number. Answered `200` and ignored: a `404` would tell
   * whoever sent it which order numbers exist.
   */
  | { status: "unknown-order" }
  /**
   * The signature was ours, but the money is not this order's. Never applied.
   * Both figures are returned so the caller can log what disagreed.
   */
  | { status: "amount-mismatch"; expected: string; received: string }
  /** This call moved the order to `PAID`. */
  | { status: "paid" }
  /** This call cancelled the order and put its stock back, once. */
  | { status: "cancelled" }
  /**
   * Nothing to do. A repeat of a notification already applied, a `pending`
   * status code, or an order that has moved past `PENDING` by another route.
   * `orderStatus` is the status the order is actually in.
   */
  | { status: "unchanged"; orderStatus: OrderStatus };

/**
 * Apply a **verified** notification to an order.
 *
 * The caller must have checked the signature first; this function assumes the
 * notification came from PayHere and concerns itself only with whether it
 * concerns an order, whether the money matches, and what to do about it.
 *
 * The amount check is a `Decimal` comparison against the stored `total`, not a
 * string one. `1000.00` and `1000.0` are the same money written two ways, and
 * rejecting a real payment over its spelling would be worse than the round trip
 * of parsing it. What it does catch is the thing worth catching: a
 * notification for an amount that is not what this order costs.
 */
export async function applyPayHereNotification(
  notification: PaymentNotification,
): Promise<PaymentNotificationResult> {
  const { orderNumber, outcome, amount, currency } = notification;

  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { orderNumber },
      select: { id: true, status: true, total: true },
    });
    if (!order) return { status: "unknown-order" };

    // The store has one currency and no currency column, so anything but LKR
    // is either a misconfigured merchant account or a forgery. Either way it is
    // not this order being paid for.
    if (currency !== CURRENCY || !amount.equals(order.total)) {
      return {
        status: "amount-mismatch",
        expected: `${CURRENCY} ${order.total.toFixed(2)}`,
        received: `${currency} ${amount.toFixed(2)}`,
      };
    }

    // A `pending` status code is PayHere saying "ask again later". The order is
    // already PENDING; writing PENDING over PENDING would only churn
    // `updatedAt` and make the admin timeline lie about when it last moved.
    if (outcome === "pending" || outcome === "unrecognised") {
      return { status: "unchanged", orderStatus: order.status };
    }

    const next =
      outcome === "paid" ? OrderStatus.PAID : OrderStatus.CANCELLED;

    // The whole idempotency mechanism, in one `where`. Only a PENDING order
    // moves; a second delivery of the same notification matches nothing.
    const { count } = await tx.order.updateMany({
      where: { id: order.id, status: OrderStatus.PENDING },
      data: { status: next },
    });

    if (count === 0) {
      // Re-read rather than reuse the status from before the update: if another
      // request held the row lock, this update waited for it, and the status it
      // failed against is the one that request committed.
      const current = await tx.order.findFirstOrThrow({
        where: { id: order.id },
        select: { status: true },
      });

      return { status: "unchanged", orderStatus: current.status };
    }

    if (next === OrderStatus.PAID) return { status: "paid" };

    // Only the transaction that won the update reaches this line, which is what
    // makes the units come back exactly once however many times PayHere calls.
    const items = await tx.orderItem.findMany({
      // A line whose product has been deleted has `productId` NULL and no row
      // to credit. Excluded in the query rather than skipped in a loop.
      where: { orderId: order.id, productId: { not: null } },
      select: { productId: true, quantity: true },
    });

    await restoreStock(
      tx,
      // `productId: { not: null }` narrows the rows but not the type.
      items.map((item) => ({
        productId: item.productId as string,
        quantity: item.quantity,
      })),
    );

    return { status: "cancelled" };
  });
}
