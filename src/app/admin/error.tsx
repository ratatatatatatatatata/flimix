"use client";

import { Button } from "@/components/ui/Button";
import { t } from "@/lib/i18n";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
      <h2 className="text-xl font-semibold text-white">{t.errorGeneric}</h2>
      <p className="max-w-md text-sm text-mist-400">
        Админ хэсэгт алдаа гарлаа.{error.digest ? ` (Код: ${error.digest})` : ""}
      </p>
      <Button onClick={reset}>{t.retry}</Button>
    </div>
  );
}
