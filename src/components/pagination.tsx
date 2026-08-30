import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Previous/next controls driven entirely by the `?page=` search param, so
 * paging is plain navigation — no client state, and every page is linkable.
 *
 * At either end the control renders as a disabled `<span>` rather than a link:
 * a disabled-looking `<a href>` is still clickable and still followed by
 * crawlers.
 *
 * The href is built by the caller rather than from a base path, because the
 * filtered catalogue has to carry `?q=`, `?category=` and the rest through to
 * the next page. Losing them would make paging silently reset the results.
 */
export default function Pagination({
  page,
  pageCount,
  hrefForPage,
}: {
  page: number;
  pageCount: number;
  hrefForPage: (page: number) => string;
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
        <Link href={hrefForPage(page - 1)} rel="prev" className={control}>
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
        <Link href={hrefForPage(page + 1)} rel="next" className={control}>
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
