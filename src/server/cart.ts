import "server-only";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";

import {
  cartError,
  cartSuccess,
  cartWarning,
  type CartResult,
} from "@/lib/cart-result";
import { lineTotal, money, sumMoney, type Money } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/server/auth";

/**
 * The cart: reads, mutations, and the one place a request is resolved to a
 * Cart row.
 *
 * A cart belongs to a signed-in user, or — for a guest — to an opaque session
 * id kept in an httpOnly cookie. That id is a bearer token: whoever holds it
 * holds the cart, which is why it is 256 bits of randomness, why the browser's
 * JavaScript cannot read it, and why it is never rendered into page markup.
 * `Cart.userId` and `Cart.sessionId` are each nullable and unique, so the two
 * kinds of cart live in one table without colliding.
 *
 * Signing in runs {@link mergeGuestCart}, which folds whatever a visitor
 * collected as a guest into their account and retires the cookie.
 *
 * Nothing here takes a price from the caller. A cart row stores a product id
 * and a quantity; the price is read from the Product table at display time, so
 * a client that lies about what something costs has nothing to lie with.
 */

/** Opaque to the browser: httpOnly, so only the server ever reads it. */
const CART_SESSION_COOKIE = "cart_session";

/** 30 days, in seconds. */
const CART_SESSION_MAX_AGE = 60 * 60 * 24 * 30;

/**
 * 32 bytes = 256 bits. This value is the only thing between a stranger and
 * this cart, so it is sized like a session token rather than an id.
 */
const SESSION_ID_BYTES = 32;

/** What is wrong with a cart row, when the catalogue has moved under it. */
export type CartItemIssue =
  /** The product was deactivated after it went into the cart. */
  | "unavailable"
  /** Stock has since fallen to zero. */
  | "out-of-stock"
  /** Stock is positive but lower than the quantity in the cart. */
  | "insufficient-stock";

export type CartItemView = {
  /** The CartItem id — what the mutations take, always re-checked server-side. */
  id: string;
  quantity: number;
  /** unitPrice × quantity, exact. */
  lineTotal: Money;
  /** `null` when the row is fine as it stands. */
  issue: CartItemIssue | null;
  product: {
    id: string;
    name: string;
    slug: string;
    /** Live catalogue price, read now — carts do not snapshot, orders do. */
    unitPrice: Money;
    stock: number;
    isActive: boolean;
    image: { url: string; alt: string | null } | null;
  };
};

export type CartView = {
  items: CartItemView[];
  /** Sum of every line total. Money, not a number — format it, do not add to it. */
  subtotal: Money;
  /** Total units, not rows: two of one product counts as 2. */
  itemCount: number;
};

const cartItemSelect = {
  id: true,
  quantity: true,
  product: {
    select: {
      id: true,
      name: true,
      slug: true,
      price: true,
      stock: true,
      isActive: true,
      images: {
        orderBy: { position: "asc" },
        take: 1,
        select: { url: true, alt: true },
      },
    },
  },
} as const;

/**
 * Resolve the current request to a cart row, creating one if needed.
 *
 * **Every mutation goes through here, and nothing else looks up a cart.** Which
 * cart that is depends on who is asking: a signed-in visitor is matched on
 * `userId`, a guest on the session cookie. Nothing else in the module — and
 * nothing in any caller — has to know which case it is in.
 *
 * A signed-in visitor never gets a cart cookie written or refreshed. Their cart
 * is keyed to their account, so a session id would be a second, competing
 * identity for the same basket.
 *
 * Only callable from a Server Function or Route Handler — it writes a
 * `Set-Cookie` header, which Next.js forbids during rendering. Reads that
 * happen while a page renders use {@link findCart} instead.
 */
