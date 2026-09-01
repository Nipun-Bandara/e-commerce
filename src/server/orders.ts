import "server-only";

import { randomInt } from "node:crypto";

import { Prisma } from "@/generated/prisma/client";
import { OrderStatus } from "@/generated/prisma/enums";
import type { ShippingAddressInput } from "@/lib/checkout-schemas";
import { lineTotal, type Money } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { orderTotals, type OrderTotals } from "@/server/checkout";

/**
 * Orders: placing one, and reading one back.
 *
 * ## What `createOrder` guarantees
 *
 * Placing an order is the only operation in this app that must be all-or-
 * nothing. It writes an Order, writes its items, takes stock off six different
 * products and empties a cart, and every partial outcome is a real problem:
 * stock deducted with no order to show for it, an order for units that were
 * never reserved, a cart cleared for a purchase that failed. So the whole thing
 * is one interactive transaction, and any failure inside it — a sold-out line,
 * a dropped connection, a thrown query — rolls back all of it.
 *
 * ## What it refuses to trust
 *
 * Nothing priced or counted comes from the caller. `createOrder` takes a
 * shipping address and a user id; the lines, quantities, unit prices, subtotal,
 * shipping and total are all read or derived inside the transaction, from the
 * cart and the `Product` table. There is no argument a client could lie with.
 *
 * ## Concurrency
 *
 * Two things can race a checkout: the same person submitting twice, and someone
 * else buying the last unit first.
 *
 * The first is handled by locking the cart row (`SELECT … FOR UPDATE`) before
 * anything is read. A second submission blocks until the first commits, then
 * reads a cart the first one emptied and stops with `empty-cart`. That is what
 * makes the guard *server-side* rather than a disabled button — the button
 * helps, but it is not a mechanism.
 *
 * The second is handled by the stock decrement being a **conditional** update:
 * `WHERE id = ? AND stock >= ?`. Postgres evaluates that against the row as it
 * is at the moment of the write, holding a row lock, so two buyers cannot both
 * pass the same check. A decrement that matches no row means the units went to
 * somebody else between the review page and the submit, and the transaction is
 * abandoned. Lines are decremented in product-name order, the same order they
 * are read in, so two overlapping baskets take their locks in the same sequence
 * and cannot deadlock against each other.
 *
 * ## Where payment goes
 *
 * An order lands as `PENDING` and stock is committed to it immediately. That is
 * deliberate: the next feature puts a payment gateway between creation and
 * confirmation, and the shape it needs is exactly this one. `createOrder`
 * returns an order number, and the caller decides where to send the visitor —
 * today straight to the confirmation page, tomorrow to PayHere, with the
 * gateway's callback moving that same order from `PENDING` to `PAID`. Nothing
 * in this transaction has to change for that.
 */

/**
 * Order numbers are read aloud, typed into support chats and written on
 * parcels, so the alphabet leaves out the characters that get confused when
 * they are: `I`/`1`, `O`/`0`. What is left is 32 symbols.
 */
const ORDER_NUMBER_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Four symbols from a 32-character alphabet: about a million per day. */
const ORDER_NUMBER_LENGTH = 4;

/**
 * How many times to re-run the transaction with a fresh number.
 *
 * A collision is a lost lottery ticket, not a fault, and `@unique` on
 * `orderNumber` is what detects it. Retrying the whole transaction rather than
 * just the insert is not caution: a Postgres transaction that has hit a
 * constraint violation is aborted and cannot be continued.
 */
const ORDER_NUMBER_ATTEMPTS = 5;

const EMPTY_CART_MESSAGE =
  "Your cart is empty. It may already have been ordered — check your orders before trying again.";

const ORDER_NUMBER_MESSAGE =
  "We could not reference your order. Nothing was charged or reserved — please try again.";

export type OrderFailureReason =
  /** No cart, no rows, or a second submission arriving after the first cleared it. */
  | "empty-cart"
  /** A product was deactivated between the review page and the submit. */
  | "item-unavailable"
  /** Someone else took the units first. */
  | "insufficient-stock"
  /** Five order numbers in a row collided. Vanishingly unlikely, still handled. */
  | "order-number";

export type CreateOrderResult =
  | { status: "created"; orderNumber: string }
  | { status: "failed"; reason: OrderFailureReason; message: string };

type OrderFailure = Extract<CreateOrderResult, { status: "failed" }>;

export type CreateOrderInput = {
  userId: string;
  shipping: ShippingAddressInput;
  /** Keep this address on the account for next time. */
  saveAddress: boolean;
};

function failed(reason: OrderFailureReason, message: string): OrderFailure {
  return { status: "failed", reason, message };
}

