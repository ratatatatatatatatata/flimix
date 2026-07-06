"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { t } from "@/lib/i18n";

export interface SeasonTab {
  id: string;
  seasonNumber: number;
}

/**
 * Season tabs for the series page. Switching seasons keeps the exact same URL
 * semantics (?season=N via router.push) but runs inside useTransition: the tab
 * highlights instantly and the server-rendered episode list (children) dims
 * under a spinner until the new season streams in.
 */
export function SeasonSelector({
  seasons,
  activeSeasonNumber,
  basePath,
  children,
}: {
  seasons: SeasonTab[];
  activeSeasonNumber: number | null;
  basePath: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingSeason, setPendingSeason] = useState<number | null>(null);

  // Optimistic highlight: show the tapped tab as active while the new
  // server render is streaming in.
  const shownSeason =
    isPending && pendingSeason !== null ? pendingSeason : activeSeasonNumber;

  const select = (seasonNumber: number) => {
    if (seasonNumber === activeSeasonNumber && !isPending) return;
    setPendingSeason(seasonNumber);
    startTransition(() => {
      router.push(`${basePath}?season=${seasonNumber}`, { scroll: false });
    });
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="font-display text-lg font-semibold text-white sm:text-xl">
          {t.episode}
        </h2>
        {seasons.length > 1 ? (
          <nav className="row-scroll flex gap-2 overflow-x-auto" aria-label={t.season}>
            {seasons.map((s) => {
              const active = shownSeason === s.seasonNumber;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => select(s.seasonNumber)}
                  aria-current={active ? "page" : undefined}
                  className={`shrink-0 rounded-full border px-4 py-1.5 text-sm transition ${
                    active
                      ? "border-royal-500 bg-royal-500 font-medium text-white"
                      : "border-ink-600 bg-ink-800 text-mist-300 hover:border-royal-500/50 hover:text-white"
                  }`}
                >
                  {t.season} {s.seasonNumber}
                </button>
              );
            })}
          </nav>
        ) : null}
      </div>

      <div className="relative" aria-busy={isPending}>
        <div
          className={`transition-opacity duration-200 ${
            isPending ? "pointer-events-none opacity-40" : "opacity-100"
          }`}
        >
          {children}
        </div>
        {isPending ? (
          <div className="absolute inset-0 z-10 flex items-start justify-center pt-16">
            <span
              role="status"
              className="inline-flex items-center gap-2 rounded-full border border-ink-600 bg-ink-800/95 px-4 py-2 text-sm text-mist-100 shadow-card"
            >
              <Loader2 size={16} className="animate-spin text-royal-400" aria-hidden="true" />
              {t.loading}
            </span>
          </div>
        ) : null}
      </div>
    </>
  );
}
