import ProductCardSkeleton from "@/components/product-card-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { DEFAULT_PAGE_SIZE } from "@/server/products";

/**
 * Placeholder for the result count and grid.
 *
 * Shared by `loading.tsx` and the Suspense boundary the catalogue wraps its
 * results in, so a first visit and a re-filter show the same shape settling
 * into the same layout.
 */
export default function ProductResultsSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-4 w-32" />

      <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: DEFAULT_PAGE_SIZE }, (_, index) => (
          <ProductCardSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}
