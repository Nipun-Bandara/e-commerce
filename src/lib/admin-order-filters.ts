import type { OrderStatus } from "@/generated/prisma/enums";

import { parseOrderStatusParam } from "@/lib/order-status";
import { parsePageParam } from "@/lib/pagination";

/**
 * The admin order list's state: parsed from the query string, and serialised
 * back to it.
 *
 * Separate from `order-status.ts`'s `OrderFilters`, which is the customer's view
 * of their own history. That listing has one axis — status — because a shopper
 * with nine orders does not need a date range. This one is a search tool over
 * every order in the shop and has five, and folding them into one type would
 * mean three fields ignored on every customer page.
 *
 * The URL is the only state. A filtered, sorted, paged view survives a refresh,
 * opens the same way in a second tab, is shareable by pasting the address bar,
 * and — the one that matters daily — is where you land again after opening an
 * order and coming back.
 *
 * ## Defensive parsing
 *
 * Every field falls back to a default rather than throwing. `?sort=drop-table`
 * sorts newest-first, `?status=pending` (wrong case) shows all statuses,
 * `?page=-5` is page 1, `?from=banana` and `?from=2026-02-31` are no date filter
 * at all. These params reach a query over every customer's orders, so nothing
 * here trusts its input far enough to hand it on unchecked.
 *
 * Nothing in this module imports Prisma or `next/*`: the parser runs on the
 * server in `page.tsx`, the serialiser runs in the browser in the filter bar, so
 * it has to be safe in both bundles.
 */

/** The listing these filters describe. */
export const ADMIN_ORDERS_PATH = "/admin/orders";

/** The brief says 20. A table row is one line, so a screen holds a page. */
export const ADMIN_ORDERS_PAGE_SIZE = 20;

/**
 * The sort orders offered, in the order the dropdown lists them.
 *
 * Date and total, both directions, which is what the brief asks for. Newest
 * first is the default because the question this screen usually answers is
 * "what has just come in".
 */
export const ADMIN_ORDER_SORTS = [
  { value: "date-desc", label: "Date: newest first" },
  { value: "date-asc", label: "Date: oldest first" },
  { value: "total-desc", label: "Total: high to low" },
  { value: "total-asc", label: "Total: low to high" },
] as const;

export type AdminOrderSort = (typeof ADMIN_ORDER_SORTS)[number]["value"];

export const DEFAULT_ADMIN_ORDER_SORT: AdminOrderSort = "date-desc";

/**
 * Longest `?q=` acted on. The value ends up inside a `LIKE` pattern, so it is
 * bounded rather than passed through at whatever length a URL supplies.
 */
const MAX_QUERY_LENGTH = 100;

export type AdminOrderFilters = {
  /** Free text matched against order number, customer name or email; `""` for none. */
  q: string;
  /** `undefined` is "All", so this spreads straight into the query options. */
  status?: OrderStatus;
  /** Inclusive lower bound as `YYYY-MM-DD`, read as a Colombo day. */
  from?: string;
  /** Inclusive upper bound as `YYYY-MM-DD`, read as a Colombo day. */
  to?: string;
  sort: AdminOrderSort;
  /** 1-based. */
  page: number;
};

/** What `page.tsx` gets from `await searchParams`. */
type RawSearchParams = Record<string, string | string[] | undefined>;

/** First value of a repeated param (`?q=a&q=b`), trimmed; `undefined` if blank. */
function firstValue(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();

  return trimmed ? trimmed : undefined;
}

/** `YYYY-MM-DD`, and nothing else. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A calendar date, or `undefined`.
 *
 * The shape test is not enough on its own: `2026-02-31` matches the pattern and
 * is not a day. Parsing it and checking that the date survives the round trip
 * rejects it — `new Date("2026-02-31")` rolls forward to 3 March, which would
 * silently filter to a range nobody asked for.
 */
export function parseDateParam(
  value: string | string[] | undefined,
): string | undefined {
  const raw = firstValue(value);
  if (!raw || !ISO_DATE.test(raw)) return undefined;

  const parsed = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return undefined;

  return parsed.toISOString().slice(0, 10) === raw ? raw : undefined;
}

