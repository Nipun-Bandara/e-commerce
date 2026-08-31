import Image from "next/image";
import Link from "next/link";

import CartItemWarning from "@/components/cart-item-warning";
import CartQuantityControl from "@/components/cart-quantity-control";
import CartRemoveButton from "@/components/cart-remove-button";
import { formatPrice } from "@/lib/money";
import type { CartItemView } from "@/server/cart";

/**
 * One line of the cart.
 *
 * A Server Component, which is what lets it hold `Decimal` prices: they are
 * formatted to strings here and only the strings — plus ids, counts and flags —
 * are handed to the interactive children below.
 */
export default function CartItemRow({ item }: { item: CartItemView }) {
  const { product } = item;
  const isUnavailable = product.isActive === false || product.stock === 0;

  return (
    <li className="flex flex-col gap-3 border-b border-border py-5 first:pt-0 last:border-b-0">
      <div className="flex items-start gap-4">
        <Link
          href={`/products/${product.slug}`}
          className="relative size-20 shrink-0 overflow-hidden rounded-lg border border-border bg-muted"
          tabIndex={-1}
          aria-hidden
        >
          {product.image ? (
            <Image
              src={product.image.url}
              alt=""
              fill
              sizes="80px"
              className="object-cover"
            />
          ) : null}
        </Link>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Link
            href={`/products/${product.slug}`}
            className="text-sm leading-snug font-medium hover:underline"
          >
            {product.name}
          </Link>
          <p className="text-sm text-muted-foreground tabular-nums">
            {formatPrice(product.unitPrice)} each
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3 sm:gap-5">
          <CartQuantityControl
            cartItemId={item.id}
            quantity={item.quantity}
            max={product.stock}
            disabled={isUnavailable}
            productName={product.name}
          />

          <p className="w-28 text-right text-sm font-medium tabular-nums">
            {formatPrice(item.lineTotal)}
          </p>

          <CartRemoveButton cartItemId={item.id} productName={product.name} />
        </div>
      </div>

      {item.issue && (
        <CartItemWarning
          cartItemId={item.id}
          productName={product.name}
          issue={item.issue}
          stock={product.stock}
        />
      )}
    </li>
  );
}
