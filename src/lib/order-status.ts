import { OrderStatus } from "@/generated/prisma/enums";
import { parsePageParam } from "@/lib/pagination";

/**
 * Everything this app knows about `OrderStatus` that is not a query: labels,
 * colours, the happy path, and which statuses mean money. The rules about
 * *moving between* them live in `order-transitions.ts`, which is an admin
 * concern and imports the labels from here.
 *
 * It lives in `lib/` rather than beside the queries for the reason
 * `cart-result.ts` gives: both sides of the network boundary need it. The list
 * page parses `?status=` on the server, the filter dropdown serialises it back
 * in the browser, and both label and colour a badge from the same tables. A
 * module that imported Prisma's client could not be in the second bundle;
 * `@/generated/prisma/enums` is a plain frozen object of string literals and is
 * safe in either.
 *
 * The URL is the only state here. A filtered, paged view survives a refresh,
 * opens correctly in a second tab, and is shareable by copying the address bar.
 */

/** The listing these params describe. */
export const ORDERS_PATH = "/account/orders";

/** Orders per page. */
export const ORDERS_PAGE_SIZE = 10;

/**
 * The happy path, in order.
 *
 * This is what the detail page's timeline walks. `CANCELLED` is deliberately
 * not in it: cancelling is a branch off the flow, not a step further along it,
 * and drawing it as the sixth stage would read as progress.
 */
export const ORDER_STATUS_FLOW = [
  OrderStatus.PENDING,
  OrderStatus.PAID,
  OrderStatus.PROCESSING,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
] as const;

/** `PENDING` reads as shouting anywhere it sits in a sentence. */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "Pending",
  PAID: "Paid",
  PROCESSING: "Processing",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

/**
 * Badge colours, one per status.
 *
 * Each pair sets its own dark-mode variant rather than relying on a token:
 * these are the only place in the app that uses hue to carry meaning, and the
 * semantic tokens in `globals.css` are all greyscale. Colour is never the only
 * signal — the label beside it says the same thing.
 */
export const ORDER_STATUS_BADGE_CLASSES: Record<OrderStatus, string> = {
  PENDING:
    "bg-amber-100 text-amber-900 dark:bg-amber-400/15 dark:text-amber-200",
  PAID: "bg-blue-100 text-blue-900 dark:bg-blue-400/15 dark:text-blue-200",
  PROCESSING:
    "bg-blue-100 text-blue-900 dark:bg-blue-400/15 dark:text-blue-200",
  SHIPPED:
    "bg-indigo-100 text-indigo-900 dark:bg-indigo-400/15 dark:text-indigo-200",
  DELIVERED:
    "bg-emerald-100 text-emerald-900 dark:bg-emerald-400/15 dark:text-emerald-200",
  CANCELLED: "bg-muted text-muted-foreground",
};

/**
 * The statuses an order can still be cancelled from.
 *
 * Once a warehouse has started on an order, calling it off is a conversation
 * with support rather than a button. This list is the rule, and it is enforced
 * inside the cancelling transaction — the button only reads it to decide
 * whether to render.
 */
export const CANCELLABLE_STATUSES = [
  OrderStatus.PENDING,
  OrderStatus.PAID,
] as const;

export function isCancellable(status: OrderStatus): boolean {
  return (CANCELLABLE_STATUSES as readonly OrderStatus[]).includes(status);
}

/**
 * The statuses whose orders count as money the shop has taken.
 *
 * `PENDING` is excluded because nothing has been paid yet, and `CANCELLED`
 * because whatever was paid is not revenue. Everything else is an order that
 * was paid for and is somewhere between the warehouse and the door.
 *
 * Here rather than beside the aggregation in `server/admin-orders.ts` because
 * the dashboard names these four statuses in its own copy, and a figure whose
 * caption is maintained separately from its `WHERE` clause is a figure that
 * eventually lies about itself.
 */
export const REVENUE_STATUSES = [
  OrderStatus.PAID,
  OrderStatus.PROCESSING,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
] as const;

/**
 * Whether an arbitrary value is one of the six statuses.
 *
 * Everything that reaches a Server Action or a query string crossed the network,
 * so its TypeScript type is a claim rather than a fact. This is the check that
 * turns the claim into one.
 */
export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && value in OrderStatus;
}

/** What the status dropdown offers, in the order it lists them. */
export const ORDER_STATUS_FILTERS = [
  { value: "", label: "All orders" },
  ...Object.values(OrderStatus).map((status) => ({
    value: status,
    label: ORDER_STATUS_LABELS[status],
  })),
] as const;

/** Order list state, read from the query string. */
export type OrderFilters = {
  /** `undefined` is "All", so this spreads straight into the query options. */
  status?: OrderStatus;
  /** 1-based. */
  page: number;
};

/** What `page.tsx` gets from `await searchParams`. */
type RawSearchParams = Record<string, string | string[] | undefined>;

/**
 * A status filter, or `undefined` for anything that is not one.
 *
 * `?status=` arrives as whatever was typed or whatever a stale link carried —
 * `?status=pending`, `?status=DROP TABLE`, `?status=a&status=b`. Junk falls
 * back to All rather than throwing or filtering to nothing, so a bad URL shows
 * the whole history instead of an empty page that looks like lost orders.
 */
export function parseOrderStatusParam(
  value: string | string[] | undefined,
): OrderStatus | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return undefined;

  return isOrderStatus(raw) ? raw : undefined;
}

export function parseOrderFilters(params: RawSearchParams): OrderFilters {
  return {
    status: parseOrderStatusParam(params.status),
    page: parsePageParam(params.page),
  };
}

/**
 * The order list URL for a set of filters.
 *
 * Defaults are omitted, so the unfiltered first page is `/account/orders`
 * rather than `/account/orders?status=&page=1` — one URL per view.
 */
export function ordersHref(filters: OrderFilters): string {
  const params = new URLSearchParams();

  if (filters.status) params.set("status", filters.status);
  if (filters.page > 1) params.set("page", String(filters.page));

  const query = params.toString();

  return query ? `${ORDERS_PATH}?${query}` : ORDERS_PATH;
}

/**
 * Apply a change to the current filters.
 *
 * Changing the status returns to page 1: page 3 of the whole history is not
 * page 3 of the cancelled orders, and landing on an empty page after picking a
 * filter reads as a filter that is broken. Paging is the one patch allowed to
 * set `page`.
 */
export function withOrderFilters(
  current: OrderFilters,
  patch: Partial<OrderFilters>,
): OrderFilters {
  const next = { ...current, ...patch };
  if (!("page" in patch)) next.page = 1;

  return next;
}

/** Shorthand for the URL a control changing one filter should point at. */
export function orderFilterHref(
  current: OrderFilters,
  patch: Partial<OrderFilters>,
): string {
  return ordersHref(withOrderFilters(current, patch));
}
