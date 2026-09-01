import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import { loginPath } from "@/lib/callback-url";
import { cn } from "@/lib/utils";
import { getCurrentUser } from "@/server/auth";

/** Where checkout starts, and where a visitor comes back to after signing in. */
const CHECKOUT_PATH = "/checkout";

/**
 * The way out of the cart.
 *
 * Checkout needs an account, so a guest is sent to sign in with `/checkout` as
 * the callback — the round trip is what keeps their cart, which is merged into
 * the account the moment the session is issued (see `mergeGuestCart`). Sending
 * them to /checkout to be bounced would work too, and would flash a login page
 * they were not expecting; the link says where it goes.
 *
 * `blocked` covers the two states where there is nothing to check out: an empty
 * cart, and a cart with rows the catalogue can no longer honour. A link cannot
 * be disabled, so those render a real disabled button instead.
 */
export default async function CheckoutButton({
  blocked,
  blockedReason,
}: {
  blocked: boolean;
  /** Why the button is dead, shown under it. Nothing when it is not. */
  blockedReason?: string;
}) {
  if (blocked) {
    return (
      <div className="flex flex-col gap-2">
        <Button size="lg" className="w-full" disabled>
          Proceed to checkout
        </Button>
        {blockedReason ? (
          <p className="text-center text-xs text-muted-foreground">
            {blockedReason}
          </p>
        ) : null}
      </div>
    );
  }

  const user = await getCurrentUser();

  return (
    <Link
      href={user ? CHECKOUT_PATH : loginPath(CHECKOUT_PATH)}
      className={cn(buttonVariants({ size: "lg" }), "w-full")}
    >
      Proceed to checkout
    </Link>
  );
}
