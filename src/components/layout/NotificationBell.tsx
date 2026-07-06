"use client";

import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { formatShortDateMn } from "@/lib/i18n";

export interface HeaderNotification {
  id: string;
  title_mn: string;
  body_mn: string | null;
  created_at: string;
  read_at: string | null;
}

/**
 * Header notification bell (signed-in users only — SiteHeader simply does not
 * render it for guests). Shows an unread dot when any notification is unread
 * and a glass dropdown with the latest five. Closes on outside click/Escape.
 */
export function NotificationBell({
  notifications,
}: {
  notifications: HeaderNotification[];
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const hasUnread = notifications.some((n) => n.read_at === null);

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

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="Мэдэгдэл"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-lg p-2 text-mist-300 transition hover:bg-ink-700 hover:text-white"
      >
        <Bell size={20} aria-hidden="true" />
        {hasUnread ? (
          <span
            aria-hidden="true"
            className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-royal-400 ring-2 ring-ink-950"
          />
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-50 w-80 pt-3">
          <div className="glass rounded-xl p-2 shadow-card">
            <p className="px-3 pb-2 pt-1.5 text-xs font-semibold uppercase tracking-wide text-mist-400">
              Мэдэгдэл
            </p>
            {notifications.length === 0 ? (
              <p className="px-3 pb-4 pt-2 text-center text-sm text-mist-500">
                Мэдэгдэл алга
              </p>
            ) : (
              <ul className="space-y-0.5">
                {notifications.map((n) => (
                  <li
                    key={n.id}
                    className="rounded-lg px-3 py-2.5 transition hover:bg-ink-700/50"
                  >
                    <div className="flex items-start gap-2.5">
                      {n.read_at === null ? (
                        <span
                          aria-hidden="true"
                          className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-royal-400"
                        />
                      ) : (
                        <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p
                          className={`line-clamp-1 text-sm ${
                            n.read_at === null ? "font-medium text-white" : "text-mist-300"
                          }`}
                        >
                          {n.title_mn}
                        </p>
                        {n.body_mn ? (
                          <p className="mt-0.5 line-clamp-2 text-xs text-mist-400">
                            {n.body_mn}
                          </p>
                        ) : null}
                        <p className="mt-1 text-[11px] text-mist-500">
                          {formatShortDateMn(n.created_at)}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
