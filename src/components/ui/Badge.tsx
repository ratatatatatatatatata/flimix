export function Badge({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "accent" | "success" | "warning" | "danger";
}) {
  const tones = {
    default: "bg-ink-700 text-mist-300 border-ink-600",
    accent: "bg-royal-700/30 text-royal-300 border-royal-600/40",
    success: "bg-emerald-900/40 text-emerald-300 border-emerald-700/40",
    warning: "bg-amber-900/40 text-amber-300 border-amber-700/40",
    danger: "bg-red-900/40 text-red-300 border-red-700/40",
  } as const;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
