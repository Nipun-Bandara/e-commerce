import { CircleXIcon } from "lucide-react";

import { OrderStatus } from "@/generated/prisma/enums";
import {
  ORDER_STATUS_FLOW,
  ORDER_STATUS_LABELS,
} from "@/lib/order-status";
import { cn } from "@/lib/utils";

/**
 * Where the order is in the flow, as five steps.
 *
 * Every stage up to and including the current one is filled; the rest are
 * outlines. Nothing here predicts a date — the schema stores one timestamp, so
 * anything more would be invented.
 *
 * `CANCELLED` is not a sixth step. An order that was called off did not travel
 * further down the line, and drawing it at the end would say it did, so it
 * replaces the timeline with a single statement instead.
 *
 * The steps are an ordered list, so a screen reader gets the sequence and the
 * position from the markup rather than from the colours.
 */
export default function OrderStatusTimeline({
  status,
}: {
  status: OrderStatus;
}) {
  if (status === OrderStatus.CANCELLED) {
    return (
      <p className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
        <CircleXIcon className="size-4 shrink-0" aria-hidden />
        This order was cancelled and is not being shipped.
      </p>
    );
  }

  const currentStep = ORDER_STATUS_FLOW.indexOf(status);

  return (
    <ol className="flex flex-col gap-0 sm:flex-row sm:gap-2">
      {ORDER_STATUS_FLOW.map((step, index) => {
        const isDone = index <= currentStep;
        const isCurrent = index === currentStep;

        return (
          <li
            key={step}
            aria-current={isCurrent ? "step" : undefined}
            className="flex flex-1 gap-3 sm:flex-col sm:gap-2"
          >
            {/* The rail. On a row it sits above the label; stacked, it becomes
                the vertical line down the left that connects the dots. */}
            <div className="flex flex-col items-center sm:w-full sm:flex-row">
              <span
                className={cn(
                  "size-2.5 shrink-0 rounded-full",
                  isDone ? "bg-foreground" : "bg-border",
                )}
              />
              {index < ORDER_STATUS_FLOW.length - 1 && (
                <span
                  aria-hidden
                  className={cn(
                    "w-px flex-1 sm:h-px sm:w-full sm:flex-none",
                    index < currentStep ? "bg-foreground" : "bg-border",
                  )}
                />
              )}
            </div>

            <span
              className={cn(
                "pb-4 text-sm sm:pb-0",
                isCurrent
                  ? "font-medium text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {ORDER_STATUS_LABELS[step]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
