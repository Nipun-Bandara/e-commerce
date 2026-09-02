import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { OrderStatus } from "@/generated/prisma/enums";
import {
  ADMIN_ORDERS_PAGE_SIZE,
  ADMIN_ORDERS_PATH,
  DEFAULT_ADMIN_ORDER_SORT,
  type AdminOrderSort,
} from "@/lib/admin-order-filters";
import { colomboDayEnd, colomboDayStart } from "@/lib/dates";
import { lineTotal, money, type Money } from "@/lib/money";
import {
  ORDER_STATUS_LABELS,
  REVENUE_STATUSES,
} from "@/lib/order-status";
import { sourcesFor } from "@/lib/order-transitions";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/server/auth";
import type { OrderTotals } from "@/server/checkout";
import { restoreStock } from "@/server/stock";

/**
 * Every query the admin order screens make, read and write.
 *
 * Separate from `orders.ts`, which is the customer's view of the same table.
 * That module scopes every query to `userId` because a shopper must never see
 * somebody else's order; this one must see all of them. Adding an
 * `includeEveryone` flag to the customer functions would have put a boolean
 * between a shopper and the whole shop's history, and the day it is passed wrong
 * is the day one customer reads another's address.
 *
 * Nothing here is a Server Action. `admin-order-actions.ts` is the thin
 * `"use server"` file that exposes exactly one of these to a browser.
 *
 * ## Snapshots
 *
 * The detail query selects `productName` and `unitPrice` from `OrderItem` and
 * the `shipping*` columns from `Order`, and it does **not** join to `Product` or
 * to `Address` at all. Renaming a product, repricing it, deleting it or editing
 * an address must not rewrite what an order says it was — and on this screen
 * that matters more than on the customer's, because this is the screen somebody
 * opens to answer "what exactly did they buy, and for how much".
 */

/** The columns the order table renders, and nothing else. */
const adminOrderListSelect = {
  orderNumber: true,
  status: true,
  createdAt: true,
  total: true,
  // The customer, for the name-and-email column. Nullable: `Order.userId` goes
  // NULL when an account is deleted, and the order outlives it.
  user: { select: { name: true, email: true } },
  // The snapshot name, which is the only name an orphaned order still has.
  shippingName: true,
  // Quantities only. The row shows how many things were bought, and summing
  // here beats a second query per order.
  items: { select: { quantity: true } },
} as const;

type AdminOrderListRow = Prisma.OrderGetPayload<{
  select: typeof adminOrderListSelect;
}>;

export type AdminOrderListItem = {
  orderNumber: string;
  status: OrderStatus;
  placedAt: Date;
  /** The account's name, or the shipping snapshot when the account is gone. */
  customerName: string;
  /** `null` once the account has been deleted — there is no address to reach. */
  customerEmail: string | null;
  /** Units, not lines: two of one thing reads as "2 items", not "1 item". */
  itemCount: number;
  total: Money;
};

function toListItem(row: AdminOrderListRow): AdminOrderListItem {
  return {
    orderNumber: row.orderNumber,
    status: row.status,
    placedAt: row.createdAt,
    // Falling back to the snapshot rather than showing a blank cell: a deleted
    // account still shipped to somebody, and their name is on the order.
    customerName: row.user?.name ?? row.shippingName,
    customerEmail: row.user?.email ?? null,
    itemCount: row.items.reduce((count, item) => count + item.quantity, 0),
    total: row.total,
  };
}

/**
 * Every sort the order list offers, each with `id` as a tiebreaker.
 *
 * The tiebreaker is not decoration. `createdAt` ties whenever the seed or a
 * burst of checkouts writes several rows in the same millisecond, and `total`
 * ties constantly — every order of the same thing is the same number. Tied rows
 * may come back in a different sequence for the page-2 query than the page-1
 * query, which shows one order twice and hides another entirely. `id` is
 * unique, so it settles them.
 */
const ADMIN_ORDER_ORDER_BY: Record<
  AdminOrderSort,
  Prisma.OrderOrderByWithRelationInput[]
> = {
  "date-desc": [{ createdAt: "desc" }, { id: "desc" }],
  "date-asc": [{ createdAt: "asc" }, { id: "asc" }],
  "total-desc": [{ total: "desc" }, { id: "desc" }],
  "total-asc": [{ total: "asc" }, { id: "asc" }],
};

export type ListAdminOrdersOptions = {
  /** 1-based. Clamped into range, so an out-of-range `?page=` is harmless. */
  page?: number;
  /** Free text matched against order number, customer name or email. */
  q?: string;
  /** Omit for every status. */
  status?: OrderStatus;
  /** Inclusive `YYYY-MM-DD` bounds, read as Colombo days. */
  from?: string;
  to?: string;
  sort?: AdminOrderSort;
};

