"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { filterHref, type ProductFilters } from "@/lib/product-filters";

/**
 * The `?minPrice=` / `?maxPrice=` bounds, as two number inputs.
 *
 * Applied on submit rather than on every keystroke: a half-typed `1` in the
 * "min" box is a real number, and debouncing it would flash the results
 * through every prefix of what is being typed.
 *
 * The bounds arrive as decimal strings straight from the `Decimal` column, so
 * no price makes a float round-trip on its way to the `min`/`max` attributes.
 */
export default function PriceRangeFilter({
  filters,
  lowest,
  highest,
}: {
  filters: ProductFilters;
  /** Cheapest and dearest product, or `null` for an empty catalogue. */
  lowest: string | null;
  highest: string | null;
}) {
  const router = useRouter();
  const [min, setMin] = useState(filters.minPrice?.toString() ?? "");
  const [max, setMax] = useState(filters.maxPrice?.toString() ?? "");

  function sanitise(raw: string): number | undefined {
    const trimmed = raw.trim();
    if (!trimmed) return undefined;

    const parsed = Number(trimmed);

    return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
  }

  function apply() {
    let nextMin = sanitise(min);
    let nextMax = sanitise(max);

    // Typing the bounds the wrong way round is a slip, not junk — unlike a
    // hand-edited URL, where the parser drops an inverted range outright.
    // Swapping gives the range the visitor plainly meant.
    if (nextMin !== undefined && nextMax !== undefined && nextMin > nextMax) {
      [nextMin, nextMax] = [nextMax, nextMin];
    }

    setMin(nextMin?.toString() ?? "");
    setMax(nextMax?.toString() ?? "");
    router.push(filterHref(filters, { minPrice: nextMin, maxPrice: nextMax }), {
      scroll: false,
    });
  }

  const field =
    "h-8 w-full rounded-lg border border-border bg-background px-2 text-sm tabular-nums outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        apply();
      }}
      className="flex flex-col gap-2"
    >
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <label htmlFor="min-price" className="sr-only">
            Minimum price
          </label>
          <input
            id="min-price"
            type="number"
            inputMode="decimal"
            min={lowest ?? 0}
            max={highest ?? undefined}
            step="0.01"
            value={min}
            onChange={(event) => setMin(event.target.value)}
            placeholder={lowest ?? "Min"}
            className={field}
          />
        </div>
        <span aria-hidden className="text-sm text-muted-foreground">
          –
        </span>
        <div className="flex-1">
          <label htmlFor="max-price" className="sr-only">
            Maximum price
          </label>
          <input
            id="max-price"
            type="number"
            inputMode="decimal"
            min={lowest ?? 0}
            max={highest ?? undefined}
            step="0.01"
            value={max}
            onChange={(event) => setMax(event.target.value)}
            placeholder={highest ?? "Max"}
            className={field}
          />
        </div>
      </div>

      <Button type="submit" variant="outline" size="sm" className="self-start">
        Apply price
      </Button>
    </form>
  );
}
