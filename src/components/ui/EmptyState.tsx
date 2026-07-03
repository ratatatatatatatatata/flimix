export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-ink-600 px-6 py-16 text-center">
      <p className="text-lg font-medium text-mist-100">{title}</p>
      {description ? (
        <p className="max-w-md text-sm text-mist-400">{description}</p>
      ) : null}
      {action}
    </div>
  );
}
