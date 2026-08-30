import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { pageHref } from "@/lib/pagination";
import { cn } from "@/lib/utils";

/**
 * Previous/next controls driven entirely by the `?page=` search param, so
 * paging is plain navigation — no client state, and every page is linkable.
 *
 * At either end the control renders as a disabled `<span>` rather than a link:
 * a disabled-looking `<a href>` is still clickable and still followed by
 * crawlers.
 */
export default function Pagination({
  page,
  pageCount,
  basePath,
}: {
  page: number;
  pageCount: number;
  /** Listing path without a query string, e.g. `/products`. */
  basePath: string;
}) {
  if (pageCount <= 1) return null;

  const control = cn(buttonVariants({ variant: "outline", size: "lg" }), "gap-1.5");
  const disabled = cn(control, "pointer-events-none opacity-50");

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between gap-4 border-t border-border pt-6"
    >
      {page > 1 ? (
        <Link href={pageHref(basePath, page - 1)} rel="prev" className={control}>
          <ChevronLeftIcon aria-hidden />
          Previous
        </Link>
      ) : (
        <span className={disabled} aria-disabled>
          <ChevronLeftIcon aria-hidden />
          Previous
        </span>
      )}

      <p aria-live="polite" className="text-sm text-muted-foreground tabular-nums">
        Page {page} of {pageCount}
      </p>

      {page < pageCount ? (
        <Link href={pageHref(basePath, page + 1)} rel="next" className={control}>
          Next
          <ChevronRightIcon aria-hidden />
        </Link>
      ) : (
        <span className={disabled} aria-disabled>
          Next
          <ChevronRightIcon aria-hidden />
        </span>
      )}
    </nav>
  );
}
