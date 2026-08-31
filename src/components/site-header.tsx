import { Suspense } from "react";
import Link from "next/link";
import { ShoppingBagIcon } from "lucide-react";

import CartCountBadge from "@/components/cart-count-badge";
import HeaderAuth from "@/components/header-auth";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The site-wide header, mounted in the root layout so the cart is reachable —
 * and its count visible — from every page, alongside who is signed in.
 */
export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="text-base font-semibold tracking-tight">
          ecom
        </Link>

        <nav className="flex items-center gap-4 text-sm text-muted-foreground">
          <Link href="/products" className="hover:text-foreground">
            Products
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <Link
            href="/cart"
            // `cn` is not optional: it is what drops the `border-transparent` in
            // the button base that would otherwise beat a later border utility.
            className={cn(buttonVariants({ variant: "ghost", size: "lg" }))}
          >
            <ShoppingBagIcon aria-hidden />
            <span className="hidden sm:inline">Cart</span>
            {/* No fallback: an empty badge is the same as no badge, and a
                placeholder that pops into a number reads as a glitch. */}
            <Suspense fallback={null}>
              <CartCountBadge />
            </Suspense>
          </Link>

          {/* Same reasoning as the badge: nothing beats something that flickers
              from "Login" into a name. */}
          <Suspense fallback={null}>
            <HeaderAuth />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
