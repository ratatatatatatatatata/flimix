export default function AdminLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Ачаалж байна">
      <div className="skeleton h-8 w-56" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skeleton h-24 rounded-xl" />
        ))}
      </div>
      <div className="skeleton h-64 rounded-xl" />
    </div>
  );
}
