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

/** Grid-shaped skeleton matching the landing poster grids (2/3/4/5 columns). */
export function GridSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className="space-y-4" aria-hidden="true">
      <div className="flex items-center justify-between">
        <div className="skeleton h-6 w-44" />
        <div className="skeleton h-4 w-24" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="skeleton aspect-[2/3] w-full" />
            <div className="skeleton h-4 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Wide-card skeleton for the featured landing carousel. */
export function CarouselSkeleton() {
  return (
    <section className="overflow-hidden pt-6 sm:pt-10" aria-hidden="true">
      <div className="flex justify-center gap-4 px-4">
        <div className="skeleton hidden aspect-video w-[70vw] max-w-3xl shrink-0 rounded-xl md:block" />
        <div className="skeleton aspect-video w-[70vw] max-w-3xl shrink-0 rounded-xl" />
        <div className="skeleton hidden aspect-video w-[70vw] max-w-3xl shrink-0 rounded-xl md:block" />
      </div>
      <div className="mt-4 flex justify-center gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton h-1.5 w-4 rounded-full" />
        ))}
      </div>
    </section>
  );
}

/** Full-bleed shimmer matching the landing trailer billboard. */
export function BillboardSkeleton() {
  return (
    <section className="relative min-h-[46vh] overflow-hidden sm:min-h-[60vh]" aria-hidden="true">
      <div className="skeleton absolute inset-0 rounded-none" />
      <div className="container-fx relative flex min-h-[46vh] flex-col justify-end gap-4 pb-12 sm:min-h-[60vh]">
        <div className="skeleton h-6 w-16 rounded-full" />
        <div className="skeleton h-10 w-2/3 max-w-lg" />
        <div className="skeleton h-4 w-1/2 max-w-sm" />
        <div className="flex gap-3">
          <div className="skeleton h-12 w-40 rounded-lg" />
          <div className="skeleton h-12 w-12 rounded-full" />
        </div>
      </div>
    </section>
  );
}

/** card-surface shimmer for the landing sidebar widgets. */
export function SidebarWidgetSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="card-surface space-y-3 p-4" aria-hidden="true">
      <div className="skeleton h-5 w-28" />
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="skeleton h-8 w-full" />
        ))}
      </div>
    </div>
  );
}
