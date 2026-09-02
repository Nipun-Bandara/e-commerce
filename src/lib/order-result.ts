/**
 * The shape an order mutation answers with.
 *
 * In `lib/` rather than beside the queries for the same reason as
 * `cart-result.ts`: both sides of the network boundary need it. The action in
 * `src/server/order-actions.ts` builds these, and the button that calls it
 * reads `status` to pick a toast. Keeping the contract in a module that cannot
 * import Prisma removes the chance of dragging the client into the browser
 * bundle through a type import.
 *
 * `warning` is the third status for the case that is neither: cancelling an
 * order that was already cancelled is not a failure — the order is in the state
 * that was asked for — but it is not a fresh success either, and saying so is
 * the honest answer.
 */

export type OrderResultStatus = "success" | "warning" | "error";

export type OrderResult = {
  status: OrderResultStatus;
  message: string;
};

export function orderSuccess(message: string): OrderResult {
  return { status: "success", message };
}

export function orderWarning(message: string): OrderResult {
  return { status: "warning", message };
}

export function orderError(message: string): OrderResult {
  return { status: "error", message };
}
