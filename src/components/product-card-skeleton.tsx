import { Skeleton } from "@/components/ui/skeleton";

/**
 * Placeholder for one grid tile. Shaped like `ProductCard` — square image,
 * name line, price line — so the layout does not jump when data arrives.
 */
export default function ProductCardSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="aspect-square w-full rounded-xl" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/3" />
      </div>
    </div>
  );
}
