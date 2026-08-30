import { parsePageParam } from "@/lib/pagination";

/**
 * Catalogue filter state: parsed from the query string, and serialised back to
 * it.
 *
 * The URL is the only source of truth for search, filtering, sorting and
 * paging. That is what makes a filtered view survive a refresh, work in a
 * second tab, and be shareable by copying the address bar.
 *
 * Nothing here imports Prisma or `next/*`. The parser runs on the server in
 * `page.tsx`; the serialiser runs in Client Components that need to build the
 * next URL, so this module has to be safe in both bundles.
 */

/** The sort orders offered, in the order the dropdown lists them. */
export const PRODUCT_SORTS = [
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "name-asc", label: "Name: A to Z" },
] as const;

export type ProductSort = (typeof PRODUCT_SORTS)[number]["value"];

export const DEFAULT_SORT: ProductSort = "newest";

/** The listing these filters describe. */
export const PRODUCTS_PATH = "/products";

/**
 * Longest `?q=` acted on. The value ends up inside a `LIKE` pattern, so it is
 * bounded rather than passed through at whatever length a visitor supplies.
 */
const MAX_QUERY_LENGTH = 100;

/** Ceiling for a price bound, so `?maxPrice=1e30` reads as junk, not a filter. */
const MAX_PRICE = 100_000_000;

/**
 * Absent filters are `undefined` rather than `null` so this object can be
 * spread straight into `getProducts`, whose options are optional.
 */
export type ProductFilters = {
  /** Free text; `""` when there is no search. */
  q: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  inStockOnly: boolean;
  sort: ProductSort;
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
 * A price bound, or `undefined` for anything that is not one — `abc`, `-5`,
 * `NaN`, `Infinity`, absurdly large numbers. A bad bound is dropped rather
 * than clamped: silently turning `minPrice=abc` into `0` would look like a
 * filter that is doing nothing.
 */
function parsePrice(value: string | string[] | undefined): number | undefined {
  const raw = firstValue(value);
  if (raw === undefined) return undefined;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > MAX_PRICE) {
    return undefined;
  }

  return parsed;
}

/**
 * Read every filter out of the query string, defensively.
 *
 * Search params are whatever the visitor typed or a stale link carried, so
 * every field falls back to its default instead of throwing: `?sort=xyz` sorts
 * by newest, `?page=-5` is page 1, `?minPrice=abc` is no lower bound.
 */
export function parseProductFilters(params: RawSearchParams): ProductFilters {
  const sort = firstValue(params.sort);

  let minPrice = parsePrice(params.minPrice);
  let maxPrice = parsePrice(params.maxPrice);

  // An inverted range is a contradiction rather than a narrow one. Dropping
  // both bounds shows the whole catalogue; keeping them would show an empty
  // grid with no hint that the URL was at fault.
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    minPrice = undefined;
    maxPrice = undefined;
  }

  return {
    q: firstValue(params.q)?.slice(0, MAX_QUERY_LENGTH) ?? "",
    category: firstValue(params.category),
    minPrice,
    maxPrice,
    inStockOnly: firstValue(params.inStock) === "true",
    sort: PRODUCT_SORTS.some((option) => option.value === sort)
      ? (sort as ProductSort)
      : DEFAULT_SORT,
    page: parsePageParam(params.page),
  };
}

/**
 * The query string for a set of filters.
 *
 * Defaults are omitted, so the unfiltered catalogue is `/products` rather than
 * `/products?q=&sort=newest&page=1` — one URL per view, and a "clear all" link
 * that visibly returns to a clean address.
 */
export function productFiltersToQuery(filters: ProductFilters): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.q) params.set("q", filters.q);
  if (filters.category) params.set("category", filters.category);
  if (filters.minPrice !== undefined) {
    params.set("minPrice", String(filters.minPrice));
  }
  if (filters.maxPrice !== undefined) {
    params.set("maxPrice", String(filters.maxPrice));
  }
  if (filters.inStockOnly) params.set("inStock", "true");
  if (filters.sort !== DEFAULT_SORT) params.set("sort", filters.sort);
  if (filters.page > 1) params.set("page", String(filters.page));

  return params;
}

/** The catalogue URL for a set of filters. */
export function productsHref(
  filters: ProductFilters,
  basePath: string = PRODUCTS_PATH,
): string {
  const query = productFiltersToQuery(filters).toString();

  return query ? `${basePath}?${query}` : basePath;
}

/**
 * Apply a change to the current filters.
 *
 * Any change that alters the result set returns to page 1: page 3 of the
 * unfiltered catalogue is not page 3 of a filtered one, and landing on an
 * empty page after ticking a box reads as a broken filter. Paging itself is
 * the exception — it is the one patch allowed to set `page`.
 */
export function withFilters(
  current: ProductFilters,
  patch: Partial<ProductFilters>,
): ProductFilters {
  const next = { ...current, ...patch };
  if (!("page" in patch)) next.page = 1;

  return next;
}

/** Shorthand for the URL that a control changing one filter should point at. */
export function filterHref(
  current: ProductFilters,
  patch: Partial<ProductFilters>,
  basePath: string = PRODUCTS_PATH,
): string {
  return productsHref(withFilters(current, patch), basePath);
}

/**
 * How many filters are narrowing the results.
 *
 * Sort and page are not counted: neither changes *which* products match, and
 * "clear all filters" leaves the chosen sort order alone.
 */
export function activeFilterCount(filters: ProductFilters): number {
  return (
    (filters.q ? 1 : 0) +
    (filters.category ? 1 : 0) +
    (filters.minPrice !== undefined ? 1 : 0) +
    (filters.maxPrice !== undefined ? 1 : 0) +
    (filters.inStockOnly ? 1 : 0)
  );
}

export function hasActiveFilters(filters: ProductFilters): boolean {
  return activeFilterCount(filters) > 0;
}

/** The filters with every narrowing cleared, keeping the chosen sort order. */
export function clearedFilters(filters: ProductFilters): ProductFilters {
  return {
    q: "",
    category: undefined,
    minPrice: undefined,
    maxPrice: undefined,
    inStockOnly: false,
    sort: filters.sort,
    page: 1,
  };
}
