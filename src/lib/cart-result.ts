/**
 * The shape every cart mutation answers with.
 *
 * It lives in `lib/` rather than beside the queries because both sides of the
 * network boundary need it: `src/server/cart.ts` builds these, and the client
 * components that call the actions read `status` to pick a toast. A type
 * imported from a `server-only` module is erased at build time and so would
 * work too, but one accidental value import there would drag the Prisma client
 * into the browser bundle. Keeping the contract in a pure module removes that
 * foot-gun entirely.
 *
 * `warning` is the third status on purpose. "Added, but only 3 were left" is
 * neither a clean success nor a failure: the write happened, and the visitor
 * still needs to be told what changed.
 */

export type CartResultStatus = "success" | "warning" | "error";

export type CartResult = {
  status: CartResultStatus;
  message: string;
};

export function cartSuccess(message: string): CartResult {
  return { status: "success", message };
}

export function cartWarning(message: string): CartResult {
  return { status: "warning", message };
}

export function cartError(message: string): CartResult {
  return { status: "error", message };
}
