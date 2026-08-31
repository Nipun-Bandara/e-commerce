import { Skeleton } from "@/components/ui/skeleton";

/**
 * Cart skeleton. The cart is always a database read behind a cookie, so it can
 * never be prerendered — this is what the visitor sees on the way in.
 *
 * Three rows is a guess at a typical cart, not a promise: it is a placeholder
 * shape, and the real list replaces it wholesale.
 */
export default function CartLoading() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-4 w-20" />
      </div>

      <div className="flex flex-col gap-10 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1 flex-col">
          {Array.from({ length: 3 }, (_, index) => (
            <div
              key={index}
              className="flex items-start gap-4 border-b border-border py-5 first:pt-0 last:border-b-0"
            >
              <Skeleton className="size-20 shrink-0 rounded-lg" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-8 w-24 rounded-lg" />
            </div>
          ))}
        </div>

        <div className="w-full shrink-0 lg:w-80">
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
