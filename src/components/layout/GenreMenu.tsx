"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { t } from "@/lib/i18n";

export interface GenreLink {
  slug: string;
  name: string;
}

/**
 * Netflix-style "Ангилал" dropdown for the desktop header nav. Opens on hover
 * or click, closes on outside click, Escape or link navigation. Genres are
 * fetched server-side in SiteHeader and passed in as plain props.
 */
export function GenreMenu({ genres }: { genres: GenreLink[] }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (genres.length === 0) return null;

  return (
    <div
      ref={rootRef}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-sm text-mist-300 transition hover:text-white"
      >
        {t.categories}
        <ChevronDown
          size={14}
          aria-hidden="true"
          className={`transition ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? (
        /* pt-3 keeps the hover path from button to panel unbroken */
        <div className="absolute left-1/2 top-full z-50 w-[26rem] -translate-x-1/2 pt-3">
          <div className="rounded-xl border border-ink-600/50 bg-ink-900/95 p-4 shadow-card backdrop-blur">
            <ul className="grid grid-cols-3 gap-x-3 gap-y-0.5">
              {genres.map((g) => (
                <li key={g.slug}>
                  <Link
                    href={`/browse?genre=${g.slug}`}
                    onClick={() => setOpen(false)}
                    className="block rounded-md px-2 py-1.5 text-sm text-mist-300 transition hover:bg-ink-700/60 hover:text-white"
                  >
                    {g.name}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-3 border-t border-ink-600/40 pt-3">
              <Link
                href="/browse"
                onClick={() => setOpen(false)}
                className="text-sm text-royal-300 transition hover:text-royal-200"
              >
                Бүх ангилал →
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
