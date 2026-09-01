"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  shippingAddressSchema,
  toCheckoutFieldErrors,
  type CheckoutFormState,
} from "@/lib/checkout-schemas";
import { requireAuth } from "@/server/auth";
import { createOrder } from "@/server/orders";

/**
 * The one thing checkout lets a browser invoke.
 *
 * Split from `orders.ts` for the reason `cart-actions.ts` gives: `"use server"`
 * turns every export in a file into a public HTTP endpoint, and `createOrder`
 * and `getOrderByNumberForUser` have no business being callable from outside.
 * This file is the complete, reviewable list of what the client can reach.
 *
 * It does three things, in this order:
 *
 *  1. **Authenticate.** The proxy redirects unauthenticated visitors away from
 *     /checkout, but a Server Action is a direct POST that the proxy never
 *     sees. `requireAuth` is the gate that actually holds, and the user id it
 *     returns — never one from the form — is whose cart gets ordered.
 *  2. **Validate on the server.** The form's `required` attributes are a
 *     courtesy to someone typing. Every rule is re-run here.
 *  3. **Hand off to the transaction.** Nothing priced or counted is forwarded:
 *     `createOrder` gets an address and a flag, and reads the rest itself.
 */

export async function placeOrderAction(
  formData: FormData,
): Promise<CheckoutFormState> {
  const user = await requireAuth("/checkout");

  const parsed = shippingAddressSchema.safeParse({
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
    line1: formData.get("line1"),
    // The one optional field. An untouched input still posts `""`, and a field
    // stripped from the request posts nothing at all — both mean "no line 2".
    line2: formData.get("line2") ?? "",
    city: formData.get("city"),
    postalCode: formData.get("postalCode"),
  });

  if (!parsed.success) {
    return { formError: null, fieldErrors: toCheckoutFieldErrors(parsed.error) };
  }

  const result = await createOrder({
    userId: user.id,
    shipping: parsed.data,
    // A checkbox posts `"on"` when ticked and is absent when it is not.
    saveAddress: formData.get("saveAddress") === "on",
  });

  if (result.status === "failed") {
    return { formError: result.message, fieldErrors: {} };
  }

  // The cart is empty now, and the badge that says otherwise renders on every
  // route — so the whole layout, not just this page.
  revalidatePath("/", "layout");

  // Feature 6 replaces this line with a hand-off to PayHere. The order is
  // already `PENDING` with its stock committed, so the gateway only has to
  // report back and move it to `PAID`; nothing above changes.
  redirect(`/checkout/success/${result.orderNumber}`);
}
