import type { OrderStatus } from "@/generated/prisma/enums";
import { Badge } from "@/components/ui/badge";
import {
  ORDER_STATUS_BADGE_CLASSES,
  ORDER_STATUS_LABELS,
} from "@/lib/order-status";
import { cn } from "@/lib/utils";

/**
 * Where an order is, as one word.
 *
 * The colour is a second signal, never the only one: the label says the same
 * thing, so the badge still reads correctly in monochrome and to anyone who
 * cannot tell amber from indigo.
 */
export default function OrderStatusBadge({
  status,
  className,
}: {
  status: OrderStatus;
  className?: string;
}) {
  return (
    <Badge
      variant="secondary"
      className={cn(ORDER_STATUS_BADGE_CLASSES[status], className)}
    >
      {ORDER_STATUS_LABELS[status]}
    </Badge>
  );
}
