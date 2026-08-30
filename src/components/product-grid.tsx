import type { ReactNode } from "react";

import ProductCard from "@/components/product-card";
import type { ProductListItem } from "@/server/products";

/**
 * The catalogue grid, plus the empty state for when a filter matches nothing.
 * Shared by /products and the category pages so both stay in step.
 */
export default function ProductGrid({
  products,
  emptyMessage = "No products to show here yet.",
  emptyAction,
}: {
  products: ProductListItem[];
  emptyMessage?: string;
  /** A way out of the empty state, e.g. a "clear all filters" link. */
  emptyAction?: ReactNode;
}) {
  if (products.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border px-6 py-16 text-center">
        <p className="text-sm font-medium">Nothing here</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          {emptyMessage}
        </p>
        {emptyAction && (
          <div className="mt-4 flex justify-center">{emptyAction}</div>
        )}
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((product) => (
        <li key={product.id}>
          <ProductCard product={product} />
        </li>
      ))}
    </ul>
  );
}
