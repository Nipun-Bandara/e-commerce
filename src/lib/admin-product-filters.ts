import { parsePageParam } from "@/lib/pagination";

/**
 * The admin product list's state: parsed from the query string, and serialised
 * back to it.
 *
 * Separate from `product-filters.ts` rather than an extension of it. The two
 * listings answer different questions — the storefront asks "what can I buy",
 * the admin asks "what exists, including the things nobody can buy" — and they
 * disagree about almost every axis: this one can sort by stock, filter by
 * *inactive*, and search a SKU, none of which the catalogue should offer. One
 * shared type with half its fields ignored on each side would be a worse
 * description of both.
 *
 * The URL is still the only source of truth, for the same reasons: a filtered
 * view survives a refresh, opens the same way in a second tab, and is shareable
 * by copying the address bar. It also means the "edit product, come back"
 * round trip returns to the row you were looking at.
 *
 * Nothing here imports Prisma or `next/*` — the parser runs on the server in
 * `page.tsx`, the serialiser runs in Client Components, so this module has to
 * be safe in both bundles.
 */

/** The listing these filters describe. */
export const ADMIN_PRODUCTS_PATH = "/admin/products";

/** The brief says 20. Higher than the storefront's grid because a table row is one line. */
export const ADMIN_PRODUCTS_PAGE_SIZE = 20;

/**
 * The sort orders offered, in the order the dropdown lists them.
 *
 * Every field the brief names, in both directions. Descending stock is not
 * decoration: "what is about to run out" is the reason an admin opens this
 * screen, and it is `stock-asc`.
 */
export const ADMIN_PRODUCT_SORTS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "name-asc", label: "Name: A to Z" },
  { value: "name-desc", label: "Name: Z to A" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "stock-asc", label: "Stock: low to high" },
  { value: "stock-desc", label: "Stock: high to low" },
] as const;

export type AdminProductSort = (typeof ADMIN_PRODUCT_SORTS)[number]["value"];

export const DEFAULT_ADMIN_SORT: AdminProductSort = "newest";

/** The three states of the active filter, in the order the dropdown lists them. */
export const ADMIN_ACTIVE_FILTERS = [
  { value: "all", label: "Active and inactive" },
  { value: "active", label: "Active only" },
  { value: "inactive", label: "Inactive only" },
] as const;

export type AdminActiveFilter = (typeof ADMIN_ACTIVE_FILTERS)[number]["value"];

export const DEFAULT_ACTIVE_FILTER: AdminActiveFilter = "all";

/**
 * Longest `?q=` acted on. The value ends up inside a `LIKE` pattern, so it is
 * bounded rather than passed through at whatever length the URL supplies.
 */
const MAX_QUERY_LENGTH = 100;

export type AdminProductFilters = {
  /** Free text matched against name or SKU; `""` when there is no search. */
  q: string;
  /** Category **slug**, not id — the URL stays readable and survives a reseed. */
  category?: string;
  active: AdminActiveFilter;
  sort: AdminProductSort;
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

/**
 * Read every filter out of the query string, defensively.
 *
 * Search params are whatever was typed or a stale bookmark carried, so every
 * field falls back to its default instead of throwing: `?sort=xyz` sorts by
 * newest, `?active=maybe` shows everything, `?page=-5` is page 1. An unknown
 * `?category=` slug is kept — it is a real slug that may simply have been
 * renamed, and the query returns no rows, which is the honest answer.
 */
export function parseAdminProductFilters(
  params: RawSearchParams,
): AdminProductFilters {
  const sort = firstValue(params.sort);
  const active = firstValue(params.active);

  return {
    q: firstValue(params.q)?.slice(0, MAX_QUERY_LENGTH) ?? "",
    category: firstValue(params.category),
    active: ADMIN_ACTIVE_FILTERS.some((option) => option.value === active)
      ? (active as AdminActiveFilter)
      : DEFAULT_ACTIVE_FILTER,
    sort: ADMIN_PRODUCT_SORTS.some((option) => option.value === sort)
      ? (sort as AdminProductSort)
      : DEFAULT_ADMIN_SORT,
    page: parsePageParam(params.page),
  };
}

/**
 * The query string for a set of filters.
 *
 * Defaults are omitted, so the unfiltered list is `/admin/products` rather than
 * `/admin/products?q=&active=all&sort=newest&page=1` — one URL per view, and a
 * "clear filters" link that visibly returns to a clean address.
 */
export function adminProductFiltersToQuery(
  filters: AdminProductFilters,
): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.q) params.set("q", filters.q);
  if (filters.category) params.set("category", filters.category);
  if (filters.active !== DEFAULT_ACTIVE_FILTER) params.set("active", filters.active);
  if (filters.sort !== DEFAULT_ADMIN_SORT) params.set("sort", filters.sort);
  if (filters.page > 1) params.set("page", String(filters.page));

  return params;
}

/** The admin list URL for a set of filters. */
export function adminProductsHref(filters: AdminProductFilters): string {
  const query = adminProductFiltersToQuery(filters).toString();

  return query ? `${ADMIN_PRODUCTS_PATH}?${query}` : ADMIN_PRODUCTS_PATH;
}

/**
 * Apply a change to the current filters.
 *
 * Any change that alters the result set returns to page 1, for the reason
 * `withFilters` gives in `product-filters.ts`: page 3 of the unfiltered list is
 * not page 3 of a filtered one. Paging is the one patch allowed to set `page`.
 */
export function withAdminFilters(
  current: AdminProductFilters,
  patch: Partial<AdminProductFilters>,
): AdminProductFilters {
  const next = { ...current, ...patch };
  if (!("page" in patch)) next.page = 1;

  return next;
}

/** Shorthand for the URL a control changing one filter should point at. */
export function adminFilterHref(
  current: AdminProductFilters,
  patch: Partial<AdminProductFilters>,
): string {
  return adminProductsHref(withAdminFilters(current, patch));
}

/**
 * How many filters are narrowing the list.
 *
 * Sort and page are not counted: neither changes *which* products match, and
 * clearing the filters should not also reset the chosen order.
 */
export function adminActiveFilterCount(filters: AdminProductFilters): number {
  return (
    (filters.q ? 1 : 0) +
    (filters.category ? 1 : 0) +
    (filters.active !== DEFAULT_ACTIVE_FILTER ? 1 : 0)
  );
}

/** The filters with every narrowing cleared, keeping the chosen sort order. */
export function clearedAdminFilters(
  filters: AdminProductFilters,
): AdminProductFilters {
  return {
    q: "",
    category: undefined,
    active: DEFAULT_ACTIVE_FILTER,
    sort: filters.sort,
    page: 1,
  };
}
