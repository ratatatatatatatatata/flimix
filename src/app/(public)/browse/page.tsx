import Link from "next/link";
import type { Metadata } from "next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PosterCard } from "@/components/catalog/PosterCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import type { Country, Genre, Language, Movie, Series } from "@/types/db";

export const metadata: Metadata = {
  title: "Ангилал",
  description: "FLIMIX-ийн бүх кино, цувралыг төрөл, улс, оноор шүүж үзээрэй.",
};

type Db = Awaited<ReturnType<typeof createClient>>;
type SearchParams = Record<string, string | string[] | undefined>;

const PAGE_SIZE = 24;
const DECADES = [2020, 2010, 2000, 1990, 1980] as const;

type ContentTypeFilter = "all" | "movie" | "series";
type SortKey = "newest" | "popular" | "rating" | "title";

interface Filters {
  type: ContentTypeFilter;
  genre: string | null;
  country: string | null;
  decade: number | null;
  sub: string | null;
  sort: SortKey;
  page: number;
}

function first(v: string | string[] | undefined): string | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

function parseFilters(sp: SearchParams): Filters {
  const typeRaw = first(sp.type);
  const sortRaw = first(sp.sort);
  const decadeRaw = Number(first(sp.decade));
  const pageRaw = Number(first(sp.page));
  return {
    type: typeRaw === "movie" || typeRaw === "series" ? typeRaw : "all",
    genre: first(sp.genre),
    country: first(sp.country),
    decade: DECADES.includes(decadeRaw as (typeof DECADES)[number]) ? decadeRaw : null,
    sub: first(sp.sub),
    sort:
      sortRaw === "popular" || sortRaw === "rating" || sortRaw === "title"
        ? sortRaw
        : "newest",
    page: Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1,
  };
}

/** Build a /browse href from current filters + patch; resets page unless patched. */
function buildHref(f: Filters, patch: Partial<Filters>): string {
  const next: Filters = { ...f, ...patch, page: patch.page ?? 1 };
  const params = new URLSearchParams();
  if (next.type !== "all") params.set("type", next.type);
  if (next.genre) params.set("genre", next.genre);
  if (next.country) params.set("country", next.country);
  if (next.decade) params.set("decade", String(next.decade));
  if (next.sub) params.set("sub", next.sub);
  if (next.sort !== "newest") params.set("sort", next.sort);
  if (next.page > 1) params.set("page", String(next.page));
  const qs = params.toString();
  return qs ? `/browse?${qs}` : "/browse";
}

/* ------------------------------ data fetching ------------------------------ */

interface SubtitleScope {
  movieIds: string[];
  seriesIds: string[];
}

/** Resolve subtitle-language filter into concrete content ids (movies + series). */
async function resolveSubtitleScope(db: Db, code: string): Promise<SubtitleScope> {
  const empty: SubtitleScope = { movieIds: [], seriesIds: [] };
  const { data: lang } = await db
    .from("languages")
    .select("id")
    .eq("code", code)
    .maybeSingle();
  if (!lang) return empty;

  const { data: tracks } = await db
    .from("subtitle_tracks")
    .select("content_type, content_id")
    .eq("language_id", (lang as { id: string }).id)
    .limit(2000);
  const rows = (tracks ?? []) as { content_type: string; content_id: string }[];
  const movieIds = [...new Set(rows.filter((r) => r.content_type === "movie").map((r) => r.content_id))];
  const episodeIds = rows.filter((r) => r.content_type === "episode").map((r) => r.content_id);

  let seriesIds: string[] = [];
  if (episodeIds.length > 0) {
    const { data: eps } = await db
      .from("episodes")
      .select("season_id")
      .in("id", episodeIds);
    const seasonIds = [...new Set(((eps ?? []) as { season_id: string }[]).map((e) => e.season_id))];
    if (seasonIds.length > 0) {
      const { data: seasons } = await db
        .from("seasons")
        .select("series_id")
        .in("id", seasonIds);
      seriesIds = [...new Set(((seasons ?? []) as { series_id: string }[]).map((s) => s.series_id))];
    }
  }
  return { movieIds, seriesIds };
}

interface PagedResult<T> {
  items: T[];
  count: number;
}

