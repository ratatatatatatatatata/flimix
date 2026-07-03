import { RowSkeleton } from "@/components/ui/Skeletons";

export default function SeriesLoading() {
  return (
    <div>
      <div className="relative min-h-[55vh] overflow-hidden">
        <div className="skeleton absolute inset-0 rounded-none" />
        <div className="container-fx relative flex min-h-[55vh] flex-col justify-end gap-4 pb-12 md:flex-row md:items-end md:gap-8">
          <div className="skeleton aspect-[2/3] w-40 shrink-0 sm:w-52" />
          <div className="flex-1 space-y-4 pb-2">
            <div className="skeleton h-9 w-2/3 max-w-md" />
            <div className="flex gap-2">
              <div className="skeleton h-6 w-14 rounded-full" />
              <div className="skeleton h-6 w-16 rounded-full" />
            </div>
            <div className="skeleton h-16 w-full max-w-xl" />
            <div className="flex gap-3">
              <div className="skeleton h-11 w-48" />
              <div className="skeleton h-11 w-36" />
            </div>
          </div>
        </div>
      </div>
      <div className="container-fx space-y-4 py-12">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-4">
            <div className="skeleton aspect-video w-32 sm:w-44" />
            <div className="flex-1 space-y-2 py-1">
              <div className="skeleton h-5 w-1/2 max-w-xs" />
              <div className="skeleton h-4 w-2/3 max-w-sm" />
            </div>
          </div>
        ))}
        <div className="pt-8">
          <RowSkeleton />
        </div>
      </div>
    </div>
  );
}
