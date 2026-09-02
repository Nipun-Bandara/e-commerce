import * as z from "zod";

import { toFieldErrors as toFormFieldErrors } from "@/lib/form-errors";
import { MAX_SLUG_LENGTH, SLUG_PATTERN } from "@/lib/slug";

/**
 * What a valid product submission looks like, and the shape the admin form
 * gets back when it is not one.
 *
 * As with every other schema in `lib/`, these rules exist so the **server** can
 * decide. A Server Action is reachable by direct POST, so `required`, `min` and
 * `step` on the inputs are a courtesy to whoever is typing and nothing more —
 * every rule below is re-run in `admin-product-actions.ts` before a row is
 * written, and by an administrator no less: the guard is not "the form was
 * hard to bypass", it is that the bypass changes nothing.
 *
 * Dependency-free on purpose. The form imports `ProductFormState` to type its
 * own state, and a type crossing the client boundary must not drag a
 * `server-only` module with it.
 *
 * **Price is never a number here.** It arrives as the string the admin typed,
 * is checked as a string, and leaves as a string for Prisma to store in
 * `numeric(10, 2)`. There is no point in this file where a money value is a
 * JavaScript `number`, because that is the point at which 1250.10 stops being
 * 1250.10. See the rule in CLAUDE.md.
 */

/** Fits a product title without letting one break every table layout. */
const MAX_NAME_LENGTH = 120;

/** Long enough for a real description; a bound so the column is not a dumping ground. */
const MAX_DESCRIPTION_LENGTH = 4000;

/** SKUs are keys people type and read aloud, not prose. */
const MAX_SKU_LENGTH = 40;

/**
 * `numeric(10, 2)` holds ten significant digits with two after the point, so
 * the whole part cannot exceed eight digits. Anything larger is not an
 * expensive product, it is a value Postgres would reject with an overflow.
 */
const MAX_PRICE_DIGITS = 8;

/** Postgres `integer`. A stock figure at this end is a typo, not a warehouse. */
const MAX_STOCK = 1_000_000;

/** Matches the file router's `maxFileCount` — see `src/server/uploadthing.ts`. */
export const MAX_PRODUCT_IMAGES = 8;

/**
 * Digits, optionally followed by one or two decimal places.
 *
 * No sign, no exponent, no thousands separators, no leading `.`. Each of those
 * is something `Number()` would happily accept and `numeric` would store as
 * something other than what was typed.
 */
const PRICE_PATTERN = new RegExp(`^\\d{1,${MAX_PRICE_DIGITS}}(?:\\.\\d{1,2})?$`);

/** Digits only. `"3.0"`, `"1e2"` and `"-1"` are all not a count of things. */
const STOCK_PATTERN = /^\d{1,7}$/;

/**
 * A price, kept as an exact decimal string.
 *
 * "Greater than zero" is decided by looking for a non-zero digit rather than by
 * comparing against `0`, because the comparison would mean parsing the string
 * into a float first. `"0"`, `"0.0"` and `"0.00"` have no such digit; `"0.01"`
 * does.
 */
const price = z
  .string({ error: "Enter a price." })
  .trim()
  .min(1, { error: "Enter a price." })
  .regex(PRICE_PATTERN, {
    error: "Enter a price in rupees, e.g. 12500 or 12500.50.",
  })
  .refine((value) => /[1-9]/.test(value), {
    error: "The price must be more than zero.",
  });

const stock = z
  .string({ error: "Enter a stock count." })
  .trim()
  .min(1, { error: "Enter a stock count." })
  .regex(STOCK_PATTERN, {
    error: "Stock must be a whole number, 0 or more.",
  })
  .transform(Number)
  .refine((value) => value <= MAX_STOCK, {
    error: `Stock cannot be more than ${MAX_STOCK.toLocaleString("en")}.`,
  });

/**
 * The slug, which the form fills in from the name but the admin may overwrite.
 *
 * Not slugified here. Silently rewriting a typed value would mean the field
 * shows one thing and the URL becomes another, and the admin would find out
 * from a broken link. A slug that is not already in the canonical form is
 * rejected with the form it should have taken.
 */
const slug = z
  .string({ error: "Enter a URL slug." })
  .trim()
  .toLowerCase()
  .pipe(
    z
      .string()
      .min(1, { error: "Enter a URL slug." })
      .max(MAX_SLUG_LENGTH, { error: "That slug is too long." })
      .regex(SLUG_PATTERN, {
        error: "Use lowercase letters, numbers and single hyphens, e.g. blue-mug.",
      }),
  );

/**
 * One image URL.
 *
 * Only http(s) is accepted: a `data:` or `javascript:` URL in an `<img src>` is
 * not an image the storefront should be asked to render, and `next/image` would
 * refuse the first and the browser would ignore the second. Uploaded files
 * arrive as `https://<app>.ufs.sh/f/<key>`; seeded ones as picsum links.
 */
const imageUrl = z
  .url({ error: "That is not a valid image URL." })
  .refine((value) => value.startsWith("https://") || value.startsWith("http://"), {
    error: "An image URL must start with http:// or https://.",
  });

export const productSchema = z.object({
  name: z
    .string({ error: "Enter a product name." })
    .trim()
    .min(1, { error: "Enter a product name." })
    .max(MAX_NAME_LENGTH, { error: "That name is too long." }),

  slug,

  description: z
    .string({ error: "Enter a description." })
    .trim()
    .min(1, { error: "Enter a description." })
    .max(MAX_DESCRIPTION_LENGTH, { error: "That description is too long." }),

  price,
  stock,

  sku: z
    .string({ error: "Enter a SKU." })
    .trim()
    .min(1, { error: "Enter a SKU." })
    .max(MAX_SKU_LENGTH, { error: "That SKU is too long." }),

  // Existence is checked in the action, against the database. A schema can only
  // say "something was chosen"; only a query can say "and it is still there".
  categoryId: z
    .string({ error: "Choose a category." })
    .trim()
    .min(1, { error: "Choose a category." }),

  isActive: z.boolean(),

  /**
   * In display order, which is what `position` gets set from. The first entry
   * is the primary image — the one the product card uses as its thumbnail.
   */
  imageUrls: z
    .array(imageUrl)
    .max(MAX_PRODUCT_IMAGES, {
      error: `A product can have at most ${MAX_PRODUCT_IMAGES} images.`,
    }),
});

/** A product submission that has been through the rules above. */
export type ProductInput = z.infer<typeof productSchema>;

/** Every input the product form can complain about. */
export type ProductField = keyof ProductInput;

export type ProductFormState = {
  /** Shown above the form — a missing category, a dropped request. */
  formError: string | null;
  /** Shown under the input it belongs to. */
  fieldErrors: Partial<Record<ProductField, string>>;
};

export const emptyProductFormState: ProductFormState = {
  formError: null,
  fieldErrors: {},
};

/** Turn a Zod failure into the per-field messages the product form renders. */
export function toProductFieldErrors(
  error: z.ZodError<unknown>,
): Partial<Record<ProductField, string>> {
  return toFormFieldErrors<ProductField>(error);
}

/**
 * The one schema the inline stock control on the product list posts against.
 *
 * Separate from `productSchema` because it is a different submission: a
 * product id and a number, with none of the other nine fields present. Reusing
 * the big schema with eight `.optional()` calls would weaken the rules that
 * protect the full form.
 */
export const stockUpdateSchema = z.object({
  productId: z.string().trim().min(1),
  stock,
});
