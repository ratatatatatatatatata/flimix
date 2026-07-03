"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { PosterCard } from "@/components/catalog/PosterCard";
import { PosterSkeleton } from "@/components/ui/Skeletons";
import { t } from "@/lib/i18n";

export interface SuggestionItem {
  id: string;
  type: "movie" | "series";
  href: string;
  title: string;
  posterUrl: string | null;
  year: number | null;
  ageRating: string | null;
  popularity: number;
}

interface SearchResult {
  id: string;
  slug: string;
  type: "movie" | "series";
  title: string;
  posterUrl: string | null;
  year: number | null;
}

const RECENT_KEY = "flimix_recent_searches";
const RECENT_MAX = 8;

function readRecent(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string").slice(0, RECENT_MAX);
  } catch {
    return [];
  }
}

function writeRecent(items: string[]): void {
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(items.slice(0, RECENT_MAX)));
  } catch {
    // localStorage unavailable — ignore
  }
}

export function SearchClient({
  trending,
  recommendations,
}: {
  trending: string[];
  recommendations: SuggestionItem[];
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setRecent(readRecent());
  }, []);

  const rememberQuery = useCallback((q: string) => {
    const cleaned = q.trim();
    if (cleaned.length < 2) return;
    setRecent((prev) => {
      const next = [cleaned, ...prev.filter((r) => r !== cleaned)].slice(0, RECENT_MAX);
      writeRecent(next);
      return next;
    });
  }, []);

  const clearRecent = useCallback(() => {
    setRecent([]);
    writeRecent([]);
  }, []);

  // Debounced fetch (300ms) with abort of in-flight requests.
  useEffect(() => {
    const q = query.trim();
    if (q.length === 0) {
      setResults(null);
      setLoading(false);
      abortRef.current?.abort();
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Search failed: ${res.status}`);
        const json = (await res.json()) as { results: SearchResult[] };
        setResults(json.results);
        setLoading(false);
        // Remember searches that returned something, shortly after typing stops.
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        if (json.results.length > 0) {
          saveTimerRef.current = setTimeout(() => rememberQuery(q), 1200);
        }
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          setResults([]);
          setLoading(false);
        }
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, rememberQuery]);

  const hasQuery = query.trim().length > 0;
  const noHits = hasQuery && !loading && results !== null && results.length === 0;

  return (
    <div className="mt-6">
      {/* ------------------------------ input ------------------------------ */}
      <div className="relative max-w-2xl">
        <Search
          size={20}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-mist-500"
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.searchPlaceholder}
          aria-label={t.search}
          autoFocus
          className="w-full rounded-xl border border-ink-600 bg-ink-800 py-3.5 pl-12 pr-12 text-base text-mist-100 placeholder:text-mist-500 focus:border-royal-500 [&::-webkit-search-cancel-button]:hidden"
        />
        {hasQuery ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            aria-label="Хайлт цэвэрлэх"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-mist-400 transition hover:bg-ink-700 hover:text-white"
          >
            <X size={18} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {/* --------------------------- no query view -------------------------- */}
      {!hasQuery ? (
        <div className="mt-10 space-y-10">
          {recent.length > 0 ? (
            <section>
              <div className="flex items-baseline justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-mist-400">
                  {t.recentSearches}
                </h2>
                <button
                  type="button"
                  onClick={clearRecent}
                  className="text-sm text-royal-300 transition hover:text-royal-400"
                >
                  Цэвэрлэх
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {recent.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setQuery(r)}
                    className="rounded-full border border-ink-600 bg-ink-800 px-3.5 py-1.5 text-sm text-mist-300 transition hover:border-royal-500/50 hover:text-white"
                  >
                    {r}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {trending.length > 0 ? (
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-mist-400">
                {t.trendingSearches}
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {trending.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setQuery(s)}
                    className="rounded-full border border-royal-600/40 bg-royal-700/20 px-3.5 py-1.5 text-sm text-royal-300 transition hover:bg-royal-700/40 hover:text-white"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <RecommendationGrid title={t.trending} items={recommendations} />
        </div>
      ) : null}

      {/* ---------------------------- loading view --------------------------- */}
      {hasQuery && loading ? (
        <div className="mt-10 grid grid-cols-2 justify-items-center gap-x-3 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <PosterSkeleton key={i} />
          ))}
        </div>
      ) : null}

      {/* ---------------------------- results view --------------------------- */}
      {hasQuery && !loading && results !== null && results.length > 0 ? (
        <div className="mt-10">
          <p className="text-sm text-mist-400" role="status">
            {results.length} илэрц олдлоо
          </p>
          <div className="mt-4 grid grid-cols-2 justify-items-center gap-x-3 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {results.map((r) => (
              <PosterCard
                key={`${r.type}-${r.id}`}
                href={`/${r.type}/${r.slug}`}
                title={r.title}
                posterUrl={r.posterUrl}
                year={r.year}
              />
            ))}
          </div>
        </div>
      ) : null}

      {/* ---------------------------- no hits view --------------------------- */}
      {noHits ? (
        <div className="mt-10 space-y-10">
          <div
            className="rounded-xl border border-dashed border-ink-600 px-6 py-12 text-center"
            role="status"
          >
            <p className="text-lg font-medium text-mist-100">{t.noResults}</p>
            <p className="mt-2 text-sm text-mist-400">
              «{query.trim()}» гэсэн хайлтад тохирох контент олдсонгүй. Өөр
              түлхүүр үгээр хайж үзээрэй.
            </p>
          </div>
          <RecommendationGrid title="Танд санал болгох" items={recommendations} />
        </div>
      ) : null}
    </div>
  );
}

function RecommendationGrid({
  title,
  items,
}: {
  title: string;
  items: SuggestionItem[];
}) {
  if (items.length === 0) return null;
  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-mist-400">
        {title}
      </h2>
      <div className="mt-4 grid grid-cols-2 justify-items-center gap-x-3 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {items.map((item) => (
          <PosterCard
            key={`${item.type}-${item.id}`}
            href={item.href}
            title={item.title}
            posterUrl={item.posterUrl}
            year={item.year}
            ageRating={item.ageRating}
          />
        ))}
      </div>
    </section>
  );
}
