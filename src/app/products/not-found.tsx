import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

/**
 * Rendered whenever `notFound()` is called under /products — an unknown
 * product slug, or a category that does not exist.
 */
export default function ProductsNotFound() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <p className="text-sm font-medium text-muted-foreground">404</p>
      <h1 className="text-2xl font-semibold tracking-tight">
        We couldn&apos;t find that page
      </h1>
      <p className="text-sm text-muted-foreground">
        The product or category you were looking for may have been renamed,
        removed, or is no longer on sale.
      </p>
      <Link href="/products" className={buttonVariants({ size: "lg" })}>
        Back to all products
      </Link>
    </div>
  );
}
