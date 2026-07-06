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

/** Hero-shaped skeleton for the landing hero while its data streams in. */
export function HeroSkeleton() {
  return (
    <section
      className="relative flex min-h-[72vh] items-end overflow-hidden bg-gradient-to-br from-ink-900 via-ink-950 to-ink-950"
      aria-hidden="true"
    >
      <div className="container-fx w-full pb-14 pt-44">
        <div className="skeleton h-3 w-40" />
        <div className="skeleton mt-4 h-10 w-full max-w-xl" />
        <div className="mt-5 flex flex-wrap gap-2">
          <div className="skeleton h-6 w-14 rounded-full" />
          <div className="skeleton h-6 w-16 rounded-full" />
          <div className="skeleton h-6 w-20 rounded-full" />
        </div>
        <div className="skeleton mt-5 h-4 w-full max-w-lg" />
        <div className="skeleton mt-2 h-4 w-2/3 max-w-md" />
        <div className="mt-8 flex flex-wrap gap-3">
          <div className="skeleton h-[52px] w-44 rounded-lg" />
          <div className="skeleton h-[52px] w-44 rounded-lg" />
        </div>
      </div>
    </section>
  );
}
