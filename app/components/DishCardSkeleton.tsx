export function DishCardSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-foreground/10 bg-background p-5 shadow-sm">
      {/* Name + price row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-1 flex-col gap-2">
          <div className="h-4 w-2/3 rounded-full bg-foreground/10" />
          <div className="h-3 w-1/3 rounded-full bg-foreground/[0.06]" />
        </div>
        <div className="h-7 w-14 shrink-0 rounded-full bg-foreground/10" />
      </div>
      {/* Description */}
      <div className="mt-3 flex flex-col gap-1.5">
        <div className="h-3 rounded-full bg-foreground/[0.06]" />
        <div className="h-3 w-4/5 rounded-full bg-foreground/[0.06]" />
      </div>
      {/* Ingredients */}
      <div className="mt-3 flex gap-1.5">
        <div className="h-5 w-14 rounded-full bg-foreground/[0.06]" />
        <div className="h-5 w-20 rounded-full bg-foreground/[0.06]" />
        <div className="h-5 w-16 rounded-full bg-foreground/[0.06]" />
      </div>
      {/* Button placeholder */}
      <div className="mt-4 h-9 rounded-xl bg-foreground/[0.06]" />
    </div>
  );
}
