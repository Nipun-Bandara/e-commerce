/**
 * Pagination helpers shared by the catalogue routes.
 */

/**
 * Read a `?page=` search param.
 *
 * Search params are whatever the visitor typed: `?page=abc`, `?page=-3`,
 * `?page=1&page=2` all arrive here. Anything that is not a positive integer
 * falls back to page 1, so `NaN` never reaches a query's `skip`.
 */
export function parsePageParam(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return 1;

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) return 1;

  return parsed;
}

/**
 * Build the href for a page of a listing.
 *
 * Page 1 is the bare path so that `/products` and `/products?page=1` do not
 * become two URLs for the same content.
 */
export function pageHref(basePath: string, page: number): string {
  return page <= 1 ? basePath : `${basePath}?page=${page}`;
}
