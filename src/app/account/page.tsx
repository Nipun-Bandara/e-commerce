import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRightIcon, PackageIcon } from "lucide-react";

import { ORDERS_PATH } from "@/lib/order-status";
import { requireAuth } from "@/server/auth";
import { countUserOrders } from "@/server/orders";

export const metadata: Metadata = {
  title: "My account",
  description: "Your account details.",
};

export default async function AccountPage() {
  // Not a formality because the proxy already redirected: the proxy reads a
  // cookie, this reads the session the page will actually render from, and it
  // is the one that runs if the matcher ever stops covering this route.
  const user = await requireAuth("/account");
  const orderCount = await countUserOrders();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-12 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">My account</h1>
        <p className="text-sm text-muted-foreground">
          Your details as we have them.
        </p>
      </header>

      <dl className="divide-y divide-border rounded-xl border border-border">
        <div className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-baseline sm:gap-6">
          <dt className="w-32 shrink-0 text-sm text-muted-foreground">Name</dt>
          <dd className="text-sm font-medium">{user.name}</dd>
        </div>

        <div className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-baseline sm:gap-6">
          <dt className="w-32 shrink-0 text-sm text-muted-foreground">Email</dt>
          <dd className="text-sm font-medium">{user.email}</dd>
        </div>
      </dl>

      <p className="text-sm text-muted-foreground">
        Editing these is not built yet.
      </p>

      <Link
        href={ORDERS_PATH}
        className="flex items-center gap-4 rounded-xl border border-border px-5 py-4 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
      >
        <PackageIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-sm font-medium">Order history</span>
          <span className="text-sm text-muted-foreground">
            {orderCount === 0
              ? "You have not placed any orders yet"
              : `${orderCount} ${orderCount === 1 ? "order" : "orders"} placed`}
          </span>
        </div>

        <ChevronRightIcon
          aria-hidden
          className="size-4 shrink-0 text-muted-foreground"
        />
      </Link>
    </div>
  );
}