/**
 * The `where` for a set of filters. Every axis narrows the same query, so
 * search, status and a date range compose rather than override one another.
 *
 * The date bounds are Colombo days, not UTC ones — see `colomboDayStart`. `to`
 * is exclusive of the *following* midnight rather than inclusive of 23:59:59,
 * so an order placed in the last second of the chosen day still matches.
 *
 * The search covers the three things an admin has to hand when someone gets in
 * touch: the number off the confirmation email, and the name or address of the
 * account that placed it. An order whose account has since been deleted matches
 * by number only — it has no `user` row left to match a name against, and the
 * name shown in the table is the shipping snapshot.
 */
function adminOrderWhere({
  q,
  status,
  from,
  to,
}: ListAdminOrdersOptions): Prisma.OrderWhereInput {
  const search = q?.trim();

  const placed =
    from || to
      ? {
          createdAt: {
            ...(from ? { gte: colomboDayStart(from) } : {}),
            ...(to ? { lt: colomboDayEnd(to) } : {}),
          },
        }
      : {};

  return {
    ...(status ? { status } : {}),
    ...placed,
    ...(search
      ? {
          OR: [
            { orderNumber: { contains: search, mode: "insensitive" } },
            { user: { name: { contains: search, mode: "insensitive" } } },
            { user: { email: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
}

/**
 * One page of orders — from every customer, unlike `getUserOrders`.
 *
 * The count runs before the page query because the page number is clamped
 * against it: asking for page 9 of 3 returns the last page rather than an empty
 * table, which is what happens when a filter narrows the list you were paging.
 */
export async function listAdminOrders(options: ListAdminOrdersOptions = {}) {
  const { page = 1, sort = DEFAULT_ADMIN_ORDER_SORT } = options;
  const take = ADMIN_ORDERS_PAGE_SIZE;
  const where = adminOrderWhere(options);

  const total = await prisma.order.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / take));
  const currentPage = Math.min(Math.max(1, Math.trunc(page)), pageCount);

  const rows = await prisma.order.findMany({
    where,
    orderBy: ADMIN_ORDER_ORDER_BY[sort],
    select: adminOrderListSelect,
    skip: (currentPage - 1) * take,
    take,
  });

  return {
    orders: rows.map(toListItem),
    total,
    page: currentPage,
    pageCount,
  };
}

/** The dashboard widget: the newest orders, whoever placed them. */
export async function listRecentAdminOrders(
  limit: number,
): Promise<AdminOrderListItem[]> {
  const rows = await prisma.order.findMany({
    orderBy: ADMIN_ORDER_ORDER_BY["date-desc"],
    select: adminOrderListSelect,
    take: Math.max(1, Math.trunc(limit)),
  });

  return rows.map(toListItem);
}

export type AdminOrderItemView = {
  id: string;
  /** The snapshot. There is no join to `Product` in this query at all. */
  productName: string;
  /** What it cost when it was bought. */
  unitPrice: Money;
  quantity: number;
  lineTotal: Money;
};

export type AdminOrderDetail = {
  orderNumber: string;
  status: OrderStatus;
  placedAt: Date;
  /** Last write to the row — in practice, the last status change. */
  updatedAt: Date;
  customer: {
    name: string;
    /** `null` once the account is deleted; the order keeps its snapshots. */
    email: string | null;
  };
  totals: OrderTotals;
  shipping: {
    name: string;
    phone: string;
    line1: string;
    line2: string | null;
    city: string;
    postalCode: string;
  };
  items: AdminOrderItemView[];
};

/**
 * One order, whoever it belongs to.
 *
 * No ownership condition — that is the whole difference from
 * `getOrderByNumberForUser`, and it is why every caller of this is behind
 * `requireAdmin`. `null` for a number that does not exist, which the page turns
 * into a 404.
 */
export async function getAdminOrderByNumber(
  orderNumber: string,
): Promise<AdminOrderDetail | null> {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    select: {
      orderNumber: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      subtotal: true,
      shippingFee: true,
      total: true,
      shippingName: true,
      shippingPhone: true,
      shippingLine1: true,
      shippingLine2: true,
      shippingCity: true,
      shippingPostalCode: true,
      user: { select: { name: true, email: true } },
      items: {
        // The snapshots, and only the snapshots. No `product` relation is
        // selected, so there is no live row here to read by accident.
        select: {
          id: true,
          productName: true,
          unitPrice: true,
          quantity: true,
        },
        // Sorted on the snapshot too, for the same reason: renaming a product
        // must not reshuffle an order somebody has already been shown.
        orderBy: { productName: "asc" },
      },
    },
  });
  if (!order) return null;

  return {
    orderNumber: order.orderNumber,
    status: order.status,
    placedAt: order.createdAt,
    updatedAt: order.updatedAt,
    customer: {
      name: order.user?.name ?? order.shippingName,
      email: order.user?.email ?? null,
    },
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

export type UpdateOrderStatusResult =
  /** Moved by this call. Stock has been put back if it went to CANCELLED. */
  | { status: "updated"; message: string }
  /** Already in that status — a double click, a second tab. Nothing changed. */
  | { status: "unchanged"; message: string }
  /** The move is not allowed from where the order is, or there is no such order. */
  | { status: "rejected"; message: string };

/**
 * Move one order to `next`, enforcing the transition rules and restoring stock
 * on a cancellation.
 *
 * ## The rule is in the `WHERE`, not in this process
 *
 * `sourcesFor(next)` is the list of statuses an order must be in for this move
 * to be legal, derived from the single transition table in
 * `lib/order-transitions.ts`. It goes into the `WHERE` of an `updateMany`, so
 * **Postgres** decides whether the move is allowed, against the row as it stands
 * at the moment of the write, holding the row lock. Not against a status this
 * function read a moment earlier, which a concurrent request could already have
 * changed.
 *
 * That is what makes this hold against a hand-crafted request. The dropdown only
 * offers legal moves, but the dropdown is not a mechanism — a POST asking to put
 * a DELIVERED order back to PENDING matches `sourcesFor(PENDING)`, which is
 * empty, so it matches no row and changes nothing. Every rejection is a query
 * that matched zero rows, never a branch that could be skipped.
 *
 * ## Stock comes back exactly once
 *
 * `CANCELLED` is not in `sourcesFor(CANCELLED)`, so an order that is already
 * cancelled cannot win the update. The restoration runs **inside the branch that
 * won it**, and only there — so a double click, a replayed POST or a second tab
 * takes the `unchanged` path and puts nothing back a second time. The update and
 * the restoration are one transaction: an order marked `CANCELLED` whose stock
 * never came back is silently unsellable inventory.
 *
 * This calls `restoreStock` from `server/stock.ts` — the same function checkout
 * and customer cancellation use. There is exactly one piece of code in this app
 * that adds units back to a product.
 *
 * ## The guard, twice
 *
 * `requireAdmin` runs in `admin-order-actions.ts` *and* here. Not belt and
 * braces: the action's guard is what stops a signed-in USER who knows the action
 * id from POSTing to this, and this one is what protects every future caller —
 * a cron job, a second action, an import script written six months from now by
 * somebody who did not read this comment. `cancelOrder` scopes itself for the
 * same reason. It costs a cookie read, not a query.
 */
export async function updateOrderStatus(
  orderNumber: string,
  next: OrderStatus,
): Promise<UpdateOrderStatusResult> {
  await requireAdmin(ADMIN_ORDERS_PATH);

  const allowedFrom = sourcesFor(next);

  // Nothing may move to PENDING: it is where an order starts, not somewhere it
  // returns to. Answered before opening a transaction — there is no row this
  // could be true of.
  if (allowedFrom.length === 0) {
    return {
      status: "rejected",
      message: `An order cannot be moved back to ${ORDER_STATUS_LABELS[next]}.`,
    };
  }

  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { orderNumber },
      select: { id: true },
    });
    if (!order) {
      return {
        status: "rejected",
        message: "We could not find that order.",
      };
    }

    const { count } = await tx.order.updateMany({
      where: { id: order.id, status: { in: [...allowedFrom] } },
      data: { status: next },
    });

    if (count === 0) {
      // Re-read rather than reuse a status from before the update: if another
      // request held the row lock, this update waited for it and the status it
      // failed against is the one that request committed.
      const current = await tx.order.findUniqueOrThrow({
        where: { id: order.id },
        select: { status: true },
      });

      if (current.status === next) {
        return {
          status: "unchanged",
          message: `Order ${orderNumber} is already ${ORDER_STATUS_LABELS[next].toLowerCase()}. Nothing has changed.`,
        };
      }

      return {
        status: "rejected",
        message: `Order ${orderNumber} is ${ORDER_STATUS_LABELS[current.status].toLowerCase()} and cannot be moved to ${ORDER_STATUS_LABELS[next].toLowerCase()}.`,
      };
    }

    if (next === OrderStatus.CANCELLED) {
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

      return {
        status: "updated",
        message: `Order ${orderNumber} was cancelled and its stock has been put back.`,
      };
    }

    return {
      status: "updated",
      message: `Order ${orderNumber} is now ${ORDER_STATUS_LABELS[next].toLowerCase()}.`,
    };
  });
}

