import { money, type Money } from "@/lib/money";

/**
 * What delivery costs.
 *
 * One flat rate for the whole country, and this is the only place the number
 * exists. Shipping is the kind of figure that gets quoted in a summary, stored
 * on an order and repeated in a confirmation email, and a store that hard-codes
 * `350` in three of those eventually charges two different prices for the same
 * delivery. Real rate cards — by weight, by district, by courier — replace this
 * constant with a function; every caller already asks the same question, so
 * they keep working.
 *
 * A `Decimal`, not a `number`, for the reason `money.ts` gives at length: this
 * value is added to a subtotal. Sharing one instance is safe because decimal
 * arithmetic is immutable — `.add()` returns a new value and never mutates the
 * receiver.
 */
export const SHIPPING_FEE: Money = money("350.00");
