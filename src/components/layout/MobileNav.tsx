"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

export interface MobileNavItem {
  href: string;
  label: string;
}

/**
 * Mobile hamburger menu (client). Rendered inside the sticky SiteHeader, so
 * the dropdown panel positions itself against the header element.
 */
export function MobileNav({ items }: { items: MobileNavItem[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        aria-label={open ? "Цэс хаах" : "Цэс нээх"}
        onClick={() => setOpen((v) => !v)}
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
            {items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-2.5 text-sm text-mist-100 transition hover:bg-ink-800 hover:text-white"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}
