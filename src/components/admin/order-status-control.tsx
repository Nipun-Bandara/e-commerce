"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  TriangleAlertIcon,
} from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { OrderStatus } from "@/generated/prisma/enums";
import { ADMIN_REQUEST_FAILED } from "@/lib/admin-result";
import { ORDER_STATUS_LABELS } from "@/lib/order-status";
import {
  nextStatuses,
  STATUS_CHANGE_WARNINGS,
} from "@/lib/order-transitions";
import { updateOrderStatusAction } from "@/server/admin-order-actions";

/**
 * Moves an order to its next status, once the admin has said so twice.
 *
 * ## The dropdown offers only legal moves, and that is not the enforcement
 *
 * The options come from `nextStatuses(status)` — the same table
 * `updateOrderStatus` inverts to build the `WHERE` of its conditional update. So
 * a DELIVERED order renders no control at all, and a PAID one cannot be sent to
 * SHIPPED because SHIPPED is not in the list. None of that stops anybody: a
 * Server Action is a POST, and this component is not on the path of a crafted
 * one. The rule is enforced by Postgres, inside the transaction. This is here so
 * the screen does not offer something that would only ever be refused.
 *
 * ## Every change is confirmed, by name
 *
 * The dialog reads both statuses back — "from Paid to Processing" — rather than
 * asking "are you sure?". A generic prompt confirms an intention, not a target,
 * and this control sits at the bottom of a page whose contents scrolled past.
 *
 * Two moves get an extra sentence, from `STATUS_CHANGE_WARNINGS`: marking an
 * order PAID by hand asserts money that no gateway verified, and CANCELLED puts
 * stock back on the shelf and cannot be undone from this screen.
 *
 * `isPending` stays true until React has re-rendered with the revalidated page,
 * not merely until the action resolves, so the button cannot be pressed twice
 * into the same request.
 */
export default function OrderStatusControl({
  orderNumber,
  status,
}: {
  orderNumber: string;
  status: OrderStatus;
}) {
  const options = nextStatuses(status);
  const [target, setTarget] = useState<OrderStatus | "">("");
  const [isPending, startTransition] = useTransition();
  const showToast = useToast();

  /**
   * The status this control was last rendered for. When the page comes back
   * revalidated after a successful change, the old target is a move that has
   * already happened — leaving it selected would invite pressing it again.
   */
  const seen = useRef(status);

  useEffect(() => {
    if (seen.current === status) return;
    seen.current = status;
    setTarget("");
  }, [status]);

  if (options.length === 0) {
    return (
      <p className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
        <CheckCircle2Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
        {status === OrderStatus.CANCELLED
          ? "This order was cancelled. Cancelled orders are final and cannot be moved to another status."
          : "This order was delivered. Delivered orders are final and cannot be moved to another status."}
      </p>
    );
  }

  function update(next: OrderStatus) {
    startTransition(async () => {
      try {
        const result = await updateOrderStatusAction(orderNumber, next);
        showToast(
          result.message,
          result.status === "success" ? "success" : "error",
        );
      } catch {
        // A rejected action means the request never landed — a dropped
        // connection, a server error. Saying so beats a silent no-op.
        showToast(ADMIN_REQUEST_FAILED, "error");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex flex-1 flex-col gap-1.5">
        <label
          htmlFor="order-status-target"
          className="text-xs font-medium text-muted-foreground"
        >
          Move to
        </label>

        <div className="relative">
          <select
            id="order-status-target"
            value={target}
            disabled={isPending}
            onChange={(event) =>
              setTarget(event.target.value as OrderStatus | "")
            }
            className="h-9 w-full appearance-none rounded-lg border border-border bg-background pr-8 pl-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
          >
            <option value="">Choose a status…</option>
            {options.map((option) => (
              <option key={option} value={option}>
                {ORDER_STATUS_LABELS[option]}
              </option>
            ))}
          </select>
          <ChevronDownIcon
            aria-hidden
            className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
        </div>
      </div>

      {/* The dialog is only mounted once a target is picked, so its copy can
          name both statuses without a "choose one first" branch inside it. */}
      {target === "" ? (
        <Button type="button" disabled>
          Update status
        </Button>
      ) : (
        <ConfirmStatusChange
          orderNumber={orderNumber}
          from={status}
          to={target}
          isPending={isPending}
          onConfirm={() => update(target)}
        />
      )}
    </div>
  );
}

function ConfirmStatusChange({
  orderNumber,
  from,
  to,
  isPending,
  onConfirm,
}: {
  orderNumber: string;
  from: OrderStatus;
  to: OrderStatus;
  isPending: boolean;
  onConfirm: () => void;
}) {
  const warning = STATUS_CHANGE_WARNINGS[to];
  const destructive = to === OrderStatus.CANCELLED;

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant={destructive ? "destructive" : "default"}
          disabled={isPending}
        >
          {isPending ? "Updating…" : "Update status"}
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            {warning ? (
              <TriangleAlertIcon aria-hidden />
            ) : (
              <ArrowRightIcon aria-hidden />
            )}
          </AlertDialogMedia>

          {/* Both statuses, by name. The order number too: this page can be one
              of several open tabs. */}
          <AlertDialogTitle>
            Move {orderNumber} from {ORDER_STATUS_LABELS[from]} to{" "}
            {ORDER_STATUS_LABELS[to]}?
          </AlertDialogTitle>

          <AlertDialogDescription>
            The customer sees this status on their own copy of the order as soon
            as it changes.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {warning ? (
          <p className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
            <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
            {warning}
          </p>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel>Keep {ORDER_STATUS_LABELS[from]}</AlertDialogCancel>
          <AlertDialogAction
            variant={destructive ? "destructive" : "default"}
            onClick={onConfirm}
          >
            Move to {ORDER_STATUS_LABELS[to]}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
