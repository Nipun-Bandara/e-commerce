import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { ORDERS_PATH } from "@/lib/order-status";

/**
 * Rendered whenever `notFound()` is called under /account/orders.
 *
 * The copy is deliberately vague about which of the two happened. An order
 * number that does not exist and one belonging to somebody else get the same
 * page and the same words, because a message that distinguished them would let
 * order numbers be probed one guess at a time.
 */
export default function OrderNotFound() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <p className="text-sm font-medium text-muted-foreground">404</p>
      <h1 className="text-2xl font-semibold tracking-tight">
        We couldn&apos;t find that order
      </h1>
      <p className="text-sm text-muted-foreground">
        That order number is not one of yours. Check it against the list of your
        orders — it is easy to mistype.
      </p>
      <Link href={ORDERS_PATH} className={buttonVariants({ size: "lg" })}>
        Back to my orders
      </Link>
    </div>
  );
}
