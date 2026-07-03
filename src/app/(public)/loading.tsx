import { RowSkeleton } from "@/components/ui/Skeletons";

/** Landing skeleton: hero block + content rows. */
export default function PublicLoading() {
  return (
    <div>
      <div className="relative min-h-[60vh] overflow-hidden">
        <div className="skeleton absolute inset-0 rounded-none" />
        <div className="container-fx relative flex min-h-[60vh] flex-col justify-end gap-4 pb-14">
          <div className="skeleton h-10 w-2/3 max-w-md" />
          <div className="skeleton h-4 w-1/2 max-w-sm" />
          <div className="flex gap-3">
            <div className="skeleton h-11 w-36" />
            <div className="skeleton h-11 w-36" />
          </div>
        </div>
      </div>
      <div className="container-fx space-y-12 py-12">
        <RowSkeleton />
        <RowSkeleton />
        <RowSkeleton />
      </div>
    </div>
  );
}
