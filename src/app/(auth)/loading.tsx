export default function AuthLoading() {
  return (
    <div className="flex flex-col items-center gap-4 py-10" role="status">
      <span
        className="h-8 w-8 animate-spin rounded-full border-2 border-royal-500/30 border-t-royal-500"
        aria-hidden="true"
      />
      <p className="text-sm text-mist-400">Ачаалж байна...</p>
    </div>
  );
}
