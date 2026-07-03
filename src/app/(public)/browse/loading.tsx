import { PosterSkeleton } from "@/components/ui/Skeletons";

export default function BrowseLoading() {
  return (
    <div className="container-fx py-10 sm:py-12">
      <div className="skeleton h-8 w-40" />
      <div className="mt-8 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex gap-2">
            {Array.from({ length: 6 }).map((_, j) => (
              <div key={j} className="skeleton h-8 w-20 rounded-full" />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-10 grid grid-cols-2 justify-items-center gap-x-3 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <PosterSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
