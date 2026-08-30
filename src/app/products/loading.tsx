import ProductResultsSkeleton from "@/components/product-results-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Listing skeleton. Also covers the category pages below this segment, which
 * render the same heading + controls + grid shape.
 *
 * This is the boundary for arriving at the route. Once here, re-filtering is
 * covered by the narrower Suspense boundary around the results, which reuses
 * `ProductResultsSkeleton` so both show the same placeholder.
 */
export default function ProductsLoading() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4">
        <Skeleton className="h-9 w-64" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Skeleton className="h-9 w-full sm:max-w-sm" />
          <Skeleton className="h-9 w-40" />
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-10">
        <div className="hidden lg:flex lg:w-64 lg:shrink-0 lg:flex-col lg:gap-3">
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton key={index} className="h-7 w-full rounded-lg" />
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <ProductResultsSkeleton />
        </div>
      </div>
    </div>
  );
}
