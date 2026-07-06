"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { SearchOverlay } from "@/components/layout/SearchOverlay";
import { t } from "@/lib/i18n";

/**
 * Header search trigger: a plain icon button that opens the full-screen
 * SearchOverlay. The /search page remains available for deep links.
 */
export function HeaderSearch({ trending }: { trending?: { title: string }[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label={t.search}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="rounded-lg p-2 text-mist-300 transition hover:bg-ink-700 hover:text-white"
      >
        <Search size={20} aria-hidden="true" />
      </button>
      <SearchOverlay open={open} onClose={() => setOpen(false)} trending={trending} />
    </>
  );
}
