"use client";

import { useTransition } from "react";

import type { CartResult } from "@/lib/cart-result";
import { useToast } from "@/components/ui/toast";

/**
 * Runs one cart Server Action and reports the outcome.
 *
 * Every cart control does the same three things — start a transition, await the
 * action, toast the result — so they do it through here instead of four times
 * over. `isPending` stays true until React has finished re-rendering with the
 * revalidated data, not merely until the action resolves, so a button wired to
 * it cannot be pressed twice into the same request.
 *
 * A `warning` result is a real write that did not do quite what was asked
 * ("only 3 left, so you have 3"), so it takes the error styling: it is the
 * message the visitor most needs to read.
 */
export function useCartMutation() {
  const [isPending, startTransition] = useTransition();
  const showToast = useToast();

  function run(mutate: () => Promise<CartResult>) {
    startTransition(async () => {
      try {
        const result = await mutate();
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

  return { isPending, run };
}
