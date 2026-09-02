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
import { deleteCategoryAction } from "@/server/admin-category-actions";

/**
 * Deletes a category, if nothing is in it.
 *
 * The button is disabled when the row's product count is above zero, and the
 * dialog is never reached in that case — but the count that disables it was
 * read when the page rendered, and a product can be moved into the category
 * while this screen sits open. So the disabled state is a courtesy and
 * `deleteCategory` is the mechanism: it re-counts inside the transaction and
 * refuses with a message naming the number in the way.
 *
 * The tooltip-free approach is deliberate. A disabled button that explains
 * nothing is a puzzle, so the count sits beside it in the table and the
 * `title` says what to do about it.
 */
export default function DeleteCategoryButton({
  categoryId,
  categoryName,
  productCount,
}: {
  categoryId: string;
  categoryName: string;
  /** As of the last render. The server re-checks; see above. */
  productCount: number;
}) {
  const [isPending, startTransition] = useTransition();
  const showToast = useToast();

  const blocked = productCount > 0;

  function remove() {
    startTransition(async () => {
      try {
        const result = await deleteCategoryAction(categoryId);
        showToast(
          result.message,
          result.status === "success" ? "success" : "error",
        );
      } catch {
        showToast(ADMIN_REQUEST_FAILED, "error");
      }
    });
  }

  if (blocked) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled
        aria-label={`Cannot delete ${categoryName}: it has ${productCount === 1 ? "1 product" : `${productCount} products`}`}
        title={`Move or delete its ${productCount === 1 ? "product" : "products"} first.`}
      >
        <Trash2Icon aria-hidden />
      </Button>
    );
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={isPending}
          aria-label={`Delete ${categoryName}`}
        >
          <Trash2Icon aria-hidden />
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <Trash2Icon aria-hidden />
          </AlertDialogMedia>

          <AlertDialogTitle>Delete {categoryName}?</AlertDialogTitle>

          <AlertDialogDescription>
            No products are in this category, so nothing on the storefront
            depends on it. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>Keep category</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={remove}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
