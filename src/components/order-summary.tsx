import { formatPrice, type Money } from "@/lib/money";
import type { OrderTotals } from "@/server/checkout";

/**
 * The list of what is being bought and what it adds up to.
 *
 * One component for both the review step and the confirmation page, because the
 * whole point of the review step is that it shows the order that gets placed.
 * Two components drift, and the first thing they drift on is a total.
 *
 * A Server Component, which is what lets it hold `Decimal` values: they are
 * formatted to strings here and never handed across the client boundary, where
 * they would not survive serialisation.
 *
 * Lines are given already priced. On the review step those figures come from
 * the live `Product` rows; on a past order they come from the `OrderItem`
 * snapshots. This component does no arithmetic of its own — a subtotal it
 * re-derived could disagree with the one stored on the order, and the stored
 * one is the one that is true.
 */

export type OrderSummaryLine = {
  id: string;
  name: string;
  unitPrice: Money;
  quantity: number;
  lineTotal: Money;
};

export default function OrderSummary({
  lines,
  totals,
  heading = "Order summary",
}: {
  lines: OrderSummaryLine[];
  totals: OrderTotals;
  heading?: string;
}) {
  return (
    <div className="flex flex-col gap-5 rounded-xl border border-border p-5">
      <h2 className="text-sm font-medium">{heading}</h2>

      <ul className="flex flex-col gap-4">
        {lines.map((line) => (
          <li key={line.id} className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="text-sm leading-snug font-medium">{line.name}</p>
              <p className="text-xs text-muted-foreground tabular-nums">
                {formatPrice(line.unitPrice)} × {line.quantity}
              </p>
            </div>

            <p className="shrink-0 text-sm font-medium tabular-nums">
              {formatPrice(line.lineTotal)}
            </p>
          </li>
        ))}
      </ul>

      <hr className="border-border" />

      <dl className="flex flex-col gap-2">
        <SummaryRow label="Subtotal" value={formatPrice(totals.subtotal)} />
        <SummaryRow label="Shipping" value={formatPrice(totals.shippingFee)} />

        <div className="mt-1 flex items-baseline justify-between gap-4 border-t border-border pt-3">
          <dt className="text-sm font-medium">Total</dt>
          <dd className="text-lg font-medium tabular-nums">
            {formatPrice(totals.total)}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm tabular-nums">{value}</dd>
    </div>
  );
}
