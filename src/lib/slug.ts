/**
 * Turning a name into a URL slug, and deciding whether a typed one is usable.
 *
 * Both the browser and the server need this: the admin forms slugify as you
 * type so the field fills itself in, and the Zod schemas re-check the result
 * because a form post arrives with whatever the sender chose. Same function
 * both sides, so what the admin previewed is what gets stored.
 */

/**
 * Long enough for a real product name, short enough to stay a readable URL.
 * The column is unbounded `text`, so this is a product decision, not a limit
 * the database imposes.
 */
export const MAX_SLUG_LENGTH = 96;

/**
 * Lowercase words joined by single hyphens, with no hyphen at either end.
 *
 * Deliberately narrower than "what a URL allows": underscores, dots and
 * percent-escapes are all legal in a path segment and all produce slugs that
 * are awkward to type, share and search for.
 */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * A slug for a name.
 *
 * Accents are decomposed and their marks dropped rather than replaced with
 * hyphens, so "Rátio" becomes `ratio` and not `r-tio`. Everything else outside
 * `[a-z0-9]` collapses to a single hyphen.
 *
 * Returns `""` for a name with nothing slug-able in it — an all-emoji name, or
 * one written entirely in a script this transliteration cannot reach. The
 * caller decides what to do about that; the schema treats it as "enter a slug".
 */
export function slugify(value: string): string {
  return (
    value
      .normalize("NFKD")
      // Combining marks left behind by the decomposition above.
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, MAX_SLUG_LENGTH)
      // The slice can land mid-hyphen and leave a trailing one.
      .replace(/-+$/, "")
  );
}
