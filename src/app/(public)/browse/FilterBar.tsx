"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { buildBrowseHref, type BrowseFilters, type SortKey } from "@/lib/browse";
import { t } from "@/lib/i18n";

export interface SelectOption {
  value: string;
  label: string;
}

export interface PaginationState {
  page: number;
  hasPrev: boolean;
  hasNext: boolean;
}

/* --------------------------------- pieces ---------------------------------- */

/** Compact ink-800 pill wrapping a native select — the slim-bar filter unit. */
function PillSelect({
  label,
  value,
  active,
  options,
  onChange,
}: {
  label: string;
  value: string;
  active: boolean;
  options: SelectOption[];
  onChange: (value: string) => void;
}) {
  return (
    <label
      className={`relative inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border py-1.5 pl-3.5 pr-3 text-sm transition ${
        active
          ? "border-royal-500/70 bg-ink-800 text-white"
          : "border-ink-600 bg-ink-800 text-mist-300 hover:border-royal-500/50 hover:text-white"
      }`}
    >
      <span className="text-[10px] font-medium uppercase tracking-wide text-mist-500">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="max-w-36 cursor-pointer appearance-none truncate bg-transparent pr-4 text-sm font-medium outline-none [&>option]:bg-ink-800 [&>option]:text-mist-100"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={13}
        className="pointer-events-none absolute right-2.5 text-mist-500"
        aria-hidden="true"
      />
    </label>
  );
}

/* --------------------------------- filter bar ------------------------------ */

/**
 * Slim /browse top bar: page title on the left, compact dropdown pills
 * (Контент / Төрөл / Он / Эрэмбэ) on the right, then the server-rendered
 * results as children.
 *
 * Navigation happens with router.push inside useTransition: the URL keeps the
 * exact same searchParams semantics (type, genre, year, legacy decade, sort,
 * page — shareable, server-rendered), while the results dim under a small
 * spinner until the next server render streams in.
 */
export function FilterBar({
  filters,
  title,
  count,
  genres,
  years,
  pagination,
  children,
}: {
  filters: BrowseFilters;
  title: string;
  count?: number;
  genres: SelectOption[];
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

  const sortOptions: SelectOption[] = [
    { value: "newest", label: t.sortNewest },
    { value: "popular", label: t.sortPopular },
    { value: "rating", label: t.sortRating },
    { value: "title", label: t.sortTitle },
  ];

  // Year select carries the legacy ?decade value as a "d{decade}" option so
  // old URLs stay representable in the new UI.
  const yearValue = f.year ? String(f.year) : f.decade ? `d${f.decade}` : "";
  const yearOptions: SelectOption[] = [
    { value: "", label: "Бүх он" },
    ...(f.decade ? [{ value: `d${f.decade}`, label: `${f.decade}-аад он` }] : []),
    ...years.map((y) => ({ value: String(y), label: String(y) })),
  ];
  const onYearChange = (v: string) => {
    if (!v) {
      go({ year: null, decade: null });
    } else if (v.startsWith("d")) {
      go({ decade: Number(v.slice(1)), year: null });
    } else {
      go({ year: Number(v), decade: null });
    }
  };

  const pagerButton =
    "inline-flex items-center gap-1.5 rounded-lg border border-ink-600 bg-ink-800 px-4 py-2 text-sm text-mist-100 transition hover:border-royal-500/60";
  const pagerDisabled =
    "inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-ink-600/50 px-4 py-2 text-sm text-mist-500";

  return (
    <>
      {/* ------------------------------ slim bar ---------------------------- */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
        <div className="flex items-baseline gap-3">
          <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">
            {title}
          </h1>
          {typeof count === "number" ? (
            <p className="text-sm text-mist-500">Нийт {count} контент</p>
          ) : null}
        </div>
        <div className="row-scroll -mx-4 flex max-w-full gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          <PillSelect
            label="Контент"
            value={f.type}
            active={f.type !== "all"}
            options={[
              { value: "all", label: "Бүгд" },
              { value: "movie", label: t.movies },
              { value: "series", label: t.multiPart },
            ]}
            onChange={(v) =>
              go({ type: v === "movie" || v === "series" ? v : "all" })
            }
          />
          {genres.length > 0 ? (
            <PillSelect
              label={t.genre}
              value={f.genre ?? ""}
              active={!!f.genre}
              options={[{ value: "", label: "Бүгд" }, ...genres]}
              onChange={(v) => go({ genre: v || null })}
            />
          ) : null}
          {years.length > 0 || f.decade ? (
            <PillSelect
              label={t.year}
              value={yearValue}
              active={!!f.year || !!f.decade}
              options={yearOptions}
              onChange={onYearChange}
            />
          ) : null}
          <PillSelect
            label="Эрэмбэ"
            value={f.sort}
            active={f.sort !== "newest"}
            options={sortOptions}
            onChange={(v) => go({ sort: v as SortKey })}
          />
        </div>
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
