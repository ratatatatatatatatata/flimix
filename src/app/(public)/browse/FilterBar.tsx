"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import {
  DECADES,
  buildBrowseHref,
  type BrowseFilters,
  type SortKey,
} from "@/lib/browse";
import { t } from "@/lib/i18n";

interface ChipOption {
  key: string;
  label: string;
  value: string;
}

export interface PaginationState {
  page: number;
  hasPrev: boolean;
  hasNext: boolean;
}

/* --------------------------------- pieces ---------------------------------- */

function Chip({
  active,
  onSelect,
  children,
}: {
  active: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onSelect}
      className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm transition ${
        active
          ? "border-royal-500 bg-royal-500 font-medium text-white"
          : "border-ink-600 bg-ink-800 text-mist-300 hover:border-royal-500/50 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function ChipRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-16 shrink-0 text-xs font-medium uppercase tracking-wide text-mist-500">
        {label}
      </span>
      <div className="row-scroll flex gap-2 overflow-x-auto pb-1">{children}</div>
    </div>
  );
}

/* --------------------------------- filter bar ------------------------------ */

/**
 * Filter chips + sort + pagination for /browse.
 *
 * Navigation happens with router.push inside useTransition: the URL keeps the
 * exact same searchParams semantics (shareable, server-rendered), but the user
 * gets INSTANT feedback — chips stay interactive and the results grid dims
 * under a small spinner while the next server render streams in.
 */
export function FilterBar({
  filters,
  genres,
  countries,
  languages,
  years,
  pagination,
  children,
}: {
  filters: BrowseFilters;
  genres: ChipOption[];
  countries: ChipOption[];
  languages: ChipOption[];
  years: number[];
  pagination: PaginationState | null;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const f = filters;

  const go = (patch: Partial<BrowseFilters>) => {
    const href = buildBrowseHref(f, patch);
    startTransition(() => {
      router.push(href, { scroll: false });
    });
  };

  const sortOptions: { key: SortKey; label: string }[] = [
    { key: "newest", label: t.sortNewest },
    { key: "popular", label: t.sortPopular },
    { key: "rating", label: t.sortRating },
    { key: "title", label: t.sortTitle },
  ];

  const pagerButton =
    "inline-flex items-center gap-1.5 rounded-lg border border-ink-600 bg-ink-800 px-4 py-2 text-sm text-mist-100 transition hover:border-royal-500/60";
  const pagerDisabled =
    "inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-ink-600/50 px-4 py-2 text-sm text-mist-500";

  return (
    <>
      {/* --------------------------- filter chips --------------------------- */}
      <div className="mt-8 space-y-3">
        <ChipRow label="Контент">
          <Chip active={f.type === "all"} onSelect={() => go({ type: "all" })}>
            Бүгд
          </Chip>
          <Chip active={f.type === "movie"} onSelect={() => go({ type: "movie" })}>
            {t.movies}
          </Chip>
          <Chip active={f.type === "series"} onSelect={() => go({ type: "series" })}>
            {t.series}
          </Chip>
        </ChipRow>

        {genres.length > 0 ? (
          <ChipRow label={t.genre}>
            <Chip active={!f.genre} onSelect={() => go({ genre: null })}>
              Бүгд
            </Chip>
            {genres.map((g) => (
              <Chip
                key={g.key}
                active={f.genre === g.value}
                onSelect={() => go({ genre: g.value })}
              >
                {g.label}
              </Chip>
            ))}
          </ChipRow>
        ) : null}

        {countries.length > 0 ? (
          <ChipRow label={t.country}>
            <Chip active={!f.country} onSelect={() => go({ country: null })}>
              Бүгд
            </Chip>
            {countries.map((c) => (
              <Chip
                key={c.key}
                active={f.country === c.value}
                onSelect={() => go({ country: c.value })}
              >
                {c.label}
              </Chip>
            ))}
          </ChipRow>
        ) : null}

        <ChipRow label={t.year}>
          {years.length > 0 ? (
            <select
              value={f.year ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                go({ year: v ? Number(v) : null, decade: null });
              }}
              aria-label={t.year}
              className={`h-[34px] shrink-0 cursor-pointer rounded-full border px-3.5 text-sm outline-none transition ${
                f.year
                  ? "border-royal-500 bg-royal-500 font-medium text-white"
                  : "border-ink-600 bg-ink-800 text-mist-300 hover:border-royal-500/50 hover:text-white"
              }`}
            >
              <option value="">Бүх он</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          ) : null}
          <Chip
            active={!f.decade && !f.year}
            onSelect={() => go({ decade: null, year: null })}
          >
            Бүгд
          </Chip>
          {DECADES.map((d) => (
            <Chip
              key={d}
              active={f.decade === d}
              onSelect={() => go({ decade: d, year: null })}
            >
              {d}-аад он
            </Chip>
          ))}
        </ChipRow>

        {languages.length > 0 ? (
          <ChipRow label={t.subtitles}>
            <Chip active={!f.sub} onSelect={() => go({ sub: null })}>
              Бүгд
            </Chip>
            {languages.map((l) => (
              <Chip
                key={l.key}
                active={f.sub === l.value}
                onSelect={() => go({ sub: l.value })}
              >
                {l.label}
              </Chip>
            ))}
          </ChipRow>
        ) : null}

        <ChipRow label="Эрэмбэ">
          {sortOptions.map((s) => (
            <Chip
              key={s.key}
              active={f.sort === s.key}
              onSelect={() => go({ sort: s.key })}
            >
              {s.label}
            </Chip>
          ))}
        </ChipRow>
      </div>

      {/* --------------------- results (dimmed while pending) ---------------- */}
      <div className="relative" aria-busy={isPending}>
        <div
          className={`transition-opacity duration-200 ${
            isPending ? "pointer-events-none opacity-40" : "opacity-100"
          }`}
        >
          {children}

          {pagination ? (
            <nav
              className="mt-12 flex items-center justify-center gap-4"
              aria-label="Хуудаслалт"
            >
              {pagination.hasPrev ? (
                <button
                  type="button"
                  onClick={() => go({ page: pagination.page - 1 })}
                  className={pagerButton}
                >
                  <ChevronLeft size={16} aria-hidden="true" /> Өмнөх
                </button>
              ) : (
                <span className={pagerDisabled}>
                  <ChevronLeft size={16} aria-hidden="true" /> Өмнөх
                </span>
              )}
              <span className="text-sm text-mist-400">Хуудас {pagination.page}</span>
              {pagination.hasNext ? (
                <button
                  type="button"
                  onClick={() => go({ page: pagination.page + 1 })}
                  className={pagerButton}
                >
                  Дараах <ChevronRight size={16} aria-hidden="true" />
                </button>
              ) : (
                <span className={pagerDisabled}>
                  Дараах <ChevronRight size={16} aria-hidden="true" />
                </span>
              )}
            </nav>
          ) : null}
        </div>

        {isPending ? (
          <div className="absolute inset-0 z-10 flex items-start justify-center pt-24">
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
