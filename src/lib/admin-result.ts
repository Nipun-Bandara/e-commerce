/**
 * The shape every admin mutation that is *not* a form submission answers with.
 *
 * Deleting a product, archiving it, changing a stock number: each is one button
 * with one sentence of feedback, so there is nothing for a field-level error to
 * attach to. The forms use `ProductFormState` / `CategoryFormState` instead,
 * because those need to point at an input.
 *
 * It lives in `lib/` rather than beside the queries because both sides of the
 * network boundary need it — `src/server/admin-*.ts` builds these, and the
 * client components that call the actions read `status` to pick a toast. Same
 * reasoning as `cart-result.ts`, and the `warning` status earns its place for
 * the same reason: "deleting it would have broken an order, so it was archived
 * instead" is neither a clean success nor a failure. The write happened, and
 * the admin still needs to be told it was not the write they asked for.
 */

export type AdminResultStatus = "success" | "warning" | "error";

export type AdminResult = {
  status: AdminResultStatus;
  message: string;
};

export function adminSuccess(message: string): AdminResult {
  return { status: "success", message };
}

export function adminWarning(message: string): AdminResult {
  return { status: "warning", message };
}

export function adminError(message: string): AdminResult {
  return { status: "error", message };
}

/** What a client component says when the action never came back at all. */
export const ADMIN_REQUEST_FAILED = "Something went wrong. Please try again.";
