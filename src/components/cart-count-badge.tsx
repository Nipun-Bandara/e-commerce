import { getCartItemCount } from "@/server/cart";

/**
 * The number on the header's cart button.
 *
 * Its own async component so the header can put it behind `<Suspense>`: reading
 * the cart cookie is a request-time API, and isolating it here means the rest
 * of the header renders immediately instead of waiting on a database round trip
 * on every page.
 *
 * Only the count crosses to the browser. The session id that produced it stays
 * in the httpOnly cookie and is never written into the markup.
 */
export default async function CartCountBadge() {
  const count = await getCartItemCount();
  if (count === 0) return null;

  return (
    <span className="ml-0.5 min-w-5 rounded-full bg-primary px-1.5 text-center text-xs leading-5 text-primary-foreground tabular-nums">
      {/* Capped for layout, but the true figure stays in the accessible name. */}
      <span aria-hidden>{count > 99 ? "99+" : count}</span>
      <span className="sr-only">
        {count === 1 ? "1 item in your cart" : `${count} items in your cart`}
      </span>
    </span>
  );
}
