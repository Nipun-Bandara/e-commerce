"use client";

import { useTransition } from "react";
import { CircleXIcon } from "lucide-react";

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
import { cancelOrderAction } from "@/server/order-actions";

/**
 * Cancels an order, once the visitor has said so twice.
 *
 * The dialog is a courtesy, not a control: it exists because cancelling cannot
 * be undone from this screen, and a mis-click on a page someone opened to check
 * a delivery date would be a bad afternoon. Whether the order may be cancelled
 * at all is decided by `cancelOrder`, inside the transaction — this component
 * is only rendered when the server has already decided the answer is yes, and
 * the answer is checked again when the button is pressed.
 *
 * `isPending` stays true until React has re-rendered with the revalidated
 * page, not merely until the action resolves, so the button cannot be pressed
 * twice into the same request.
 */
export default function CancelOrderButton({
  orderNumber,
}: {
  orderNumber: string;
}) {
  const [isPending, startTransition] = useTransition();
  const showToast = useToast();

  function cancel() {
    startTransition(async () => {
      try {
        const result = await cancelOrderAction(orderNumber);
        showToast(
          result.message,
          result.status === "success" ? "success" : "error",
        );
      } catch {
        // A rejected action means the request never landed — a dropped
        // connection, a server error. Saying so beats a silent no-op.
        showToast("Something went wrong. Please try again.", "error");
      }
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="destructive" size="lg" disabled={isPending}>
          <CircleXIcon aria-hidden />
          {isPending ? "Cancelling…" : "Cancel order"}
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <CircleXIcon aria-hidden />
          </AlertDialogMedia>

          <AlertDialogTitle>Cancel order {orderNumber}?</AlertDialogTitle>

          <AlertDialogDescription>
            The items go back on sale straight away and the order cannot be
            reinstated. You would need to place it again.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>Keep order</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={cancel}>
            Cancel order
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
