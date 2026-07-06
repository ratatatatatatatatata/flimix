"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Clapperboard, Home, Search, Tv, User } from "lucide-react";
import { SearchOverlay } from "@/components/layout/SearchOverlay";
import { t } from "@/lib/i18n";

/**
 * Fixed bottom tab bar for phones (hidden on md+). Five tabs: home, movies,
 * series, search (opens the full-screen SearchOverlay) and profile. Active
 * tab is highlighted in royal purple; safe-area inset padded for notched
 * devices. Rendered from (public)/layout.tsx inside a Suspense boundary
 * because it reads useSearchParams.
 */
export function MobileBottomNav({ isLoggedIn }: { isLoggedIn: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [searchOpen, setSearchOpen] = useState(false);
  const browseType = searchParams.get("type");

  const profileHref = isLoggedIn ? "/account" : "/login";

  const links: {
    href: string;
    label: string;
    icon: typeof Home;
    active: boolean;
  }[] = [
    { href: "/", label: t.home, icon: Home, active: pathname === "/" },
    {
      href: "/browse?type=movie",
      label: t.movies,
      icon: Clapperboard,
      active: pathname.startsWith("/browse") && browseType === "movie",
    },
    {
      href: "/browse?type=series",
      label: t.series,
      icon: Tv,
      active: pathname.startsWith("/browse") && browseType === "series",
    },
  ];

  const itemClass = (active: boolean) =>
    `flex flex-1 flex-col items-center gap-0.5 pb-1.5 pt-2 text-[11px] leading-4 transition ${
      active ? "text-royal-400" : "text-mist-400 hover:text-white"
    }`;

  return (
    <>
      <nav
        aria-label="Доод цэс"
        className="glass fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <div className="flex items-stretch">
          {links.map(({ href, label, icon: Icon, active }) => (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={itemClass(active)}
            >
              <Icon size={20} aria-hidden="true" />
              {label}
            </Link>
          ))}
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={searchOpen}
            onClick={() => setSearchOpen(true)}
            className={itemClass(searchOpen)}
          >
            <Search size={20} aria-hidden="true" />
            {t.search}
          </button>
          <Link
            href={profileHref}
            aria-current={pathname.startsWith(profileHref) ? "page" : undefined}
            className={itemClass(pathname.startsWith(profileHref))}
          >
            <User size={20} aria-hidden="true" />
            Профайл
          </Link>
        </div>
      </nav>
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
