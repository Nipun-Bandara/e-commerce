import * as z from "zod";

import { toFieldErrors as toFormFieldErrors } from "@/lib/form-errors";
import { MAX_SLUG_LENGTH, SLUG_PATTERN } from "@/lib/slug";

/**
 * What a valid category submission looks like, and the shape the category form
 * gets back when it is not one.
 *
 * Same reasoning as `product-schemas.ts`: the rules live here so the server can
 * re-run them on every post, and the module stays dependency-free so the form
 * can import `CategoryFormState` without dragging server code across the client
 * boundary.
 */

const MAX_NAME_LENGTH = 80;
const MAX_DESCRIPTION_LENGTH = 500;

export const categorySchema = z.object({
  name: z
    .string({ error: "Enter a category name." })
    .trim()
    .min(1, { error: "Enter a category name." })
    .max(MAX_NAME_LENGTH, { error: "That name is too long." }),

  // Not slugified for the admin — see the note on the product slug. A typed
  // value that is not already canonical is rejected rather than rewritten.
  slug: z
    .string({ error: "Enter a URL slug." })
    .trim()
    .toLowerCase()
    .pipe(
      z
        .string()
        .min(1, { error: "Enter a URL slug." })
        .max(MAX_SLUG_LENGTH, { error: "That slug is too long." })
        .regex(SLUG_PATTERN, {
          error:
            "Use lowercase letters, numbers and single hyphens, e.g. home-kitchen.",
        }),
    ),

  // Optional, and stored as NULL rather than "": the column is nullable, and an
  // empty string would render as a blank paragraph on the category page.
  description: z
    .string()
    .trim()
    .max(MAX_DESCRIPTION_LENGTH, { error: "That description is too long." })
    .transform((value) => (value === "" ? null : value)),
});

export type CategoryInput = z.infer<typeof categorySchema>;

export type CategoryField = keyof CategoryInput;

export type CategoryFormState = {
  formError: string | null;
  fieldErrors: Partial<Record<CategoryField, string>>;
};

export const emptyCategoryFormState: CategoryFormState = {
  formError: null,
  fieldErrors: {},
};

export function toCategoryFieldErrors(
  error: z.ZodError<unknown>,
): Partial<Record<CategoryField, string>> {
  return toFormFieldErrors<CategoryField>(error);
}