async function queryTable<T>(
  db: Db,
  table: "movies" | "series",
  f: Filters,
  idFilter: string[] | null,
  from: number,
  to: number,
): Promise<PagedResult<T>> {
  if (idFilter !== null && idFilter.length === 0) return { items: [], count: 0 };

  const junction = table === "movies" ? "movie_genres" : "series_genres";
  const selectParts = ["*"];
  if (f.genre) selectParts.push(`${junction}!inner(genres!inner(slug))`);
  if (f.country) selectParts.push("countries!inner(code)");

  let q = db
    .from(table)
    .select(selectParts.join(", "), { count: "exact" })
    .eq("status", "published")
    .is("deleted_at", null);

  if (f.genre) q = q.eq(`${junction}.genres.slug`, f.genre);
  if (f.country) q = q.eq("countries.code", f.country);
  if (f.decade) q = q.gte("release_year", f.decade).lte("release_year", f.decade + 9);
  if (idFilter !== null) q = q.in("id", idFilter);

  const ordered =
    f.sort === "popular"
      ? q.order("popularity", { ascending: false })
      : f.sort === "rating"
        ? q.order("rating", { ascending: false, nullsFirst: false })
        : f.sort === "title"
          ? q.order("title_mn", { ascending: true })
          : q.order("published_at", { ascending: false, nullsFirst: false });

  const { data, count } = await ordered.range(from, to);
  return { items: (data ?? []) as unknown as T[], count: count ?? 0 };
}

/* ---------------------------------- page ----------------------------------- */

interface CardItem {
  key: string;
  href: string;
  title: string;
  posterUrl: string | null;
  year: number | null;
  ageRating: string | null;
  isFree?: boolean;
}