/** The brief says five. Enough to see a pattern, short enough to read at a glance. */
const TOP_PRODUCTS_LIMIT = 5;

/** The window the "recent orders" figure counts, as a rolling seven days. */
const RECENT_WINDOW_DAYS = 7;

export type TopProduct = {
  /** The `OrderItem` snapshot, which is what was actually sold under that name. */
  productName: string;
  /** Units, summed across every line carrying that name. */
  quantity: number;
};

export type AdminOrderStats = {
  /** Summed with Decimal, never a float. Zero when nothing qualifies. */
  revenue: Money;
  /** How many orders that figure is made of. */
  revenueOrderCount: number;
  /** Every status, including the ones with no orders. */
  countsByStatus: Record<OrderStatus, number>;
  totalOrders: number;
  recentOrders: number;
  recentWindowDays: number;
  topProducts: TopProduct[];
};

/**
 * The dashboard's figures.
 *
 * ## Money
 *
 * `revenue` is a Postgres `sum()` over `numeric(10, 2)`, which Prisma hands back
 * as a `Decimal`. It is never converted to a `number` — not here, not in the
 * page, which formats it with `formatPrice`. Adding up a day's orders in binary
 * floating point is precisely the arithmetic that drifts, and a revenue figure
 * that is a cent out is a revenue figure nobody trusts again.
 *
 * `_sum` is `null` when no order matches, which is a real state on a new shop
 * rather than an error — it becomes `LKR 0.00`.
 *
 * ## Which orders count
 *
 * {@link REVENUE_STATUSES} — paid, processing, shipped, delivered. `PENDING` has
 * not been paid for and `CANCELLED` is not money the shop kept.
 *
 * ## Top products
 *
 * Grouped by the `OrderItem.productName` snapshot, over every line in the table,
 * with no join to `Product` and no status filter. Two consequences worth being
 * deliberate about:
 *
 *  - A product that has since been **deleted** still appears, with its sales
 *    intact. Grouping by `productId` would drop those lines entirely — they went
 *    NULL — which would quietly understate what the shop has sold.
 *  - A product that was **renamed** counts as two entries, because two different
 *    things were sold under two different names as far as any past order is
 *    concerned.
 *
 * The figure is therefore exactly what is in `OrderItem`, which is what makes it
 * checkable against the table by hand.
 *
 * ## One transaction
 *
 * The five queries are independent and would each be correct on their own, but a
 * dashboard whose revenue and order count describe two different instants is the
 * kind of thing that costs an hour to disbelieve.
 *
 * An **interactive** transaction rather than the array form `getAdminStats`
 * uses. Not a style choice: Prisma's `$transaction([…])` widens what it is
 * handed to `PrismaPromise<unknown>[]`, which throws away the payload types
 * `groupBy` computes from `by` and `_sum` — `row._count` comes back possibly
 * undefined and `_sum.quantity` stops existing. Awaiting each call inside a
 * callback keeps every one of them individually typed, at the cost of holding
 * the transaction open across five reads. For a dashboard that is nothing.
 */
