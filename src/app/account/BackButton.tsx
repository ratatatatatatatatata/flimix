"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { t } from "@/lib/i18n";

/**
 * Back control for the account area: goes to the previous page when there is
 * in-app history, otherwise falls back to the home page.
 */
export function BackButton() {
  const router = useRouter();

  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  };

  return (
    <button
      type="button"
      onClick={goBack}
      className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-mist-300 transition hover:bg-ink-700 hover:text-white"
    >
      <ArrowLeft size={18} aria-hidden="true" />
      {t.back}
    </button>
  );
}
