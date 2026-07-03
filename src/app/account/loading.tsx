export default function AccountLoading() {
  return (
    <div className="space-y-6" role="status" aria-label="Ачаалж байна">
      <div className="skeleton h-8 w-56" />
      <div className="skeleton h-36 w-full rounded-xl" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="skeleton h-24 rounded-xl" />
        <div className="skeleton h-24 rounded-xl" />
        <div className="skeleton h-24 rounded-xl" />
        <div className="skeleton h-24 rounded-xl" />
      </div>
    </div>
  );
}
