import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { ADMIN_ORDERS_PATH } from "@/lib/admin-order-filters";
import { cn } from "@/lib/utils";

/**
 * Rendered whenever `notFound()` is called under /admin/orders.
 *
 * Plain about what happened, unlike the customer's version of this page. That
 * one is deliberately vague because distinguishing "does not exist" from
 * "belongs to somebody else" would let order numbers be probed one guess at a
 * time. There is no such distinction here — an admin may read every order, so
 * the only way to land on this page is a number that genuinely does not exist,
 * and saying so is the useful answer.
 */
export default function AdminOrderNotFound() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <p className="text-sm font-medium text-muted-foreground">404</p>
      <h1 className="text-2xl font-semibold tracking-tight">
        No order with that number
      </h1>
      <p className="text-sm text-muted-foreground">
        Nothing in the shop has that order number. It is easy to mistype — the
        alphabet leaves out I and O precisely because they are misread as 1 and
        0.
      </p>
      <Link
        href={ADMIN_ORDERS_PATH}
        className={cn(buttonVariants({ size: "lg" }))}
      >
        Back to orders
      </Link>
    </div>
  );
}