/**
 * Read every filter out of the query string.
 *
 * An inverted range — `?from=2026-09-10&to=2026-09-01` — is kept as given rather
 * than swapped or dropped. Both dates are real, the query honestly matches
 * nothing, and the empty state offers the way back out. Silently reordering
 * someone's input would show them results for a range they did not ask for.
 */
export function parseAdminOrderFilters(
  params: RawSearchParams,
): AdminOrderFilters {
  const sort = firstValue(params.sort);

  return {
    q: firstValue(params.q)?.slice(0, MAX_QUERY_LENGTH) ?? "",
    status: parseOrderStatusParam(params.status),
    from: parseDateParam(params.from),
    to: parseDateParam(params.to),
    sort: ADMIN_ORDER_SORTS.some((option) => option.value === sort)
      ? (sort as AdminOrderSort)
      : DEFAULT_ADMIN_ORDER_SORT,
    page: parsePageParam(params.page),
  };
}

/**
 * The query string for a set of filters.
 *
 * Defaults are omitted, so the unfiltered list is `/admin/orders` rather than
 * `/admin/orders?q=&sort=date-desc&page=1` — one URL per view, and a "clear
 * filters" link that visibly returns to a clean address.
 */
export function adminOrderFiltersToQuery(
  filters: AdminOrderFilters,
): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.q) params.set("q", filters.q);
  if (filters.status) params.set("status", filters.status);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.sort !== DEFAULT_ADMIN_ORDER_SORT) params.set("sort", filters.sort);
  if (filters.page > 1) params.set("page", String(filters.page));

  return params;
}

/** The admin order list URL for a set of filters. */
export function adminOrdersHref(filters: AdminOrderFilters): string {
  const query = adminOrderFiltersToQuery(filters).toString();

  return query ? `${ADMIN_ORDERS_PATH}?${query}` : ADMIN_ORDERS_PATH;
}

/**
 * Apply a change to the current filters.
 *
 * Any change that alters the result set returns to page 1: page 3 of every
 * order is not page 3 of the cancelled ones, and landing on an empty page after
 * picking a filter reads as a filter that is broken. Paging is the one patch
 * allowed to set `page`.
 */
export function withAdminOrderFilters(
  current: AdminOrderFilters,
  patch: Partial<AdminOrderFilters>,
): AdminOrderFilters {
  const next = { ...current, ...patch };
  if (!("page" in patch)) next.page = 1;

  return next;
}

/** Shorthand for the URL a control changing one filter should point at. */
export function adminOrderFilterHref(
  current: AdminOrderFilters,
  patch: Partial<AdminOrderFilters>,
): string {
  return adminOrdersHref(withAdminOrderFilters(current, patch));
}

/**
 * How many filters are narrowing the list.
 *
 * Sort and page are not counted: neither changes *which* orders match, and
 * clearing the filters should not also reset the chosen order.
 */
export function adminOrderFilterCount(filters: AdminOrderFilters): number {
  return (
    (filters.q ? 1 : 0) +
    (filters.status ? 1 : 0) +
    (filters.from ? 1 : 0) +
    (filters.to ? 1 : 0)
  );
}

/** The filters with every narrowing cleared, keeping the chosen sort order. */
export function clearedAdminOrderFilters(
  filters: AdminOrderFilters,
): AdminOrderFilters {
  return {
    q: "",
    status: undefined,
    from: undefined,
    to: undefined,
    sort: filters.sort,
    page: 1,
  };
}

/** The list filtered to one customer's orders — the link on the detail page. */
export function customerOrdersHref(email: string): string {
  return `${ADMIN_ORDERS_PATH}?q=${encodeURIComponent(email)}`;
}

/** The list filtered to one status — the links on the dashboard breakdown. */
export function statusOrdersHref(status: OrderStatus): string {
  return `${ADMIN_ORDERS_PATH}?status=${status}`;
}
