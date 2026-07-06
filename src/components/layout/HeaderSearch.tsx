"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { t } from "@/lib/i18n";

const inputClass =
  "w-full rounded-lg border border-ink-600 bg-ink-800/95 py-2 pl-9 pr-3 text-sm text-mist-100 placeholder:text-mist-500 focus:border-royal-500 focus:outline-none [&::-webkit-search-cancel-button]:hidden";

/**
 * Header search that expands from an icon into an input on click: inline on
 * md+ screens, full-width panel under the header on mobile. Submits to
 * /search?q=… via router.push; collapses on Escape or outside click.
 */
export function HeaderSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
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

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = query.trim();
    setOpen(false);
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
  };

  return (
    <div ref={rootRef} className="flex items-center">
      {open ? (
        <>
          {/* md+: inline input growing out of the icon */}
          <form
            role="search"
            onSubmit={submit}
            className="search-expand relative hidden w-64 md:block lg:w-72"
          >
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mist-500"
              aria-hidden="true"
            />
            <input
              autoFocus
              type="search"
              name="q"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.searchPlaceholder}
              aria-label={t.search}
              className={inputClass}
            />
          </form>
          {/* Mobile: full-width panel right under the fixed header */}
          <div className="absolute inset-x-0 top-16 border-b border-ink-600/40 bg-ink-950/95 px-4 py-3 backdrop-blur md:hidden">
            <form role="search" onSubmit={submit} className="relative">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mist-500"
                aria-hidden="true"
              />
              <input
                autoFocus
                type="search"
                name="q"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.searchPlaceholder}
                aria-label={t.search}
                className={inputClass}
              />
            </form>
          </div>
          <button
            type="button"
            aria-label="Хайлтыг хаах"
            onClick={() => setOpen(false)}
            className="rounded-lg p-2 text-mist-300 transition hover:bg-ink-700 hover:text-white md:ml-1"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </>
      ) : (
        <button
          type="button"
          aria-label={t.search}
          aria-expanded={open}
          onClick={() => setOpen(true)}
          className="rounded-lg p-2 text-mist-300 transition hover:bg-ink-700 hover:text-white"
        >
          <Search size={20} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
