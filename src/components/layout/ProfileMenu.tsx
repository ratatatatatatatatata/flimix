"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, History, LogOut, Star, User } from "lucide-react";
import { t } from "@/lib/i18n";

interface ProfileMenuProps {
  /** Single display letter for the avatar circle. */
  initial: string;
  /** Server action that signs the user out (passed from SiteHeader). */
  signOutAction: () => Promise<void>;
}

/**
 * Signed-in profile menu: brand-gradient avatar circle that opens a dropdown
 * with account shortcuts and a sign-out form. Closes on outside click,
 * Escape or navigation.
 */
export function ProfileMenu({ initial, signOutAction }: ProfileMenuProps) {
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

  const itemClass =
    "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-mist-300 transition hover:bg-ink-700/70 hover:text-white";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={t.myAccount}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 rounded-full p-0.5 transition hover:brightness-110"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-gradient text-sm font-bold text-white shadow-accent">
          {initial}
        </span>
        <ChevronDown
          size={14}
          aria-hidden="true"
          className={`hidden text-mist-300 transition sm:block ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-50 w-56 pt-3">
          <div className="rounded-xl border border-ink-600/50 bg-ink-900/95 p-2 shadow-card backdrop-blur">
            <Link href="/account" onClick={() => setOpen(false)} className={itemClass}>
              <User size={16} aria-hidden="true" />
              {t.myAccount}
            </Link>
            <Link
              href="/account/favorites"
              onClick={() => setOpen(false)}
              className={itemClass}
            >
              <Star size={16} aria-hidden="true" />
              {t.myList}
            </Link>
            <Link
              href="/account/history"
              onClick={() => setOpen(false)}
              className={itemClass}
            >
              <History size={16} aria-hidden="true" />
              {t.watchHistory}
            </Link>
            <div className="my-2 border-t border-ink-600/40" aria-hidden="true" />
            <form action={signOutAction}>
              <button type="submit" className={`${itemClass} w-full`}>
                <LogOut size={16} aria-hidden="true" />
                {t.signOut}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