export async function getOrCreateCart() {
  const user = await getCurrentUser();

  if (user) {
    return prisma.cart.upsert({
      where: { userId: user.id },
      create: { userId: user.id },
      update: {},
      select: { id: true },
    });
  }

  const cookieStore = await cookies();
  const sessionId =
    cookieStore.get(CART_SESSION_COOKIE)?.value ||
    randomBytes(SESSION_ID_BYTES).toString("base64url");

  // Written on every mutation, not just the first: each write slides the 30 day
  // window forward, so a cart stays alive as long as it is being used.
  cookieStore.set(CART_SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: CART_SESSION_MAX_AGE,
  });

  // Upsert rather than find-then-create: `sessionId` is unique, so two requests
  // racing on a brand new cookie end with one cart instead of a crash.
  return prisma.cart.upsert({
    where: { sessionId },
    create: { sessionId },
    update: {},
    select: { id: true },
  });
}

/**
 * The read-only half of {@link getOrCreateCart}: never writes a cookie, so it
 * is safe during rendering. `null` means "this visitor has no cart yet", which
 * every reader treats as an empty one.
 *
 * Keyed the same way round — user first, cookie second — so a page and a
 * mutation in the same request always agree on which cart they are looking at.
 */
async function findCart() {
  const user = await getCurrentUser();

  if (user) {
    return prisma.cart.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
  }

  const cookieStore = await cookies();
  const sessionId = cookieStore.get(CART_SESSION_COOKIE)?.value;
  if (!sessionId) return null;

  // A cookie can outlive its row — a reset database, a pruned cart. Missing is
  // not an error; the next mutation recreates the row under the same id.
  return prisma.cart.findUnique({
    where: { sessionId },
    select: { id: true },
  });
}

function emptyCart(): CartView {
  return { items: [], subtotal: money("0.00"), itemCount: 0 };
}

function issueFor(
  product: { isActive: boolean; stock: number },
  quantity: number,
): CartItemIssue | null {
  if (!product.isActive) return "unavailable";
  if (product.stock === 0) return "out-of-stock";
  if (product.stock < quantity) return "insufficient-stock";
  return null;
}

/**
 * The cart as the visitor should see it: every row with its product, primary
 * image, current unit price and stock, plus the subtotal and unit count.
 *
 * Deliberately unfiltered by `isActive`. A product that was deactivated while
 * it sat in the cart still has to appear, carrying an `issue`, or the row would
 * silently vanish along with the money it represented. The subtotal covers
 * every row for the same reason: it is what is in the cart, and the flagged
 * rows carry their own warning about why they cannot be bought as they stand.
 *
 * Prices come back as `Decimal`. Format them with `formatPrice` on the server;
 * a Decimal handed to a Client Component would not survive serialisation.
 */
export async function getCart(): Promise<CartView> {
  const cart = await findCart();
  if (!cart) return emptyCart();

  const rows = await prisma.cartItem.findMany({
    where: { cartId: cart.id },
    select: cartItemSelect,
    // CartItem has no createdAt, and an unordered list would reshuffle itself
    // on every render. Product name is stable and reads sensibly.
    orderBy: { product: { name: "asc" } },
  });

  const items: CartItemView[] = rows.map(({ id, quantity, product }) => {
    const [image] = product.images;

    return {
      id,
      quantity,
      lineTotal: lineTotal(product.price, quantity),
      issue: issueFor(product, quantity),
      product: {
        id: product.id,
        name: product.name,
        slug: product.slug,
        unitPrice: product.price,
        stock: product.stock,
        isActive: product.isActive,
        image: image ?? null,
      },
    };
  });

  return {
    items,
    subtotal: sumMoney(items.map((item) => item.lineTotal)),
    itemCount: items.reduce((total, item) => total + item.quantity, 0),
  };
}

/**
 * Total units in the cart, for the header badge.
 *
 * Separate from {@link getCart} because this runs on every page in the site:
 * one aggregate over CartItem beats loading every product and image to add up
 * a number.
 */
export async function getCartItemCount(): Promise<number> {
  const cart = await findCart();
  if (!cart) return 0;

  const { _sum } = await prisma.cartItem.aggregate({
    where: { cartId: cart.id },
    _sum: { quantity: true },
  });

  return _sum.quantity ?? 0;
}

