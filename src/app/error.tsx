"use client";

import { t } from "@/lib/i18n";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-2xl font-semibold">{t.errorGeneric}</h1>
      {error.digest ? (
        <p className="text-sm text-mist-500">Код: {error.digest}</p>
      ) : null}
      <button
        onClick={reset}
        className="rounded-lg bg-royal-500 px-6 py-3 font-medium text-white transition hover:bg-royal-600"
      >
        {t.retry}
      </button>
    </div>
  );
}
