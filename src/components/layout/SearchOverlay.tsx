"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "framer-motion";
import { Clock3, Film, Search, X } from "lucide-react";
import { t } from "@/lib/i18n";

interface SearchResult {
  id: string;
  slug: string;
  type: "movie" | "series";
  title: string;
  posterUrl: string | null;
  year: number | null;
}

export interface SearchOverlayProps {
  open: boolean;
  onClose: () => void;
  /** Optional trending titles rendered as suggestion chips when idle. */
  trending?: { title: string }[];
}

/* Same localStorage contract as SearchClient — keep read/write compatible. */
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

const chipClass =
  "rounded-full border border-ink-600 bg-ink-800/80 px-3.5 py-1.5 text-sm text-mist-300 transition hover:border-royal-500/50 hover:text-white";

/**
 * Full-screen cinematic search overlay: fades in over the page, slides its
 * content up, and shows instant results (300ms debounce → /api/search) in a
 * staggered grid. Idle state shows recent + trending searches. Locks body
 * scroll, closes on Escape / X / backdrop click, restores focus on close.
 */
export function SearchOverlay({ open, onClose, trending = [] }: SearchOverlayProps) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  /* Open/close side effects: scroll lock, Escape, focus in/out. */
  useEffect(() => {
    if (!open) return;
    lastFocusedRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setRecent(readRecent());
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const raf = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKeyDown);
      window.cancelAnimationFrame(raf);
      lastFocusedRef.current?.focus();
    };
  }, [open, onClose]);

  /* Reset transient state whenever the overlay closes. */
  useEffect(() => {
    if (open) return;
    setQuery("");
    setResults(null);
    setLoading(false);
    abortRef.current?.abort();
  }, [open]);

  const rememberQuery = useCallback((q: string) => {
    const cleaned = q.trim();
    if (cleaned.length < 2) return;
    setRecent((prev) => {
      const next = [cleaned, ...prev.filter((r) => r !== cleaned)].slice(0, RECENT_MAX);
      writeRecent(next);
      return next;
    });
  }, []);

  /* Debounced instant search (300ms), aborting in-flight requests. */
  useEffect(() => {
    if (!open) return;
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
  }, [query, open, rememberQuery]);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = query.trim();
    rememberQuery(q);
    onClose();
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
  };

  const onResultClick = () => {
    rememberQuery(query);
    onClose();
  };

  const hasQuery = query.trim().length > 0;
  const noHits = hasQuery && !loading && results !== null && results.length === 0;

  const gridVariants: Variants = {
    hidden: {},
    show: { transition: reduceMotion ? undefined : { staggerChildren: 0.04 } },
  };
  const itemVariants: Variants = {
    hidden: reduceMotion ? { opacity: 0 } : { opacity: 0, y: 14 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: reduceMotion ? 0 : 0.3, ease: "easeOut" },
    },
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="flimix-search-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={t.search}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.2 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
          className="fixed inset-0 z-50 overflow-y-auto bg-ink-950/95 backdrop-blur-md"
        >
          <motion.div
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
            transition={{ duration: reduceMotion ? 0 : 0.3, ease: "easeOut" }}
            className="container-fx pb-16 pt-4 sm:pt-6"
          >
            <div className="flex justify-end">
              <button
                type="button"
                aria-label="Хайлтыг хаах"
                onClick={onClose}
                className="rounded-full p-2.5 text-mist-300 transition hover:bg-ink-700 hover:text-white"
              >
                <X size={26} aria-hidden="true" />
              </button>
            </div>

            {/* ----------------------------- input ----------------------------- */}
            <form role="search" onSubmit={submit} className="relative mx-auto mt-2 max-w-3xl">
              <Search
                size={22}
                className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-mist-500"
                aria-hidden="true"
              />
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.searchPlaceholder}
                aria-label={t.search}
                className="w-full rounded-2xl border border-ink-600 bg-ink-800/80 py-4 pl-14 pr-14 text-xl text-white placeholder:text-mist-500 focus:border-royal-500 focus:outline-none sm:py-5 sm:text-2xl [&::-webkit-search-cancel-button]:hidden"
              />
              {hasQuery ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    inputRef.current?.focus();
                  }}
                  aria-label="Хайлт цэвэрлэх"
                  className="absolute right-4 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-mist-400 transition hover:bg-ink-700 hover:text-white"
                >
                  <X size={20} aria-hidden="true" />
                </button>
              ) : null}
            </form>

            {/* -------------------------- idle state --------------------------- */}
            {!hasQuery ? (
              <div className="mx-auto mt-10 max-w-3xl space-y-8">
                {recent.length > 0 ? (
                  <section aria-label={t.recentSearches}>
                    <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-mist-400">
                      <Clock3 size={15} aria-hidden="true" />
                      {t.recentSearches}
                    </h2>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {recent.map((r) => (
                        <button key={r} type="button" onClick={() => setQuery(r)} className={chipClass}>
                          {r}
                        </button>
                      ))}
                    </div>
                  </section>
                ) : null}
                {trending.length > 0 ? (
                  <section aria-label={t.trendingSearches}>
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-mist-400">
                      {t.trendingSearches}
                    </h2>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {trending.map((s) => (
                        <button
                          key={s.title}
                          type="button"
                          onClick={() => setQuery(s.title)}
                          className="rounded-full border border-royal-600/40 bg-royal-700/20 px-3.5 py-1.5 text-sm text-royal-300 transition hover:bg-royal-700/40 hover:text-white"
                        >
                          {s.title}
                        </button>
                      ))}
                    </div>
                  </section>
                ) : null}
                {recent.length === 0 && trending.length === 0 ? (
                  <p className="text-center text-sm text-mist-500">
                    Кино, цуврал, жүжигчний нэрээр хайж эхлээрэй.
                  </p>
                ) : null}
              </div>
            ) : null}

            {/* ------------------------- loading state ------------------------- */}
            {hasQuery && loading ? (
              <div className="mx-auto mt-10 grid max-w-5xl grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 md:grid-cols-5 lg:grid-cols-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="skeleton aspect-[2/3] w-full" />
                ))}
              </div>
            ) : null}

            {/* ------------------------- results grid -------------------------- */}
            {hasQuery && !loading && results !== null && results.length > 0 ? (
              <div className="mx-auto mt-10 max-w-5xl">
                <p className="text-sm text-mist-400" role="status">
                  {results.length} илэрц олдлоо
                </p>
                <motion.ul
                  variants={gridVariants}
                  initial="hidden"
                  animate="show"
                  className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 md:grid-cols-5 lg:grid-cols-6"
                >
                  {results.map((r) => (
                    <motion.li key={`${r.type}-${r.id}`} variants={itemVariants}>
                      <Link
                        href={`/${r.type}/${r.slug}`}
                        onClick={onResultClick}
                        className="group block"
                      >
                        <div className="aspect-[2/3] overflow-hidden rounded-lg border border-ink-600/40 bg-ink-800">
                          {r.posterUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={r.posterUrl}
                              alt=""
                              loading="lazy"
                              className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-mist-500">
                              <Film size={28} aria-hidden="true" />
                            </div>
                          )}
                        </div>
                        <p className="mt-2 line-clamp-1 text-sm text-mist-100 transition group-hover:text-white">
                          {r.title}
                        </p>
                        {r.year !== null ? (
                          <p className="text-xs text-mist-500">{r.year}</p>
                        ) : null}
                      </Link>
                    </motion.li>
                  ))}
                </motion.ul>
              </div>
            ) : null}

            {/* --------------------------- no hits ----------------------------- */}
            {noHits ? (
              <div
                className="mx-auto mt-10 max-w-3xl rounded-xl border border-dashed border-ink-600 px-6 py-12 text-center"
                role="status"
              >
                <p className="text-lg font-medium text-mist-100">{t.noResults}</p>
                <p className="mt-2 text-sm text-mist-400">
                  «{query.trim()}» гэсэн хайлтад тохирох контент олдсонгүй. Өөр түлхүүр
                  үгээр хайж үзээрэй.
                </p>
              </div>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
