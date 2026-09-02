import type { ReactNode } from "react";

/**
 * The title block every admin screen opens with.
 *
 * Not a layout: the pages below /admin do not share a heading, they share a
 * *shape* — title, one line of context, and an action or two on the right. A
 * component keeps that shape identical across five screens; putting it in the
 * layout would have meant passing the title up through a route segment.
 */
export default function AdminPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  /** Buttons or links, right-aligned on wide screens. */
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>

      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
