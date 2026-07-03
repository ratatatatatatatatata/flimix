export function PosterSkeleton() {
  return (
    <div className="w-36 shrink-0 space-y-2 sm:w-44">
      <div className="skeleton aspect-[2/3] w-full" />
      <div className="skeleton h-4 w-3/4" />
    </div>
  );
}

export function RowSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-3">
      <div className="skeleton h-6 w-44" />
      <div className="row-scroll flex gap-3 overflow-hidden sm:gap-4">
        {Array.from({ length: count }).map((_, i) => (
          <PosterSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
