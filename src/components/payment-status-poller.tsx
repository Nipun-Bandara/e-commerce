"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Waits for the payment webhook to land, on behalf of someone looking at the
 * confirmation page.
 *
 * PayHere redirects the browser back and POSTs the result to `notify_url`
 * separately, and the two race. The redirect usually wins, so an order that is
 * about to be `PAID` is still `PENDING` for the second or two it takes the
 * webhook to arrive — and only the webhook may change that, so this page cannot
 * make it happen sooner. All it can do is look again.
 *
 * `router.refresh()` re-runs the Server Component and re-reads the status; it
 * writes nothing and carries no claim about whether the payment succeeded. When
 * the status does change, the page stops rendering this component and the
 * polling stops with it.
 *
 * Polling gives up after {@link MAX_POLLS}. A payment that has not been
 * confirmed in two minutes is not going to be confirmed by asking faster, and a
 * tab left open overnight should not spend the night refreshing. The button
 * outlives the timer, so there is always something to press.
 */

const POLL_INTERVAL_MS = 4_000;

/** Two minutes at the interval above. */
const MAX_POLLS = 30;

export default function PaymentStatusPoller() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [polls, setPolls] = useState(0);

  const givenUp = polls >= MAX_POLLS;

  useEffect(() => {
    if (givenUp) return;

    const timer = setTimeout(() => {
      setPolls((count) => count + 1);
      startTransition(() => {
        router.refresh();
      });
    }, POLL_INTERVAL_MS);

    // Cleared on unmount as well as before the next tick, so a status that
    // arrives mid-wait does not fire one more refresh on the way out.
    return () => clearTimeout(timer);
  }, [givenUp, polls, router]);

  return (
    <div className="flex flex-col items-center gap-2">
      <Button
        type="button"
        variant="outline"
        disabled={isPending}
        onClick={() => {
          // Pressing the button restarts the automatic checks too: someone who
          // is still watching is worth a fresh two minutes.
          setPolls(0);
          startTransition(() => {
            router.refresh();
          });
        }}
      >
        <RefreshCwIcon aria-hidden />
        {isPending ? "Checking…" : "Check again"}
      </Button>

      <p className="text-xs text-muted-foreground" aria-live="polite">
        {givenUp
          ? "Still not confirmed. Your order is safe — check again, or find it under your orders."
          : "Checking automatically every few seconds."}
      </p>
    </div>
  );
}
