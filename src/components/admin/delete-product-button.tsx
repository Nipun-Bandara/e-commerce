"use client";

import { useTransition } from "react";
import { Trash2Icon } from "lucide-react";

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
import { ADMIN_REQUEST_FAILED } from "@/lib/admin-result";
import { deleteProductAction } from "@/server/admin-product-actions";

/**
 * Deletes a product, once the admin has said so twice.
 *
 * **The dialog names the product.** Rows in a filtered, sorted table move
 * between the moment you decide to delete one and the moment you click; a
 * generic "Are you sure?" confirms an intention, not a target. Reading the name
 * back is what makes it a confirmation.
 *
 * **It does not promise what will happen.** Whether this deletes the row or
 * archives it depends on whether the product appears on a past order, and that
 * is decided by `deleteProduct` inside the transaction — a count taken here to
 * word the dialog would be stale before the button was pressed. So the dialog
 * says both outcomes are possible, and the toast says which one happened. That
 * is the `warning` status: the write succeeded, but not as asked.
 *
 * `isPending` stays true until React has re-rendered with the revalidated
 * table, not merely until the action resolves, so the button cannot be pressed
 * twice into the same request.
 */
export default function DeleteProductButton({
  productId,
  productName,
}: {
  productId: string;
  productName: string;
}) {
  const [isPending, startTransition] = useTransition();
  const showToast = useToast();

  function remove() {
    startTransition(async () => {
      try {
        const result = await deleteProductAction(productId);
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
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={isPending}
          // The row already shows the name; the icon needs to carry it for
          // anyone hearing the page rather than seeing it.
          aria-label={`Delete ${productName}`}
        >
          <Trash2Icon aria-hidden />
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <Trash2Icon aria-hidden />
          </AlertDialogMedia>

          <AlertDialogTitle>Delete {productName}?</AlertDialogTitle>

          <AlertDialogDescription>
            If this product has never been ordered it is deleted for good, along
            with its images and any carts holding it. If it appears on a past
            order it is archived instead — hidden from the storefront, but kept
            so the order history stays intact.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>Keep product</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={remove}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
