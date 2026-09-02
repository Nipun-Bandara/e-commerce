import "server-only";

import type { Prisma } from "@/generated/prisma/client";

/**
 * The two writes that move stock, and the only two.
 *
 * Checkout takes units off a product; cancelling an order puts them back. They
 * were one inline loop inside `placeOrder` and would have become two, so they
 * live here instead: one module that owns `Product.stock`, and the place to
 * look when the arithmetic is ever in doubt.
 *
 * Both are `updateMany` rather than `update`, and neither reads a row first.
 * That is the whole point — see the notes on each.
 *
 * Every function takes a transaction client. Neither of these operations is
 * ever correct on its own: a decrement that is not part of an order, or an
 * increment that is not part of a cancellation, is stock invented or lost.
 */

export type StockLine = {
  productId: string;
  quantity: number;
};

/**
 * The order stock writes must happen in, whatever order their caller read them.
 *
 * Both writes below take Postgres row locks, and two transactions that take the
 * same locks in a different sequence deadlock. Each operation being internally
 * consistent is not enough — a checkout and a cancellation touching the same two
 * products have to agree with *each other*, and they only do if the ordering is
 * one rule rather than one rule per caller.
 *
 * Product id, not name: it is the only key here that is stable, unique, and
 * never rewritten. `placeOrder` reads its lines in product-name order because
 * that is the order the visitor saw them in, which is a display concern and
 * expressly not this one.
 */
export function inLockOrder<T extends StockLine>(lines: readonly T[]): T[] {
  return [...lines].sort((a, b) => a.productId.localeCompare(b.productId));
}

/**
 * Reserve `quantity` units, if there are that many. Returns whether there were.
 *
 * The check is in the `WHERE`, not in this process: `stock >= quantity` is
 * evaluated by Postgres against the row as it stands at the moment of the
 * write, holding a row lock, so two buyers cannot both pass it for the same
 * last unit. A read-then-write here — even one line apart — would be a race.
 *
 * Zero rows matched means the units are gone, or the product was deactivated
 * between the review page and the submit. The caller decides what to do about
 * it; inside a checkout that means abandoning the transaction.
 */
export async function takeStock(
  tx: Prisma.TransactionClient,
  line: StockLine,
): Promise<boolean> {
  const { count } = await tx.product.updateMany({
    where: {
      id: line.productId,
      isActive: true,
      stock: { gte: line.quantity },
    },
    data: { stock: { decrement: line.quantity } },
  });

  return count === 1;
}

/**
 * Put units back, for lines that still point at a product.
 *
 * `updateMany` matching nothing is exactly the behaviour wanted for a product
 * that has been deleted since the order was placed: there is no row to credit,
 * and there is nothing wrong. `update` would throw on that and roll back the
 * cancellation, which would leave the order stuck because of a product nobody
 * sells any more.
 *
 * No `isActive` condition either. A deactivated product is one that is not for
 * sale, not one whose stock figure has stopped being true.
 *
 * Lines are written in {@link inLockOrder} so that concurrent restorations —
 * and concurrent checkouts, which use the same ordering — take their row locks
 * in the same sequence and cannot deadlock. Calling this twice for one order
 * would double the stock, so the caller must ensure it runs once; `cancelOrder`
 * does that with a conditional update that only one transaction can win.
 */
export async function restoreStock(
  tx: Prisma.TransactionClient,
  lines: StockLine[],
): Promise<void> {
  for (const line of inLockOrder(lines)) {
    await tx.product.updateMany({
      where: { id: line.productId },
      data: { stock: { increment: line.quantity } },
    });
  }
}