/**
 * Quantities arrive from the network, so they are whatever the caller sent —
 * `2.5`, `1e21`, `NaN`. Anything that is not a plain whole number is rejected
 * rather than coerced.
 */
function wholeQuantity(value: number): number | null {
  return Number.isSafeInteger(value) ? value : null;
}

/**
 * Put `quantity` more of a product in the cart.
 *
 * Adding something already in the cart increments that row: the
 * `@@unique([cartId, productId])` composite means the upsert either finds the
 * row or creates it, so a duplicate line is not merely avoided but impossible.
 *
 * The final quantity is clamped to what is actually in stock, and the caller is
 * told when that clamp bit.
 */
export async function addToCart(
  productId: string,
  quantity: number,
): Promise<CartResult> {
  const requested = wholeQuantity(quantity);
  if (requested === null || requested < 1) {
    return cartError("Choose a quantity of at least 1.");
  }

  // `isActive` is part of the lookup, not a check afterwards: an inactive
  // product is not in the catalogue, so it reads as missing.
  const product = await prisma.product.findFirst({
    where: { id: productId, isActive: true },
    select: { id: true, name: true, stock: true },
  });
  if (!product) return cartError("That product is not available.");
  if (product.stock === 0) return cartError(`${product.name} is out of stock.`);

  const cart = await getOrCreateCart();
  const where = {
    cartId_productId: { cartId: cart.id, productId: product.id },
  };

  const existing = await prisma.cartItem.findUnique({
    where,
    select: { quantity: true },
  });

  const current = existing?.quantity ?? 0;
  const desired = current + requested;
  const clamped = Math.min(desired, product.stock);

  if (clamped === current) {
    return cartWarning(
      `Only ${product.stock} of ${product.name} in stock, and your cart already has ${current}.`,
    );
  }

  await prisma.cartItem.upsert({
    where,
    create: { cartId: cart.id, productId: product.id, quantity: clamped },
    update: { quantity: clamped },
  });

  if (clamped < desired) {
    return cartWarning(
      `Only ${product.stock} of ${product.name} in stock — your cart now has ${clamped}.`,
    );
  }

  return cartSuccess(`${product.name} added to your cart.`);
}

/**
 * Set a row to an exact quantity.
 *
 * `0` removes the row rather than storing a quantity of zero; anything below
 * that is a bad request, not an instruction.
 *
 * The row is looked up by `id` **and** `cartId`, so a cart item id lifted from
 * someone else's session matches nothing. That scoping is the whole defence —
 * a cart item id on its own is never enough.
 */
export async function updateCartItemQuantity(
  cartItemId: string,
  quantity: number,
): Promise<CartResult> {
  const requested = wholeQuantity(quantity);
  if (requested === null || requested < 0) {
    return cartError("That quantity is not valid.");
  }
  if (requested === 0) return removeCartItem(cartItemId);

  const cart = await getOrCreateCart();

  const item = await prisma.cartItem.findFirst({
    where: { id: cartItemId, cartId: cart.id },
    select: {
      id: true,
      product: { select: { name: true, stock: true, isActive: true } },
    },
  });
  if (!item) return cartError("That item is no longer in your cart.");

  const { product } = item;
  if (!product.isActive) {
    return cartError(`${product.name} is no longer available. Remove it to continue.`);
  }
  if (product.stock === 0) {
    return cartError(`${product.name} is out of stock. Remove it to continue.`);
  }

  const clamped = Math.min(requested, product.stock);
  await prisma.cartItem.update({
    where: { id: item.id },
    data: { quantity: clamped },
  });

  if (clamped < requested) {
    return cartWarning(
      `Only ${product.stock} of ${product.name} in stock — quantity set to ${clamped}.`,
    );
  }

  return cartSuccess("Cart updated.");
}

/**
 * Remove one row.
 *
 * `deleteMany` scoped to the current cart rather than `delete` by id: ownership
 * and deletion are then a single statement that simply matches nothing when the
 * id belongs to another cart.
 */
