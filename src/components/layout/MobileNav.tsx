"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Menu, X } from "lucide-react";
import type { GenreLink } from "@/components/layout/GenreMenu";

export type MobileNavItem =
  | { kind: "link"; href: string; label: string }
  | { kind: "genres"; label: string; genres: GenreLink[] };

/**
 * Mobile hamburger menu (client). Rendered inside the sticky SiteHeader, so
 * the dropdown panel positions itself against the header element. The
 * "Ангилал" entry expands in place into a two-column genre list.
 */
export function MobileNav({ items }: { items: MobileNavItem[] }) {
  const [open, setOpen] = useState(false);
  const [genresOpen, setGenresOpen] = useState(false);

  const close = () => {
    setOpen(false);
    setGenresOpen(false);
  };

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        aria-label={open ? "Цэс хаах" : "Цэс нээх"}
        onClick={() => (open ? close() : setOpen(true))}
        className="rounded-lg p-2 text-mist-300 transition hover:bg-ink-700 hover:text-white"
      >
        {open ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
      </button>
      {open ? (
        <nav
          id="mobile-nav-panel"
          aria-label="Гар утасны цэс"
          className="absolute inset-x-0 top-16 border-b border-ink-600/40 bg-ink-950/95 shadow-card backdrop-blur"
        >
          <ul className="container-fx space-y-1 py-3">
            {items.map((item) =>
              item.kind === "genres" ? (
                <li key={item.label}>
                  <button
                    type="button"
                    aria-expanded={genresOpen}
                    onClick={() => setGenresOpen((v) => !v)}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm text-mist-100 transition hover:bg-ink-800 hover:text-white"
                  >
                    {item.label}
                    <ChevronDown
                      size={16}
                      aria-hidden="true"
                      className={`transition ${genresOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  {genresOpen ? (
                    <ul className="mt-1 grid grid-cols-2 gap-1 rounded-lg bg-ink-900/70 p-2">
                      {item.genres.map((g) => (
                        <li key={g.slug}>
                          <Link
                            href={`/browse?genre=${g.slug}`}
                            onClick={close}
                            className="block rounded-md px-3 py-2 text-sm text-mist-300 transition hover:bg-ink-800 hover:text-white"
                          >
                            {g.name}
                          </Link>
                        </li>
                      ))}
                      <li>
                        <Link
                          href="/browse"
                          onClick={close}
                          className="block rounded-md px-3 py-2 text-sm text-royal-300 transition hover:bg-ink-800 hover:text-royal-200"
                        >
                          Бүх ангилал →
                        </Link>
                      </li>
                    </ul>
                  ) : null}
                </li>
              ) : (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={close}
                    className="block rounded-lg px-3 py-2.5 text-sm text-mist-100 transition hover:bg-ink-800 hover:text-white"
                  >
                    {item.label}
                  </Link>
                </li>
              ),
            )}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}
