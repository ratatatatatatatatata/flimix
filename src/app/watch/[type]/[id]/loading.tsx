export default function WatchLoading() {
  return (
    <div className="relative h-dvh w-full bg-black" aria-busy="true">
      <div className="absolute left-4 top-4 h-9 w-24 rounded-lg skeleton" />
      <div className="flex h-full items-center justify-center">
        <span
          className="h-14 w-14 animate-spin rounded-full border-4 border-white/20 border-t-royal-500"
          role="status"
          aria-label="Ачаалж байна..."
        />
      </div>
      <div className="absolute inset-x-0 bottom-0 space-y-3 px-4 pb-4">
        <div className="h-3 w-48 rounded skeleton" />
        <div className="h-1.5 w-full rounded-full skeleton" />
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-md skeleton" />
          <div className="h-9 w-9 rounded-md skeleton" />
          <div className="h-4 w-24 rounded skeleton" />
          <div className="ml-auto flex gap-2">
            <div className="h-9 w-9 rounded-md skeleton" />
            <div className="h-9 w-9 rounded-md skeleton" />
            <div className="h-9 w-9 rounded-md skeleton" />
          </div>
        </div>
      </div>
    </div>
  );
}
