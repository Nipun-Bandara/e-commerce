import { Prisma } from "@/generated/prisma/client";

/**
 * Money helpers.
 *
 * Every money value in this codebase is a Prisma `Decimal` backed by a
 * Postgres `numeric(10, 2)` column. Binary floating point cannot represent
 * values like 0.10 exactly, so arithmetic on `number` silently drifts — one
 * cent at a time, then visibly once you multiply by a quantity and sum a
 * basket. Nothing here converts to `number`; the formatter is handed an exact
 * decimal string.
 */

export type Money = Prisma.Decimal;

/** The store prices everything in Sri Lankan Rupees. */
export const CURRENCY = "LKR";

/** Build a Money value from a decimal string, e.g. `money("12500.00")`. */
export function money(value: string): Money {
  return new Prisma.Decimal(value);
}

/**
 * Format for display, e.g. `LKR 12,500.00`.
 *
 * Deliberately not `Intl.NumberFormat`: its typed overloads only accept
 * `number`, which would mean a float round-trip on every render. Grouping the
 * exact string from `toFixed(2)` keeps the value exact, and the store only
 * ever renders one currency so there is no locale matrix to support.
 */
export function formatPrice(value: Money): string {
  const fixed = value.toFixed(2);
  const isNegative = fixed.startsWith("-");
  const [whole, fraction] = (isNegative ? fixed.slice(1) : fixed).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  return `${isNegative ? "-" : ""}${CURRENCY} ${grouped}.${fraction}`;
}

/** Line total for an order/cart row: unit price × quantity, exact. */
export function lineTotal(unitPrice: Money, quantity: number): Money {
  return unitPrice.mul(quantity);
}

/** Sum a list of money values, exact. */
export function sumMoney(values: Money[]): Money {
  return values.reduce((total, value) => total.add(value), new Prisma.Decimal(0));
}