function Chip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm transition ${
        active
          ? "border-royal-500 bg-royal-500 font-medium text-white"
          : "border-ink-600 bg-ink-800 text-mist-300 hover:border-royal-500/50 hover:text-white"
      }`}
    >
      {children}
    </Link>
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

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const f = parseFilters(sp);
  const db = await createClient();

  const [genresRes, countriesRes, languagesRes, subScope] = await Promise.all([
    db.from("genres").select("*").order("name_mn"),
    db.from("countries").select("*").order("name_mn").limit(40),
    db.from("languages").select("*").order("name_mn").limit(20),
    f.sub ? resolveSubtitleScope(db, f.sub) : Promise.resolve(null),
  ]);
  const genres = (genresRes.data ?? []) as unknown as Genre[];
  const countries = (countriesRes.data ?? []) as unknown as Country[];
  const languages = (languagesRes.data ?? []) as unknown as Language[];

  // Pagination: single-type pages take the full page, "all" splits it evenly.
  const half = PAGE_SIZE / 2;
  const perTable = f.type === "all" ? half : PAGE_SIZE;
  const from = (f.page - 1) * perTable;
  const to = from + perTable - 1;

  const wantMovies = f.type !== "series";
  const wantSeries = f.type !== "movie";

  const [moviesRes, seriesRes] = await Promise.all([
    wantMovies
      ? queryTable<Movie>(db, "movies", f, subScope ? subScope.movieIds : null, from, to)
      : Promise.resolve({ items: [] as Movie[], count: 0 }),
    wantSeries
      ? queryTable<Series>(db, "series", f, subScope ? subScope.seriesIds : null, from, to)
      : Promise.resolve({ items: [] as Series[], count: 0 }),
  ]);

  const cards: CardItem[] = [
    ...moviesRes.items.map((m) => ({
      key: `movie-${m.id}`,
      href: `/movie/${m.slug}`,
      title: m.title_mn,
      posterUrl: m.poster_url,
      year: m.release_year,
      ageRating: m.age_rating,
      isFree: m.is_free,
    })),
    ...seriesRes.items.map((s) => ({
      key: `series-${s.id}`,
      href: `/series/${s.slug}`,
      title: s.title_mn,
      posterUrl: s.poster_url,
      year: s.release_year,
      ageRating: s.age_rating,
    })),
  ];

  const totalCount = moviesRes.count + seriesRes.count;
  const hasPrev = f.page > 1;
  const hasNext =
    f.page * perTable < moviesRes.count || f.page * perTable < seriesRes.count;

  const sortOptions: { key: SortKey; label: string }[] = [
    { key: "newest", label: t.sortNewest },
    { key: "popular", label: t.sortPopular },
    { key: "rating", label: t.sortRating },
    { key: "title", label: t.sortTitle },
  ];

  return (
    <div className="container-fx py-10 sm:py-12">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">
          {t.categories}
        </h1>
        <p className="text-sm text-mist-500">Нийт {totalCount} контент</p>
      </div>

      {/* --------------------------- filter chips --------------------------- */}
      <div className="mt-8 space-y-3">
        <ChipRow label="Контент">
          <Chip href={buildHref(f, { type: "all" })} active={f.type === "all"}>
            Бүгд
          </Chip>
          <Chip href={buildHref(f, { type: "movie" })} active={f.type === "movie"}>
            {t.movies}
          </Chip>
          <Chip href={buildHref(f, { type: "series" })} active={f.type === "series"}>
            {t.series}
          </Chip>
        </ChipRow>

        {genres.length > 0 ? (
          <ChipRow label={t.genre}>
            <Chip href={buildHref(f, { genre: null })} active={!f.genre}>
              Бүгд
            </Chip>
            {genres.map((g) => (
              <Chip
                key={g.id}
                href={buildHref(f, { genre: g.slug })}
                active={f.genre === g.slug}
              >
                {g.name_mn}
              </Chip>
            ))}
          </ChipRow>
        ) : null}

        {countries.length > 0 ? (
          <ChipRow label={t.country}>
            <Chip href={buildHref(f, { country: null })} active={!f.country}>
              Бүгд
            </Chip>
            {countries.map((c) => (
              <Chip
                key={c.id}
                href={buildHref(f, { country: c.code })}
                active={f.country === c.code}
              >
                {c.name_mn}
              </Chip>
            ))}
          </ChipRow>
        ) : null}

        <ChipRow label={t.year}>
          <Chip href={buildHref(f, { decade: null })} active={!f.decade}>
            Бүгд
          </Chip>
          {DECADES.map((d) => (
            <Chip key={d} href={buildHref(f, { decade: d })} active={f.decade === d}>
              {d}-аад он
            </Chip>
          ))}
        </ChipRow>

        {languages.length > 0 ? (
          <ChipRow label={t.subtitles}>
            <Chip href={buildHref(f, { sub: null })} active={!f.sub}>
              Бүгд
            </Chip>
            {languages.map((l) => (
              <Chip
                key={l.id}
                href={buildHref(f, { sub: l.code })}
                active={f.sub === l.code}
              >
                {l.name_mn}
              </Chip>
            ))}
          </ChipRow>
        ) : null}

        <ChipRow label="Эрэмбэ">
          {sortOptions.map((s) => (
            <Chip
              key={s.key}
              href={buildHref(f, { sort: s.key })}
              active={f.sort === s.key}
            >
              {s.label}
            </Chip>
          ))}
        </ChipRow>
      </div>

      {/* ------------------------------- grid -------------------------------- */}
      {cards.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title={t.noResults}
            description="Шүүлтүүрээ өөрчилж дахин хайж үзээрэй."
            action={
              <Link
                href="/browse"
                className="rounded-lg bg-royal-500 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-royal-600"
              >
                Шүүлтүүр арилгах
              </Link>
            }
          />
        </div>
      ) : (
        <>
          <div className="mt-10 grid grid-cols-2 justify-items-center gap-x-3 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {cards.map((c) => (
              <PosterCard
                key={c.key}
                href={c.href}
                title={c.title}
                posterUrl={c.posterUrl}
                year={c.year}
                ageRating={c.ageRating}
                isFree={c.isFree}
              />
            ))}
          </div>

          {/* --------------------------- pagination --------------------------- */}
          <nav
            className="mt-12 flex items-center justify-center gap-4"
            aria-label="Хуудаслалт"
          >
            {hasPrev ? (
              <Link
                href={buildHref(f, { page: f.page - 1 })}
                className="inline-flex items-center gap-1.5 rounded-lg border border-ink-600 bg-ink-800 px-4 py-2 text-sm text-mist-100 transition hover:border-royal-500/60"
              >
                <ChevronLeft size={16} aria-hidden="true" /> Өмнөх
              </Link>
            ) : (
              <span className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-ink-600/50 px-4 py-2 text-sm text-mist-500">
                <ChevronLeft size={16} aria-hidden="true" /> Өмнөх
              </span>
            )}
            <span className="text-sm text-mist-400">Хуудас {f.page}</span>
            {hasNext ? (
              <Link
                href={buildHref(f, { page: f.page + 1 })}
                className="inline-flex items-center gap-1.5 rounded-lg border border-ink-600 bg-ink-800 px-4 py-2 text-sm text-mist-100 transition hover:border-royal-500/60"
              >
                Дараах <ChevronRight size={16} aria-hidden="true" />
              </Link>
            ) : (
              <span className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-ink-600/50 px-4 py-2 text-sm text-mist-500">
                Дараах <ChevronRight size={16} aria-hidden="true" />
              </span>
            )}
          </nav>
        </>
      )}
    </div>
  );
}
