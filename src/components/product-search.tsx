"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SearchIcon, XIcon } from "lucide-react";

import { filterHref, type ProductFilters } from "@/lib/product-filters";

/**
 * Search box for the catalogue header.
 *
 * The input holds local state so typing stays responsive, but the URL is still
 * what the results are read from — this component's only job is to move one
 * into the other, 300ms after the visitor stops typing.
 */

/** Long enough to skip the letters of a word, short enough to feel live. */
const DEBOUNCE_MS = 300;

export default function ProductSearch({
  filters,
}: {
  filters: ProductFilters;
}) {
  const router = useRouter();
  const [value, setValue] = useState(filters.q);

  /**
   * The last `q` this component put in the URL.
   *
   * Without it the sync below fights the debounce: our own navigation lands a
   * few hundred milliseconds after it was queued, and would reset the box to
   * whatever was typed back then, deleting anything typed since.
   */
  const pushed = useRef(filters.q);

  // The URL is the source of truth, so `q` can change without us: a back or
  // forward navigation, a chip being cleared, a pasted link. Follow it.
  useEffect(() => {
    if (filters.q === pushed.current) return;
    pushed.current = filters.q;
    setValue(filters.q);
  }, [filters.q]);

  useEffect(() => {
    if (value === filters.q) return;

    const timer = setTimeout(() => {
      pushed.current = value;
      // `replace`, not `push`: one history entry per search, not one per
      // keystroke, so the back button leaves the catalogue instead of
      // retyping the query backwards.
      router.replace(filterHref(filters, { q: value }), { scroll: false });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [value, filters, router]);

  /** Skip the debounce for the deliberate actions: Enter, and the clear button. */
  function commit(next: string) {
    setValue(next);
    pushed.current = next;
    router.replace(filterHref(filters, { q: next }), { scroll: false });
  }

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        commit(value);
      }}
      className="relative w-full sm:max-w-sm"
    >
      <SearchIcon
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <input
        type="search"
        name="q"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search products"
        aria-label="Search products"
        className="h-9 w-full rounded-lg border border-border bg-background pr-9 pl-9 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => commit("")}
          aria-label="Clear search"
          className="absolute top-1/2 right-1.5 grid size-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <XIcon aria-hidden className="size-4" />
        </button>
      )}
    </form>
  );
}