export async function removeCartItem(cartItemId: string): Promise<CartResult> {
  const cart = await getOrCreateCart();

  const { count } = await prisma.cartItem.deleteMany({
    where: { id: cartItemId, cartId: cart.id },
  });
  if (count === 0) return cartError("That item is no longer in your cart.");

  return cartSuccess("Removed from your cart.");
}

/** Empty the cart, keeping the cart row and its cookie. */
export async function clearCart(): Promise<CartResult> {
  const cart = await getOrCreateCart();

  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });

  return cartSuccess("Your cart is now empty.");
}

/**
 * Fold the guest cart into `userId`'s cart. Called once, immediately after a
 * successful sign-in or sign-up.
 *
 * Someone who fills a basket and *then* logs in has done nothing wrong, and
 * losing that basket is the kind of thing that loses the sale. So the guest
 * cart is not discarded: it is either claimed outright (the account has no cart
 * yet — one `UPDATE`, no rows to copy) or merged row by row.
 *
 * Takes the id rather than reading the session, because the caller has just
 * issued the token and this request may still be carrying the cookie for it.
 *
 * The whole thing is one transaction. Half a merge — items moved but the guest
 * cart still standing, or the cart deleted with its contents nowhere — is worse
 * than no merge, and the delete at the end is what makes that possible.
 */
export async function mergeGuestCart(userId: string): Promise<void> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(CART_SESSION_COOKIE)?.value;

  // No cookie means nothing to merge: this visitor never had a guest cart.
  if (!sessionId) return;

  await prisma.$transaction(async (tx) => {
    const guestCart = await tx.cart.findUnique({
      where: { sessionId },
      select: {
        id: true,
        items: { select: { productId: true, quantity: true } },
      },
    });
    if (!guestCart) return;

    const userCart = await tx.cart.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!userCart) {
      // Nothing to merge into, so hand over the row itself. Clearing
      // `sessionId` is not tidying: it is what stops the cookie, if it somehow
      // survives, from reaching a cart that now belongs to an account.
      await tx.cart.update({
        where: { id: guestCart.id },
        data: { userId, sessionId: null },
      });
      return;
    }

    if (guestCart.items.length > 0) {
      const productIds = guestCart.items.map((item) => item.productId);

      // Two batched reads rather than a query per line: a merge is the one
      // moment a cart is touched wholesale.
      const products = await tx.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, stock: true },
      });
      const stockById = new Map(products.map((p) => [p.id, p.stock]));

      const existingItems = await tx.cartItem.findMany({
        where: { cartId: userCart.id, productId: { in: productIds } },
        select: { productId: true, quantity: true },
      });
      const existingByProduct = new Map(
        existingItems.map((item) => [item.productId, item.quantity]),
      );

      for (const item of guestCart.items) {
        const stock = stockById.get(item.productId);

        // The product was deleted between the guest adding it and signing in.
        // The foreign key would reject the row anyway.
        if (stock === undefined) continue;

        const combined = (existingByProduct.get(item.productId) ?? 0) + item.quantity;

        // Clamped to stock, but never below 1: a cart row of zero is not a row,
        // and silently dropping something the visitor picked out is exactly the
        // loss this function exists to prevent. `getCart` already shows an
        // out-of-stock line with a warning rather than hiding it.
        const quantity = Math.max(1, Math.min(combined, stock));

        await tx.cartItem.upsert({
          where: {
            cartId_productId: { cartId: userCart.id, productId: item.productId },
          },
          create: { cartId: userCart.id, productId: item.productId, quantity },
          update: { quantity },
        });
      }
    }

    // Cascades the guest cart's items away with it.
    await tx.cart.delete({ where: { id: guestCart.id } });
  });

  // Only once the transaction has committed. Dropping the cookie first would
  // strand the guest cart if the merge then rolled back.
  cookieStore.delete(CART_SESSION_COOKIE);
}
