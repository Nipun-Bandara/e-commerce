import Image from "next/image";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/money";
import type { ProductListItem } from "@/server/products";

/**
 * Grid tile for one product. The whole tile is the link to the detail page.
 *
 * `price` arrives as a Decimal and is formatted here, on the server — a Decimal
 * handed straight to JSX would not survive serialisation.
 */
export default function ProductCard({ product }: { product: ProductListItem }) {
  const [image] = product.images;
  const isOutOfStock = product.stock === 0;

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group flex flex-col gap-3 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <div className="relative aspect-square overflow-hidden rounded-xl border border-border bg-muted">
        {image ? (
          <Image
            src={image.url}
            alt={image.alt ?? product.name}
            fill
            // Mirrors the grid below: 4 up on xl, 3 on lg, 2 on sm, 1 below.
            sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No image
          </div>
        )}

        {isOutOfStock && (
          <Badge variant="secondary" className="absolute top-2 left-2 shadow-sm">
            Out of stock
          </Badge>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <h3 className="text-sm leading-snug font-medium group-hover:underline">
          {product.name}
        </h3>
        <p className="text-sm text-muted-foreground tabular-nums">
          {formatPrice(product.price)}
        </p>
      </div>
    </Link>
  );
}
