"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { CheckIcon, Loader2Icon } from "lucide-react";

import { useToast } from "@/components/ui/toast";
import { ADMIN_REQUEST_FAILED } from "@/lib/admin-result";
import { cn } from "@/lib/utils";
import { updateStockAction } from "@/server/admin-product-actions";

/**
 * Stock, editable in the table without opening the product.
 *
 * Adjusting a count after a delivery is the one edit that happens twenty times
 * in a row, and routing each one through the full form — load, change one
 * number, save, navigate back, find the row again — is the difference between
 * a usable panel and one people avoid.
 *
 * ## What it commits, and when
 *
 * On blur, and on Enter. Not on every keystroke: typing `120` over `9` passes
 * through `1` and `12`, and a control that saves as you type would write both.
 * Escape restores the saved value and gives up focus.
 *
 * Nothing is sent when the value has not changed, so tabbing across a row does
 * not write anything.
 *
 * ## Pending state, not optimism
 *
 * The input shows the typed value immediately and marks itself busy while the
 * action runs, but it does **not** claim success early. Stock is the number the
 * storefront decides sales against; showing `40` before the write lands, and
 * silently keeping it there if the write failed, would put a figure on screen
 * that nothing in the database agrees with. The spinner is honest about the
 * gap, and `isPending` stays true until React has re-rendered with the
 * revalidated row — so the tick appears only once the server's answer is what
 * is on screen.
 */
export default function InlineStockField({
  productId,
  productName,
  stock,
}: {
  productId: string;
  /** Named in the toast, so a save that scrolled off screen is still traceable. */
  productName: string;
  stock: number;
}) {
  const [value, setValue] = useState(String(stock));
  const [isPending, startTransition] = useTransition();
  const [justSaved, setJustSaved] = useState(false);
  const showToast = useToast();

  /**
   * The last value the server confirmed. Compared against on commit so an
   * unchanged field sends nothing, and restored on Escape.
   */
  const saved = useRef(String(stock));

  // The row is re-rendered from the database after a write, and can also change
  // under us — a checkout takes stock, another tab edits it. Follow the prop,
  // but never over the top of something half-typed.
  useEffect(() => {
    const next = String(stock);
    if (next === saved.current) return;
    saved.current = next;
    setValue(next);
  }, [stock]);

  // The tick is a receipt, not a state. Two seconds is long enough to notice
  // and short enough that a row full of them does not become the design.
  useEffect(() => {
    if (!justSaved) return;
    const timer = setTimeout(() => setJustSaved(false), 2000);

    return () => clearTimeout(timer);
  }, [justSaved]);

  function commit() {
    const next = value.trim();

    if (next === saved.current) return;

    // Empty means "I deleted it and changed my mind", not "zero". Zero is
    // something you have to type, because it takes the product off sale.
    if (next === "") {
      setValue(saved.current);
      return;
    }

    startTransition(async () => {
      try {
        const result = await updateStockAction(productId, next);

        if (result.status === "success") {
          saved.current = next;
          setJustSaved(true);
          // Named, because by the time this lands the eye is on another row.
          showToast(`${productName}: ${result.message}`, "success");
        } else {
          // Rejected: put the field back to what the database actually holds,
          // so the screen never disagrees with it.
          setValue(saved.current);
          showToast(result.message, "error");
        }
      } catch {
        // A rejected action means the request never landed — a dropped
        // connection, a server error. Saying so beats a silent no-op.
        setValue(saved.current);
        showToast(ADMIN_REQUEST_FAILED, "error");
      }
    });
  }

  // From the prop, not from `saved`: this is what the database holds, and a ref
  // read during render is both a lint error and a value React cannot re-render
  // on. The tint therefore lands with the revalidated row rather than a moment
  // early, which is the honest ordering anyway.
  const isOutOfStock = stock === 0;

  return (
    <div className="flex items-center gap-1.5">
      <label htmlFor={`stock-${productId}`} className="sr-only">
        Stock for {productName}
      </label>

      <input
        id={`stock-${productId}`}
        // `inputMode` rather than `type="number"`: the spinner arrows are a
        // scroll-wheel hazard on a dense table, and the value is validated as a
        // string by the same schema the full form uses either way.
        inputMode="numeric"
        autoComplete="off"
        value={value}
        disabled={isPending}
        onChange={(event) => setValue(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
          if (event.key === "Escape") {
            setValue(saved.current);
            event.currentTarget.blur();
          }
        }}
        className={cn(
          "h-8 w-16 rounded-md border bg-background px-2 text-sm tabular-nums outline-none",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          "disabled:opacity-60",
          isOutOfStock
            ? "border-destructive/40 text-destructive"
            : "border-border",
        )}
      />

      {/*
        One slot for both indicators so the column does not change width when
        either appears. `aria-hidden` on both: the toast is what announces the
        outcome, and a screen reader does not need it twice.
      */}
      <span aria-hidden className="grid size-4 place-items-center">
        {isPending ? (
          <Loader2Icon className="size-3.5 animate-spin text-muted-foreground" />
        ) : justSaved ? (
          <CheckIcon className="size-3.5 text-muted-foreground" />
        ) : null}
      </span>
    </div>
  );
}