/**
 * How a rule inside the transaction stops it.
 *
 * A failure like "that sold out" is an outcome, not an exception — but it has
 * to unwind a transaction, and throwing is the only thing that does that. So it
 * is thrown as a value in an envelope and unwrapped into a returned result on
 * the way out, which keeps `createOrder`'s contract a plain typed result.
 */
class OrderAborted extends Error {
  readonly failure: OrderFailure;

  constructor(failure: OrderFailure) {
    super(failure.message);
    this.name = "OrderAborted";
    this.failure = failure;
  }
}

function generateOrderNumber(): string {
  // UTC rather than the server's local zone. The date here is a label on a
  // reference, and one that shifts when a machine changes region is worse than
  // one that is occasionally a few hours off local midnight.
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");

  let suffix = "";
  for (let i = 0; i < ORDER_NUMBER_LENGTH; i++) {
    // `randomInt` rather than `Math.random`: an order number is guessable
    // enough already without a predictable generator behind it.
    suffix += ORDER_NUMBER_ALPHABET[randomInt(ORDER_NUMBER_ALPHABET.length)];
  }

  return `ORD-${date}-${suffix}`;
}

/**
 * `orderNumber` is the only unique column this transaction inserts into, so a
 * P2002 from it can only mean the generated number was already taken.
 */
function isOrderNumberCollision(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
  );
}

/**
 * Keep the address on the account, if the box was ticked.
 *
 * Deliberately not an upsert: `Address` has no natural unique key, so a repeat
 * order to the same place would otherwise stack identical rows in the picker.
 * An exact match means it is already saved and there is nothing to do. A first
 * address becomes the default, which is what makes the next checkout arrive
 * pre-filled.
 *
 * Failing here would roll the order back, which would be a poor trade for a
 * convenience — so this runs last, after everything that must succeed.
 */
async function saveShippingAddress(
  tx: Prisma.TransactionClient,
  userId: string,
  shipping: ShippingAddressInput,
): Promise<void> {
  const existing = await tx.address.findFirst({
    where: { userId, ...shipping },
    select: { id: true },
  });
  if (existing) return;

  const saved = await tx.address.count({ where: { userId } });

  await tx.address.create({
    data: { userId, ...shipping, isDefault: saved === 0 },
  });
}

/**
 * One attempt: the whole order, inside one transaction.
 *
 * Separated from {@link createOrder} only so that retrying a collided order
 * number is a loop around a function rather than a loop around a `try` block.
 */
async function placeOrder({
  userId,
  shipping,
  saveAddress,
}: CreateOrderInput): Promise<CreateOrderResult> {
  return prisma.$transaction(async (tx) => {
    const cart = await tx.cart.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!cart) throw new OrderAborted(failed("empty-cart", EMPTY_CART_MESSAGE));

    // The double-submit guard, and the reason everything below can be read
    // rather than re-checked afterwards. Whoever holds this row lock owns the
    // checkout; a second submission waits here and then finds an empty cart.
    await tx.$queryRaw`SELECT id FROM "Cart" WHERE id = ${cart.id} FOR UPDATE`;

    const rows = await tx.cartItem.findMany({
      where: { cartId: cart.id },
      select: {
        quantity: true,
        product: {
          select: { id: true, name: true, price: true, stock: true, isActive: true },
        },
      },
      // Sorted so the decrements below take their row locks in a consistent
      // order across concurrent checkouts. See the deadlock note above.
      orderBy: { product: { name: "asc" } },
    });
    if (rows.length === 0) {
      throw new OrderAborted(failed("empty-cart", EMPTY_CART_MESSAGE));
    }

    // Read fresh, one last time: prices, stock and `isActive` as of this
    // transaction, not as of the page the visitor is looking at.
    const lines = rows.map(({ product, quantity }) => {
      if (!product.isActive) {
        throw new OrderAborted(
          failed(
            "item-unavailable",
            `${product.name} is no longer available. Remove it from your cart to continue.`,
          ),
        );
      }
      if (product.stock < quantity) {
        throw new OrderAborted(
          failed(
            "insufficient-stock",
            `Only ${product.stock} of ${product.name} left. Update your cart to continue.`,
          ),
        );
      }

      return {
        productId: product.id,
        productName: product.name,
        unitPrice: product.price,
        quantity,
        lineTotal: lineTotal(product.price, quantity),
      };
    });

    const totals = orderTotals(lines.map((line) => line.lineTotal));

    for (const line of lines) {
      // The conditional update. `stock >= quantity` is part of the WHERE, so
      // Postgres — not this process — decides whether the units are there, at
      // the moment of the write. Zero rows matched means they are not.
      const { count } = await tx.product.updateMany({
        where: {
          id: line.productId,
          isActive: true,
          stock: { gte: line.quantity },
        },
        data: { stock: { decrement: line.quantity } },
      });

      if (count === 0) {
        throw new OrderAborted(
          failed(
            "insufficient-stock",
            `${line.productName} sold out while you were checking out. Nothing has been ordered.`,
          ),
        );
      }
    }

    const order = await tx.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        userId,
        // Spelled out rather than left to the column default: this is the state
        // the payment step will move the order out of, and it should be
        // impossible to change the default without noticing this line.
        status: OrderStatus.PENDING,

        subtotal: totals.subtotal,
        shippingFee: totals.shippingFee,
        total: totals.total,

        // Copied in, not referenced. Editing or deleting the saved Address
        // below must never change where this order says it went.
        shippingName: shipping.fullName,
        shippingPhone: shipping.phone,
        shippingLine1: shipping.line1,
        shippingLine2: shipping.line2,
        shippingCity: shipping.city,
        shippingPostalCode: shipping.postalCode,

        items: {
          create: lines.map((line) => ({
            productId: line.productId,
            // The snapshots. `productId` is a convenience link that goes NULL
            // if the product is ever deleted; these two are what the order is
            // actually rendered from, forever.
            productName: line.productName,
            unitPrice: line.unitPrice,
            quantity: line.quantity,
          })),
        },
      },
      select: { orderNumber: true },
    });

    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

    if (saveAddress) await saveShippingAddress(tx, userId, shipping);

    return { status: "created", orderNumber: order.orderNumber };
  });
}

