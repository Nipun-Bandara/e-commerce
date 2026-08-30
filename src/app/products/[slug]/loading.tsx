import { Skeleton } from "@/components/ui/skeleton";

/** Detail skeleton: breadcrumb, gallery on the left, product facts on the right. */
export default function ProductLoading() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
      <Skeleton className="h-5 w-48" />

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-14">
        <div className="flex flex-col gap-4">
          <Skeleton className="aspect-square w-full rounded-xl" />
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-5">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="aspect-square w-full rounded-lg" />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <Skeleton className="h-5 w-28 rounded-4xl" />
            <Skeleton className="h-9 w-4/5" />
            <Skeleton className="h-8 w-40" />
          </div>

          <Skeleton className="h-5 w-32 rounded-4xl" />
          <Skeleton className="h-9 w-full sm:w-64" />

          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      </div>
    </div>
  );
}