export async function getAdminOrderStats(): Promise<AdminOrderStats> {
  const since = new Date(Date.now() - RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  return prisma.$transaction(async (tx) => {
    const revenue = await tx.order.aggregate({
      where: { status: { in: [...REVENUE_STATUSES] } },
      _sum: { total: true },
      _count: true,
    });

    const statusCounts = await tx.order.groupBy({
      by: ["status"],
      _count: { _all: true },
      // Not for the display order — the record below is rebuilt in enum order
      // regardless. Prisma's `groupBy` types require an `orderBy`, and grouping
      // without one leaves Postgres free to return the rows in any sequence
      // anyway.
      orderBy: { status: "asc" },
    });

    const totalOrders = await tx.order.count();
    const recentOrders = await tx.order.count({
      where: { createdAt: { gte: since } },
    });

    const topRows = await tx.orderItem.groupBy({
      by: ["productName"],
      _sum: { quantity: true },
      // `productName` breaks ties, so the five that come back are the same five
      // every time rather than whichever five Postgres happened to emit.
      orderBy: [{ _sum: { quantity: "desc" } }, { productName: "asc" }],
      take: TOP_PRODUCTS_LIMIT,
    });

    // Every status present, including the ones nothing is in: a dashboard that
    // hides "Cancelled" when there are none reads as a missing row, not a zero.
    const countsByStatus = Object.fromEntries(
      Object.values(OrderStatus).map((status) => [status, 0]),
    ) as Record<OrderStatus, number>;

    for (const row of statusCounts) {
      countsByStatus[row.status] = row._count._all;
    }

    return {
      revenue: revenue._sum.total ?? money("0.00"),
      revenueOrderCount: revenue._count,
      countsByStatus,
      totalOrders,
      recentOrders,
      recentWindowDays: RECENT_WINDOW_DAYS,
      topProducts: topRows.map((row) => ({
        productName: row.productName,
        quantity: row._sum.quantity ?? 0,
      })),
    };
  });
}
