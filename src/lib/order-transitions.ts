import { OrderStatus } from "@/generated/prisma/enums";

import { ORDER_STATUS_LABELS } from "@/lib/order-status";

/**
 * Which status an order may move to next, and from where.
 *
 * ## One table, read in both directions
 *
 * {@link ORDER_STATUS_TRANSITIONS} is the only place the rule is written down.
 * The dropdown reads it forwards — "given this order is PAID, what may I pick" —
 * and `updateOrderStatus` reads it backwards through {@link sourcesFor}: "given
 * somebody is asking for PROCESSING, which statuses were allowed to get there".
 * Backwards is the direction that matters, because that list goes straight into
 * the `WHERE` of the conditional update, which is what actually enforces the
 * rule against a request that never went near the dropdown.
 *
 * Deriving the inverse rather than writing it twice is not tidiness. Two tables
 * drift, and the day they disagree the UI and the enforcement disagree — which
 * is the exact failure this feature exists to prevent.
 *
 * ## Why this is in `lib/`
 *
 * Both sides of the network boundary need it, the same reason `order-status.ts`
 * gives. The Server Action validates with it; the Client Component that renders
 * the dropdown builds its options from it. `@/generated/prisma/enums` is a plain
 * frozen object of string literals, so it is safe in a browser bundle in a way
 * that anything importing the Prisma client would not be.
 *
 * ## The two terminal states
 *
 * `DELIVERED` and `CANCELLED` map to empty lists, and nothing maps *to*
 * `PENDING`. That is what makes "DELIVERED back to PENDING" impossible rather
 * than merely unoffered: `sourcesFor(PENDING)` is empty, so the update matches
 * no row however the request was crafted.
 */

/** The moves an order in each status is allowed to make. */
export const ORDER_STATUS_TRANSITIONS: Record<
  OrderStatus,
  readonly OrderStatus[]
> = {
  PENDING: [OrderStatus.PAID, OrderStatus.CANCELLED],
  PAID: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
  PROCESSING: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  SHIPPED: [OrderStatus.DELIVERED],
  // Terminal. An order that arrived, and one that was called off, are both
  // finished — a correction to either is a database job, not a dropdown.
  DELIVERED: [],
  CANCELLED: [],
};

/**
 * The inverse of the table above: for each target, the statuses that may reach
 * it. Computed once at module load, so it cannot fall out of step.
 */
const TRANSITION_SOURCES: Record<OrderStatus, OrderStatus[]> = (() => {
  const sources = Object.fromEntries(
    Object.values(OrderStatus).map((status) => [status, [] as OrderStatus[]]),
  ) as Record<OrderStatus, OrderStatus[]>;

  for (const [from, targets] of Object.entries(ORDER_STATUS_TRANSITIONS)) {
    for (const to of targets) sources[to].push(from as OrderStatus);
  }

  return sources;
})();

/** What an order in `status` may be moved to. Empty for a terminal status. */
export function nextStatuses(status: OrderStatus): readonly OrderStatus[] {
  return ORDER_STATUS_TRANSITIONS[status];
}

/**
 * Every status an order must currently be in for a move to `target` to be
 * legal. Empty means nothing may move there at all.
 *
 * This is the list `updateOrderStatus` puts in its `WHERE`, so the rule is
 * evaluated by Postgres against the row as it stands at the moment of the
 * write rather than against a status this process read a moment earlier.
 */
export function sourcesFor(target: OrderStatus): readonly OrderStatus[] {
  return TRANSITION_SOURCES[target];
}

/** Whether `from -> to` is a move the rules allow. */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_STATUS_TRANSITIONS[from].includes(to);
}

/** Whether an order in this status is finished and takes no further changes. */
export function isTerminalStatus(status: OrderStatus): boolean {
  return ORDER_STATUS_TRANSITIONS[status].length === 0;
}

/**
 * The extra sentence the confirmation dialog shows for the two moves that do
 * more than relabel a row.
 *
 * `PAID` is reachable by hand so that a bank transfer or a phone order can be
 * recorded, but doing it here means no gateway ever confirmed the money — the
 * admin is asserting it, and the dialog says so.
 *
 * `CANCELLED` puts stock back on the shelf, which is a write to the catalogue
 * rather than to this order alone, and it cannot be undone from this screen.
 */
export const STATUS_CHANGE_WARNINGS: Partial<Record<OrderStatus, string>> = {
  [OrderStatus.PAID]:
    "This bypasses the payment gateway. Nothing has been charged and no payment has been verified — only mark an order paid when you have confirmed the money another way.",
  [OrderStatus.CANCELLED]:
    "The items go back on sale straight away and the order cannot be reinstated.",
};

/** `Paid` → `Processing`, for a dialog title or a toast. */
export function describeTransition(
  from: OrderStatus,
  to: OrderStatus,
): { from: string; to: string } {
  return { from: ORDER_STATUS_LABELS[from], to: ORDER_STATUS_LABELS[to] };
}
