import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function DishCardSkeleton() {
  return (
    <Card className="rounded-2xl">
      <CardContent className="p-5">
        {/* Name + price row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-2/3 rounded-full" />
            <Skeleton className="h-3 w-1/3 rounded-full" />
          </div>
          <Skeleton className="h-5 w-14 shrink-0 rounded-full" />
        </div>
        {/* Description */}
        <div className="mt-3 flex flex-col gap-1.5">
          <Skeleton className="h-3 rounded-full" />
          <Skeleton className="h-3 w-4/5 rounded-full" />
        </div>
        {/* Ingredients */}
        <div className="mt-3 flex gap-1.5">
          <Skeleton className="h-5 w-14 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        {/* Button placeholder */}
        <Skeleton className="mt-4 h-7 rounded-lg" />
      </CardContent>
    </Card>
  );
}
