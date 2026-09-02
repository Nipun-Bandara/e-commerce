import type { TopProduct } from "@/server/admin-orders";

/**
 * The five products that have sold the most units.
 *
 * The figures are a `GROUP BY` over `OrderItem.productName` — the snapshot,
 * ungrouped by any live product row. Two things follow, and the hint under the
 * heading says so rather than leaving them to be discovered:
 *
 *  - A deleted product still counts. Its `OrderItem.productId` went NULL, but
 *    the name and the quantity are still there, and pretending those units were
 *    never sold would understate the shop.
 *  - Every order counts, including ones not yet paid for and ones that were
 *    cancelled. This is a count of what has been *ordered*, which is the number
 *    that can be checked against `OrderItem` by hand; revenue, above, is the
 *    figure that excludes them.
 *
 * A bar per row rather than a chart: the widths are a `<div>` with a percentage,
 * the number beside each is the real value, and there is no library, no client
 * bundle and nothing to hydrate.
 */
export default function TopProductsCard({
  products,
}: {
  products: TopProduct[];
}) {
  // The leader sets the scale, so the top bar is always full width and the rest
  // read as a proportion of it. Guarded against zero: a table full of
  // zero-quantity lines should not divide by nothing.
  const most = Math.max(1, ...products.map((product) => product.quantity));

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-background p-5">
      <header className="flex flex-col gap-1">
        <h2 className="text-sm font-medium">Top products</h2>
        <p className="text-xs text-muted-foreground">
          Units sold across every order, including pending and cancelled ones.
        </p>
      </header>

      {products.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Nothing has been ordered yet.
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {products.map((product) => (
            <li key={product.productName} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-4">
                <span className="min-w-0 truncate text-sm">
                  {product.productName}
                </span>
                <span className="shrink-0 text-sm font-medium tabular-nums">
                  {product.quantity.toLocaleString("en")}
                </span>
              </div>

              {/* Decoration only: the number above it is the accessible value,
                  so the bar is hidden from screen readers rather than announced
                  as an unlabelled graphic. */}
              <div
                aria-hidden
                className="h-1.5 overflow-hidden rounded-full bg-muted"
              >
                <div
                  className="h-full rounded-full bg-foreground/70"
                  style={{ width: `${(product.quantity / most) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
