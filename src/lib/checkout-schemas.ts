import * as z from "zod";

import { toFieldErrors as toFormFieldErrors } from "@/lib/form-errors";

/**
 * What a valid shipping address looks like, and the shape the checkout form
 * gets back when a submission is not one.
 *
 * As with the auth schemas, these rules exist so the **server** can decide. The
 * browser gets `required` and an `inputMode` on the inputs, which help someone
 * typing; they are not a check. A Server Action is reachable by direct POST, so
 * every rule below is re-run in `placeOrderAction` before an order is written,
 * and `createOrder` will only accept the parsed output of this schema.
 *
 * Dependency-free on purpose — the checkout form imports `CheckoutFormState` to
 * type its own state, and a type crossing the client boundary must not drag a
 * `server-only` module with it.
 */

/**
 * A Sri Lankan phone number, in either of the two forms people actually write:
 * `0712345678` locally, `+94712345678` internationally.
 *
 * Nine digits follow the prefix, and the first of them is never `0` — every
 * Sri Lankan mobile (`7X`) and area code (`11`, `21`, … `91`) starts 1–9, so a
 * leading zero there is a mistyped local number rather than a valid one.
 */
const SRI_LANKA_PHONE = /^(?:\+94|0)[1-9]\d{8}$/;

/** Sri Lanka's postal codes are five digits, with no letters and no spaces. */
const POSTAL_CODE = /^\d{5}$/;

/** Long enough for any real address line; short enough to fit a delivery label. */
const MAX_LINE_LENGTH = 120;

/**
 * Separators are stripped before the pattern runs, not rejected by it.
 * `+94 71 234 5678` and `071-234-5678` are the same number written by two
 * people, and refusing one of them teaches nothing.
 */
function withoutSeparators(value: string): string {
  return value.replace(/[\s()-]/g, "");
}

function requiredText(missing: string, tooLong: string) {
  return z
    .string({ error: missing })
    .trim()
    .min(1, { error: missing })
    .max(MAX_LINE_LENGTH, { error: tooLong });
}

export const shippingAddressSchema = z.object({
  fullName: requiredText(
    "Enter the recipient's full name.",
    "That name is too long.",
  ),

  phone: z
    .string({ error: "Enter a phone number." })
    .trim()
    .min(1, { error: "Enter a phone number." })
    .transform(withoutSeparators)
    .pipe(
      z.string().regex(SRI_LANKA_PHONE, {
        error: "Enter a Sri Lankan phone number, e.g. 0712345678 or +94712345678.",
      }),
    ),

  line1: requiredText(
    "Enter the street address.",
    "That address line is too long.",
  ),

  // Optional, and stored as NULL rather than "": the column is nullable, and an
  // empty string would render as a blank line in the delivery address.
  line2: z
    .string()
    .trim()
    .max(MAX_LINE_LENGTH, { error: "That address line is too long." })
    .transform((value) => (value === "" ? null : value)),

  city: requiredText("Enter the city.", "That city name is too long."),

  postalCode: z
    .string({ error: "Enter a postal code." })
    .trim()
    .regex(POSTAL_CODE, { error: "A postal code is 5 digits, e.g. 10100." }),
});

/** A shipping address that has been through the rules above. */
export type ShippingAddressInput = z.infer<typeof shippingAddressSchema>;

/** Every input the checkout form can complain about. */
export type CheckoutField = keyof ShippingAddressInput;

export type CheckoutFormState = {
  /** Shown above the form — a sold-out line, an emptied cart, a dropped request. */
  formError: string | null;
  /** Shown under the input it belongs to. */
  fieldErrors: Partial<Record<CheckoutField, string>>;
};

export const emptyCheckoutFormState: CheckoutFormState = {
  formError: null,
  fieldErrors: {},
};

/** Turn a Zod failure into the per-field messages the checkout form renders. */
export function toCheckoutFieldErrors(
  error: z.ZodError<unknown>,
): Partial<Record<CheckoutField, string>> {
  return toFormFieldErrors<CheckoutField>(error);
}
