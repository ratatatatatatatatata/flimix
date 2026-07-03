import { CheckCircle2, AlertTriangle } from "lucide-react";

/** Renders ?message= / ?error= search-param feedback after redirects. */
export function MessageBanner({
  message,
  error,
}: {
  message?: string;
  error?: string;
}) {
  if (!message && !error) return null;
  if (error) {
    return (
      <div
        role="alert"
        className="flex items-start gap-2 rounded-lg border border-red-700/40 bg-red-900/30 px-4 py-3 text-sm text-red-300"
      >
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>{error}</span>
      </div>
    );
  }
  return (
    <div
      role="status"
      className="flex items-start gap-2 rounded-lg border border-emerald-700/40 bg-emerald-900/30 px-4 py-3 text-sm text-emerald-300"
    >
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{message}</span>
    </div>
  );
}