/**
 * Place the order in `userId`'s cart, shipping to `shipping`.
 *
 * Returns a result rather than throwing for anything the visitor can act on —
 * an emptied cart, a sold-out line — because those are answers, not faults. A
 * genuine fault (a broken query, a lost connection) still throws, and the
 * transaction has already rolled back by the time it does.
 */
export async function createOrder(
  input: CreateOrderInput,
): Promise<CreateOrderResult> {
  for (let attempt = 1; attempt <= ORDER_NUMBER_ATTEMPTS; attempt++) {
    try {
      return await placeOrder(input);
    } catch (error) {
      if (error instanceof OrderAborted) return error.failure;

      // Anything that is not a collision is a real failure and belongs to the
      // caller. Only a taken order number is worth another go.
      if (!isOrderNumberCollision(error)) throw error;
    }
  }

  return failed("order-number", ORDER_NUMBER_MESSAGE);
}

export type OrderItemView = {
  id: string;
  /** The snapshot, not the live product name. */
  productName: string;
  /** What it cost when it was bought. */
  unitPrice: Money;
  quantity: number;
  lineTotal: Money;
};

export type OrderView = {
  orderNumber: string;
  status: OrderStatus;
  placedAt: Date;
  totals: OrderTotals;
  shipping: {
    name: string;
    phone: string;
    line1: string;
    line2: string | null;
    city: string;
    postalCode: string;
  };
  items: OrderItemView[];
};

/**
 * One order, if it belongs to this user.
 *
 * Ownership is part of the `where`, not a check on the result. A stranger's
 * order number matches no row, so the caller gets `null` and renders a 404 —
 * the same thing a made-up order number gets. A 403 would confirm that the
 * number is real, which is exactly what someone working through `ORD-…-AAAA`,
 * `ORD-…-AAAB` is trying to find out.
 *
 * `Order.userId` is nullable — it goes NULL when an account is deleted — and a
 * string `userId` never matches NULL, so an orphaned order is unreachable here
 * rather than accidentally public.
 */
export async function getOrderByNumberForUser(
  orderNumber: string,
  userId: string,
): Promise<OrderView | null> {
  const order = await prisma.order.findFirst({
    where: { orderNumber, userId },
    select: {
      orderNumber: true,
      status: true,
      createdAt: true,
      subtotal: true,
      shippingFee: true,
      total: true,
      shippingName: true,
      shippingPhone: true,
      shippingLine1: true,
      shippingLine2: true,
      shippingCity: true,
      shippingPostalCode: true,
      items: {
        select: {
          id: true,
          productName: true,
          unitPrice: true,
          quantity: true,
        },
        // Not joined to Product to sort, for the same reason it is not joined
        // to read the name: the snapshot is the order.
        orderBy: { productName: "asc" },
      },
    },
  });
  if (!order) return null;

  return {
    orderNumber: order.orderNumber,
    status: order.status,
    placedAt: order.createdAt,
    totals: {
      subtotal: order.subtotal,
      shippingFee: order.shippingFee,
      total: order.total,
    },
    shipping: {
      name: order.shippingName,
      phone: order.shippingPhone,
      line1: order.shippingLine1,
      line2: order.shippingLine2,
      city: order.shippingCity,
      postalCode: order.shippingPostalCode,
    },
    items: order.items.map((item) => ({
      id: item.id,
      productName: item.productName,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      lineTotal: lineTotal(item.unitPrice, item.quantity),
    })),
  };
}
