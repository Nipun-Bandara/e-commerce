import Link from "next/link";
import { ShieldXIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * What `forbidden()` renders, with a 403 status.
 *
 * Deliberately not a redirect to login. The visitor *is* signed in; sending
 * them to a login form would tell them the wrong thing, and signing in again
 * would land them right back here.
 *
 * `forbidden()` is still experimental in Next 16, so `authInterrupts` is
 * switched on in next.config.ts. Without that flag this file is never reached.
 */
export default function Forbidden() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 px-4 py-24 text-center sm:px-6">
      <ShieldXIcon className="size-8 text-muted-foreground" aria-hidden />

      <h1 className="text-3xl font-semibold tracking-tight">
        You cannot open this page
      </h1>

      <p className="max-w-md text-sm text-muted-foreground">
        Your account does not have access to this part of the store. If you
        think that is wrong, ask an administrator to check your permissions.
      </p>

      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <Link href="/" className={cn(buttonVariants({ size: "lg" }))}>
          Back to the store
        </Link>
        <Link
          href="/account"
          className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
        >
          My account
        </Link>
      </div>
    </div>
  );
}
