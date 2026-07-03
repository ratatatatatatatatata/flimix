export default function RootLoading() {
  return (
    <div className="container-fx py-10 space-y-8" aria-busy="true">
      <div className="skeleton h-[420px] w-full" />
      <div className="space-y-3">
        <div className="skeleton h-6 w-48" />
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-56 w-40 shrink-0" />
          ))}
        </div>
      </div>
    </div>
  );
}
