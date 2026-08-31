"use client";

import { MinusIcon, PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Minus / value / plus. Shared by the detail page picker and the cart rows so
 * the two behave identically.
 *
 * Not an `<input type="number">`: the spinner is inconsistent between browsers,
 * and a free text field invites "abc" and "-3" for no gain when the sensible
 * range is one to a dozen. The buttons make the bounds visible — at the limit
 * the control disables rather than silently refusing.
 *
 * `aria-live="polite"` on the value is what makes the change audible; the
 * buttons themselves are labelled, so pressing one announces the new number.
 */
export default function QuantityStepper({
  value,
  min = 1,
  max,
  disabled = false,
  onChange,
  label,
  size = "default",
}: {
  value: number;
  min?: number;
  /** Upper bound, normally the live stock figure. */
  max: number;
  disabled?: boolean;
  onChange: (next: number) => void;
  /** Names the group for assistive tech, e.g. "Quantity for Blue Mug". */
  label: string;
  size?: "default" | "sm";
}) {
  const isSmall = size === "sm";

  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "flex items-center justify-between rounded-lg border border-border",
        isSmall ? "h-8 w-24 px-0.5" : "h-9 w-32 px-1",
        disabled && "opacity-50",
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size={isSmall ? "icon-xs" : "icon-sm"}
        aria-label="Decrease quantity"
        disabled={disabled || value <= min}
        onClick={() => onChange(value - 1)}
      >
        <MinusIcon aria-hidden />
      </Button>

      <span aria-live="polite" className="text-sm tabular-nums">
        {value}
      </span>

      <Button
        type="button"
        variant="ghost"
        size={isSmall ? "icon-xs" : "icon-sm"}
        aria-label="Increase quantity"
        disabled={disabled || value >= max}
        onClick={() => onChange(value + 1)}
      >
        <PlusIcon aria-hidden />
      </Button>
    </div>
  );
}
