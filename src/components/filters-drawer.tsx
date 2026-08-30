"use client";

import { useEffect, useState, type ReactNode } from "react";
import { SlidersHorizontalIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Holds the filter panel: a column beside the grid on desktop, a slide-over
 * drawer below `lg`.
 *
 * The panel is mounted once and restyled, not rendered twice behind media
 * queries. Two copies would mean two sets of inputs sharing the same `id`s,
 * and a screen reader walking both.
 */
export default function FiltersDrawer({
  children,
  activeCount,
}: {
  children: ReactNode;
  /** Shown on the trigger so the drawer's contents are legible while closed. */
  activeCount: number;
}) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="lg"
        onClick={() => setIsOpen(true)}
        aria-expanded={isOpen}
        className="self-start lg:hidden"
      >
        <SlidersHorizontalIcon aria-hidden />
        Filters
        {activeCount > 0 && (
          <span className="ml-0.5 rounded-full bg-primary px-1.5 text-xs text-primary-foreground tabular-nums">
            {activeCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <div
          aria-hidden
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-40 bg-foreground/40 lg:hidden"
        />
      )}

      <div
        role={isOpen ? "dialog" : undefined}
        aria-modal={isOpen || undefined}
        aria-label={isOpen ? "Filters" : undefined}
        className={cn(
          // Desktop: an ordinary column. Every mobile-only utility below is
          // reset here, so the open/closed state has no effect at `lg`.
          "lg:static lg:z-auto lg:block lg:w-64 lg:max-w-none lg:shrink-0 lg:overflow-visible lg:border-0 lg:bg-transparent lg:p-0",
          isOpen
            ? "fixed inset-y-0 left-0 z-50 flex w-80 max-w-[85vw] flex-col gap-4 overflow-y-auto border-r border-border bg-background p-4"
            : "hidden",
        )}
      >
        <div className="flex items-center justify-between lg:hidden">
          <h2 className="text-base font-semibold">Filters</h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(false)}
            aria-label="Close filters"
          >
            <XIcon aria-hidden />
          </Button>
        </div>

        {children}
      </div>
    </>
  );
}
