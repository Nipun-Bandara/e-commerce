import "server-only";

import { lineTotal, sumMoney, type Money } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { SHIPPING_FEE } from "@/lib/shipping";

/**
 * The read side of checkout: what the visitor is about to buy, priced now.
 *
 * Two things happen here and nowhere else.
 *
 * **Revalidation.** A cart row is a product id and a quantity, and it can sit
 * there for weeks. By the time someone reaches checkout the product may have
 * been deactivated or sold down below what they asked for, so the catalogue is
 * re-read before the form is shown. When something has moved, this returns
 * `changed` and the page sends them back to the cart rather than quietly
 * trimming the basket: an order that is not the one that was reviewed is worse
 * than an interruption.
 *
 * **Pricing.** Every figure is recomputed from the `Product` table. Nothing is
 * taken from the cart row, from a hidden input, or from anything the client
 * sent, because none of those are evidence of what something costs.
 *
 * {@link orderTotals} is exported so `orders.ts` adds up a committed order the
 * same way this adds up the preview. Same function, same inputs, same answer —
 * which is what makes the total on the confirmation page match the total that
 * was quoted.
 */

export type CheckoutLine = {
  productId: string;
  name: string;
  /** Live catalogue price, read now. The order snapshots it at purchase. */
  unitPrice: Money;
  quantity: number;
  /** unitPrice × quantity, exact. */
  lineTotal: Money;
};

export type OrderTotals = {
  subtotal: Money;
  shippingFee: Money;
  total: Money;
};

export type CheckoutSummary =
  | { status: "ready"; lines: CheckoutLine[]; totals: OrderTotals }
  /** Nothing to buy. The cart was emptied, or the order has already been placed. */
  | { status: "empty" }
  /** The catalogue moved under the cart. The cart page explains each row. */
  | { status: "changed" };

const checkoutItemSelect = {
  quantity: true,
  product: {
    select: {
      id: true,
      name: true,
      price: true,
      stock: true,
      isActive: true,
    },
  },
} as const;

/** Add up a basket. Decimal throughout — see the note in `lib/money.ts`. */
export function orderTotals(lineTotals: Money[]): OrderTotals {
  const subtotal = sumMoney(lineTotals);

  return {
    subtotal,
    shippingFee: SHIPPING_FEE,
    total: subtotal.add(SHIPPING_FEE),
  };
}

/**
 * Can this cart still be bought as it stands, and for how much?
 *
 * A row fails on the same three conditions the cart page warns about —
 * deactivated, out of stock, or fewer units left than the row asks for. The
 * caller only learns *that* something changed, not what: by the time the
 * visitor is looking at the cart page it has re-read the catalogue itself and
 * can label each affected row from data that is one moment fresher than this.
 *
 * This is a check, not a guarantee. Stock can fall between here and the submit
 * button, which is why `createOrder` re-runs all of it inside a transaction.
 */
export async function getCheckoutSummary(
  userId: string,
): Promise<CheckoutSummary> {
  const cart = await prisma.cart.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!cart) return { status: "empty" };

  const rows = await prisma.cartItem.findMany({
    where: { cartId: cart.id },
    select: checkoutItemSelect,
    // Same ordering as the cart, so the review step lists things where the
    // visitor last saw them.
    orderBy: { product: { name: "asc" } },
  });
  if (rows.length === 0) return { status: "empty" };

  const changed = rows.some(
    ({ product, quantity }) => !product.isActive || product.stock < quantity,
  );
  if (changed) return { status: "changed" };

  const lines: CheckoutLine[] = rows.map(({ product, quantity }) => ({
    productId: product.id,
    name: product.name,
    unitPrice: product.price,
    quantity,
    lineTotal: lineTotal(product.price, quantity),
  }));

  return {
    status: "ready",
    lines,
    totals: orderTotals(lines.map((line) => line.lineTotal)),
  };
}
