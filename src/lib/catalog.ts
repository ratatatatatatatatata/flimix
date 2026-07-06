import "server-only";
import { unstable_cache } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PAGE_SIZE, type BrowseFilters } from "@/lib/browse";
import { t } from "@/lib/i18n";
import { createPublicClient } from "@/lib/supabase/public";
import type {
  CastMember,
  Country,
  CrewMember,
  Genre,
  HomepageSection,
  HomepageSectionItem,
  Language,
  Movie,
  Series,
  SubtitleTrack,
} from "@/types/db";

/**
 * Cached PUBLIC catalog queries.
 *
 * Every function here:
 *  - uses the cookie-less anon client (createPublicClient) — NEVER cookies(),
 *  - keeps the published + not-deleted filters for public visibility,
 *  - takes plain serializable args only (they become part of the cache key),
 *  - is wrapped in unstable_cache with revalidate 60s and the "catalog" tag,
 *    which admin mutations invalidate via revalidateTag("catalog").
 */

export const CATALOG_TAG = "catalog";
const CACHE_OPTS: { revalidate: number; tags: string[] } = {
  revalidate: 60,
  tags: [CATALOG_TAG],
};

/* ---------------------------------- cards ---------------------------------- */

export interface CatalogCard {
  key: string;
  href: string;
  title: string;
  posterUrl: string | null;
  year: number | null;
  ageRating: string | null;
  isFree?: boolean;
  progressPercent?: number;
}

export interface CatalogRow {
  id: string;
  title: string;
  seeAllHref?: string;
  items: CatalogCard[];
}

export function isLive(
  x: Pick<Movie, "status" | "deleted_at"> | null | undefined,
): boolean {
  return !!x && x.status === "published" && !x.deleted_at;
}

export function movieToCard(m: Movie): CatalogCard {
  return {
    key: `movie-${m.id}`,
    href: `/movie/${m.slug}`,
    title: m.title_mn,
    posterUrl: m.poster_url,
    year: m.release_year,
    ageRating: m.age_rating,
    isFree: m.is_free,
  };
}

export function seriesToCard(s: Series): CatalogCard {
  return {
    key: `series-${s.id}`,
    href: `/series/${s.slug}`,
    title: s.title_mn,
    posterUrl: s.poster_url,
    year: s.release_year,
    ageRating: s.age_rating,
  };
}

/* ------------------------------ base queries ------------------------------- */

async function fetchMovies(
  db: SupabaseClient,
  opts: { sort: "newest" | "popular"; countryCode?: string; limit?: number },
): Promise<Movie[]> {
  const select = opts.countryCode ? "*, countries!inner(code)" : "*";
  let query = db
    .from("movies")
    .select(select)
    .eq("status", "published")
    .is("deleted_at", null);
  if (opts.countryCode) query = query.eq("countries.code", opts.countryCode);
  const ordered =
    opts.sort === "newest"
      ? query.order("published_at", { ascending: false, nullsFirst: false })
      : query.order("popularity", { ascending: false });
  const { data } = await ordered.limit(opts.limit ?? 14);
  return (data ?? []) as unknown as Movie[];
}

async function fetchSeries(
  db: SupabaseClient,
  opts: { sort: "newest" | "popular"; limit?: number },
): Promise<Series[]> {
  const query = db
    .from("series")
    .select("*")
    .eq("status", "published")
    .is("deleted_at", null);
  const ordered =
    opts.sort === "newest"
      ? query.order("published_at", { ascending: false, nullsFirst: false })
      : query.order("popularity", { ascending: false });
  const { data } = await ordered.limit(opts.limit ?? 14);
  return (data ?? []) as unknown as Series[];
}

/* ---------------------------- homepage sections ---------------------------- */

export type AutoSource = "newest" | "popular" | "mongolian" | "series";

export function parseAutoSource(aq: Record<string, unknown> | null): AutoSource {
  const raw = aq ? (aq.source ?? aq.kind ?? aq.type ?? aq.query) : null;
  switch (raw) {
    case "newest":
    case "new":
    case "latest":
      return "newest";
    case "mongolian":
    case "mn":
      return "mongolian";
    case "series":
      return "series";
    default:
      return "popular";
  }
}

export const AUTO_SEE_ALL: Record<AutoSource, string> = {
  newest: "/browse?type=movie&sort=newest",
  popular: "/browse?sort=popular",
  mongolian: "/browse?country=MN",
  series: "/browse?type=series",
};

/** Manual section items → cards (pure; join data already on the section). */
export function manualSectionItems(section: HomepageSection): CatalogCard[] {
  const items: HomepageSectionItem[] = [...(section.items ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order,
  );
  const cards: CatalogCard[] = [];
  for (const item of items) {
    if (item.content_type === "movie" && isLive(item.movie)) {
      cards.push(movieToCard(item.movie as Movie));
    } else if (item.content_type === "series" && isLive(item.series)) {
      cards.push(seriesToCard(item.series as Series));
    }
  }
  return cards;
}

/** Published homepage sections with items + content joins (CMS layout). */
export const getPublishedSections = unstable_cache(
  async (): Promise<HomepageSection[]> => {
    const db = createPublicClient();
    const { data } = await db
      .from("homepage_sections")
      .select(
        "*, items:homepage_section_items(*, movie:movies(*, genres(*)), series:series(*, genres(*)))",
      )
      .eq("status", "published")
      .order("sort_order", { ascending: true });
    return (data ?? []) as unknown as HomepageSection[];
  },
  ["catalog-published-sections"],
  CACHE_OPTS,
);

/** Content for an "auto" homepage section (query descriptor → cards). */
export const getAutoSectionContent = unstable_cache(
  async (source: AutoSource): Promise<CatalogCard[]> => {
    const db = createPublicClient();
    switch (source) {
      case "newest":
        return (await fetchMovies(db, { sort: "newest" })).map(movieToCard);
      case "mongolian":
        return (await fetchMovies(db, { sort: "popular", countryCode: "MN" })).map(
          movieToCard,
        );
      case "series":
        return (await fetchSeries(db, { sort: "popular" })).map(seriesToCard);
      default:
        return (await fetchMovies(db, { sort: "popular" })).map(movieToCard);
    }
  },
  ["catalog-auto-section"],
  CACHE_OPTS,
);

/** Fallback landing rows when no CMS sections exist (newest/popular/MN/series). */
export const getLandingFallbackRows = unstable_cache(
  async (): Promise<CatalogRow[]> => {
    const db = createPublicClient();
    const [newest, popular, mongolian, seriesList] = await Promise.all([
      fetchMovies(db, { sort: "newest" }),
      fetchMovies(db, { sort: "popular" }),
      fetchMovies(db, { sort: "popular", countryCode: "MN" }),
      fetchSeries(db, { sort: "popular" }),
    ]);
    return [
      {
        id: "fb-newest",
        title: t.newReleases,
        seeAllHref: AUTO_SEE_ALL.newest,
        items: newest.map(movieToCard),
      },
      {
        id: "fb-popular",
        title: t.trending,
        seeAllHref: AUTO_SEE_ALL.popular,
        items: popular.map(movieToCard),
      },
      {
        id: "fb-mn",
        title: t.mongolianCinema,
        seeAllHref: AUTO_SEE_ALL.mongolian,
        items: mongolian.map(movieToCard),
      },
      {
        id: "fb-series",
        title: t.series,
        seeAllHref: AUTO_SEE_ALL.series,
        items: seriesList.map(seriesToCard),
      },
    ].filter((r) => r.items.length > 0);
  },
  ["catalog-fallback-rows"],
  CACHE_OPTS,
);

/* ----------------------------------- hero ---------------------------------- */

export interface HeroData {
  title: string;
  originalTitle: string | null;
  description: string | null;
  backdropUrl: string | null;
  href: string;
  year: number | null;
  ageRating: string | null;
  genres: string[];
  isFree: boolean;
}

export function heroFromMovie(m: Movie): HeroData {
  return {
    title: m.title_mn,
    originalTitle: m.original_title,
    description: m.description_mn,
    backdropUrl: m.backdrop_url,
    href: `/movie/${m.slug}`,
    year: m.release_year,
    ageRating: m.age_rating,
    genres: (m.genres ?? []).map((g) => g.name_mn).slice(0, 3),
    isFree: m.is_free,
  };
}

export function heroFromSeries(s: Series): HeroData {
  return {
    title: s.title_mn,
    originalTitle: s.original_title,
    description: s.description_mn,
    backdropUrl: s.backdrop_url,
    href: `/series/${s.slug}`,
    year: s.release_year,
    ageRating: s.age_rating,
    genres: (s.genres ?? []).map((g) => g.name_mn).slice(0, 3),
    isFree: false,
  };
}

/** First live item of a hero CMS section → hero data (pure). */
export function heroFromSection(section: HomepageSection | undefined): HeroData | null {
  if (!section) return null;
  const items = [...(section.items ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  for (const item of items) {
    if (item.content_type === "movie" && isLive(item.movie)) {
      return heroFromMovie(item.movie as Movie);
    }
    if (item.content_type === "series" && isLive(item.series)) {
      return heroFromSeries(item.series as Series);
    }
  }
  return null;
}

/** Fallback hero: most popular published movie with a backdrop. */
export const getHeroTitle = unstable_cache(
  async (): Promise<HeroData | null> => {
    const db = createPublicClient();
    const { data } = await db
      .from("movies")
      .select("*, genres(*)")
      .eq("status", "published")
      .is("deleted_at", null)
      .not("backdrop_url", "is", null)
      .order("popularity", { ascending: false })
      .limit(1);
    const movie = ((data ?? []) as unknown as Movie[])[0];
    return movie ? heroFromMovie(movie) : null;
  },
  ["catalog-hero-title"],
  CACHE_OPTS,
);

/* ---------------------------------- browse --------------------------------- */

export interface PagedResult<T> {
  items: T[];
  count: number;
}

export interface BrowseResult {
  movies: PagedResult<Movie>;
  series: PagedResult<Series>;
}

interface SubtitleScope {
  movieIds: string[];
  seriesIds: string[];
}

/** Resolve subtitle-language filter into concrete content ids (movies + series). */
async function resolveSubtitleScope(
  db: SupabaseClient,
  code: string,
): Promise<SubtitleScope> {
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
  const movieIds = [
    ...new Set(rows.filter((r) => r.content_type === "movie").map((r) => r.content_id)),
  ];
  const episodeIds = rows
    .filter((r) => r.content_type === "episode")
    .map((r) => r.content_id);

  let seriesIds: string[] = [];
  if (episodeIds.length > 0) {
    const { data: eps } = await db
      .from("episodes")
      .select("season_id")
      .in("id", episodeIds);
    const seasonIds = [
      ...new Set(((eps ?? []) as { season_id: string }[]).map((e) => e.season_id)),
    ];
    if (seasonIds.length > 0) {
      const { data: seasons } = await db
        .from("seasons")
        .select("series_id")
        .in("id", seasonIds);
      seriesIds = [
        ...new Set(((seasons ?? []) as { series_id: string }[]).map((s) => s.series_id)),
      ];
    }
  }
  return { movieIds, seriesIds };
}

async function queryTable<T>(
  db: SupabaseClient,
  table: "movies" | "series",
  f: BrowseFilters,
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
  if (f.year) q = q.eq("release_year", f.year);
  else if (f.decade)
    q = q.gte("release_year", f.decade).lte("release_year", f.decade + 9);
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

/** Full /browse result set for a filter combination (same semantics as the page). */
export const browseCatalog = unstable_cache(
  async (f: BrowseFilters): Promise<BrowseResult> => {
    const db = createPublicClient();
    const subScope = f.sub ? await resolveSubtitleScope(db, f.sub) : null;

    // Pagination: single-type pages take the full page, "all" splits it evenly.
    const half = PAGE_SIZE / 2;
    const perTable = f.type === "all" ? half : PAGE_SIZE;
    const from = (f.page - 1) * perTable;
    const to = from + perTable - 1;

    const wantMovies = f.type !== "series";
    const wantSeries = f.type !== "movie";

    const [movies, series] = await Promise.all([
      wantMovies
        ? queryTable<Movie>(db, "movies", f, subScope ? subScope.movieIds : null, from, to)
        : Promise.resolve({ items: [] as Movie[], count: 0 }),
      wantSeries
        ? queryTable<Series>(db, "series", f, subScope ? subScope.seriesIds : null, from, to)
        : Promise.resolve({ items: [] as Series[], count: 0 }),
    ]);
    return { movies, series };
  },
  ["catalog-browse"],
  CACHE_OPTS,
);

export interface BrowseTaxonomies {
  genres: Genre[];
  countries: Country[];
  languages: Language[];
}

/** Filter chip sources (genres / countries / languages). */
export const getBrowseTaxonomies = unstable_cache(
  async (): Promise<BrowseTaxonomies> => {
    const db = createPublicClient();
    const [genresRes, countriesRes, languagesRes] = await Promise.all([
      db.from("genres").select("*").order("name_mn"),
      db.from("countries").select("*").order("name_mn").limit(40),
      db.from("languages").select("*").order("name_mn").limit(20),
    ]);
    return {
      genres: (genresRes.data ?? []) as unknown as Genre[],
      countries: (countriesRes.data ?? []) as unknown as Country[],
      languages: (languagesRes.data ?? []) as unknown as Language[],
    };
  },
  ["catalog-browse-taxonomies"],
  CACHE_OPTS,
);

/* ------------------------------- detail pages ------------------------------ */

/**
 * Movie by slug (not-deleted only). Status is returned so pages can render the
 * "unavailable" notice for non-published rows — anon RLS already hides what
 * the public must not see.
 */
export const getMovieBySlug = unstable_cache(
  async (slug: string): Promise<Movie | null> => {
    const db = createPublicClient();
    const { data } = await db
      .from("movies")
      .select("*, genres(*), country:countries(*)")
      .eq("slug", slug)
      .is("deleted_at", null)
      .maybeSingle();
    return (data as unknown as Movie | null) ?? null;
  },
  ["catalog-movie-by-slug"],
  CACHE_OPTS,
);

/** Series by slug with seasons + episodes (not-deleted only). */
export const getSeriesBySlug = unstable_cache(
  async (slug: string): Promise<Series | null> => {
    const db = createPublicClient();
    const { data } = await db
      .from("series")
      .select("*, genres(*), country:countries(*), seasons(*, episodes(*))")
      .eq("slug", slug)
      .is("deleted_at", null)
      .maybeSingle();
    return (data as unknown as Series | null) ?? null;
  },
  ["catalog-series-by-slug"],
  CACHE_OPTS,
);

export interface MovieCredits {
  cast: CastMember[];
  crew: CrewMember[];
  subtitles: SubtitleTrack[];
}

/** Cast, crew and subtitle tracks for a movie (public metadata). */
export const getMovieCredits = unstable_cache(
  async (movieId: string): Promise<MovieCredits> => {
    const db = createPublicClient();
    const [castRes, crewRes, subsRes] = await Promise.all([
      db.from("movie_cast").select("cast_members(*)").eq("movie_id", movieId),
      db.from("movie_crew").select("crew_members(*)").eq("movie_id", movieId),
      db
        .from("subtitle_tracks")
        .select("*, language:languages(*)")
        .eq("content_type", "movie")
        .eq("content_id", movieId),
    ]);
    const cast = (
      (castRes.data ?? []) as unknown as { cast_members: CastMember | null }[]
    )
      .map((r) => r.cast_members)
      .filter((p): p is CastMember => p !== null);
    // movie_crew is optional in early schemas — a query error just means "no crew".
    const crew = crewRes.error
      ? []
      : ((crewRes.data ?? []) as unknown as { crew_members: CrewMember | null }[])
          .map((r) => r.crew_members)
          .filter((p): p is CrewMember => p !== null);
    const subtitles = (subsRes.data ?? []) as unknown as SubtitleTrack[];
    return { cast, crew, subtitles };
  },
  ["catalog-movie-credits"],
  CACHE_OPTS,
);

/** Cast list for a series (public metadata). */
export const getSeriesCast = unstable_cache(
  async (seriesId: string): Promise<CastMember[]> => {
    const db = createPublicClient();
    const { data } = await db
      .from("series_cast")
      .select("cast_members(*)")
      .eq("series_id", seriesId);
    return ((data ?? []) as unknown as { cast_members: CastMember | null }[])
      .map((r) => r.cast_members)
      .filter((p): p is CastMember => p !== null);
  },
  ["catalog-series-cast"],
  CACHE_OPTS,
);

/** Published movies sharing at least one genre, most popular first. */
export const getSimilarMovies = unstable_cache(
  async (movieId: string, genreIds: string[]): Promise<Movie[]> => {
    if (genreIds.length === 0) return [];
    const db = createPublicClient();
    const { data } = await db
      .from("movies")
      .select("*, movie_genres!inner(genre_id)")
      .in("movie_genres.genre_id", genreIds)
      .neq("id", movieId)
      .eq("status", "published")
      .is("deleted_at", null)
      .order("popularity", { ascending: false })
      .limit(12);
    return (data ?? []) as unknown as Movie[];
  },
  ["catalog-similar-movies"],
  CACHE_OPTS,
);

/** Published series sharing at least one genre, most popular first. */
export const getSimilarSeries = unstable_cache(
  async (seriesId: string, genreIds: string[]): Promise<Series[]> => {
    if (genreIds.length === 0) return [];
    const db = createPublicClient();
    const { data } = await db
      .from("series")
      .select("*, series_genres!inner(genre_id)")
      .in("series_genres.genre_id", genreIds)
      .neq("id", seriesId)
      .eq("status", "published")
      .is("deleted_at", null)
      .order("popularity", { ascending: false })
      .limit(12);
    return (data ?? []) as unknown as Series[];
  },
  ["catalog-similar-series"],
  CACHE_OPTS,
);

/* --------------------------- landing top sections --------------------------- */

export interface FeaturedItem {
  id: string;
  slug: string;
  type: "movie" | "series";
  title: string;
  backdropUrl: string;
  posterUrl: string | null;
  year: number | null;
  rating: number | null;
  /** First two genre names (Mongolian). */
  genres: string[];
}

/** Newest published movies + series with a backdrop, mixed, for the carousel. */
export const getFeaturedCarousel = unstable_cache(
  async (limit: number = 8): Promise<FeaturedItem[]> => {
    const db = createPublicClient();
    const [moviesRes, seriesRes] = await Promise.all([
      db
        .from("movies")
        .select("*, genres(*)")
        .eq("status", "published")
        .is("deleted_at", null)
        .not("backdrop_url", "is", null)
        .order("published_at", { ascending: false, nullsFirst: false })
        .limit(limit),
      db
        .from("series")
        .select("*, genres(*)")
        .eq("status", "published")
        .is("deleted_at", null)
        .not("backdrop_url", "is", null)
        .order("published_at", { ascending: false, nullsFirst: false })
        .limit(limit),
    ]);
    const movies = (moviesRes.data ?? []) as unknown as Movie[];
    const seriesRows = (seriesRes.data ?? []) as unknown as Series[];

    const merged: { publishedAt: number; item: FeaturedItem }[] = [];
    for (const m of movies) {
      if (!m.backdrop_url) continue;
      merged.push({
        publishedAt: Date.parse(m.published_at ?? m.created_at) || 0,
        item: {
          id: m.id,
          slug: m.slug,
          type: "movie",
          title: m.title_mn,
          backdropUrl: m.backdrop_url,
          posterUrl: m.poster_url,
          year: m.release_year,
          rating: m.rating,
          genres: (m.genres ?? []).map((g) => g.name_mn).slice(0, 2),
        },
      });
    }
    for (const s of seriesRows) {
      if (!s.backdrop_url) continue;
      merged.push({
        publishedAt: Date.parse(s.published_at ?? s.created_at) || 0,
        item: {
          id: s.id,
          slug: s.slug,
          type: "series",
          title: s.title_mn,
          backdropUrl: s.backdrop_url,
          posterUrl: s.poster_url,
          year: s.release_year,
          rating: s.rating,
          genres: (s.genres ?? []).map((g) => g.name_mn).slice(0, 2),
        },
      });
    }
    merged.sort((a, b) => b.publishedAt - a.publishedAt);
    return merged.slice(0, limit).map((e) => e.item);
  },
  ["catalog-featured-carousel"],
  CACHE_OPTS,
);

export interface LatestEpisodeCard {
  seriesSlug: string;
  /** Series title + " S{season} A{episode}" of its newest episode. */
  title: string;
  posterUrl: string | null;
  rating: number | null;
  /** ISO date of the newest episode (published_at, else created_at). */
  date: string;
}

interface LatestEpisodeJoinRow {
  id: string;
  episode_number: number;
  poster_url: string | null;
  published_at: string | null;
  created_at: string;
  season: {
    season_number: number;
    series: {
      id: string;
      slug: string;
      title_mn: string;
      poster_url: string | null;
      rating: number | null;
      status: string;
      deleted_at: string | null;
    } | null;
  } | null;
}

/** Newest published episodes → one card per series (deduped, newest first). */
export const getLatestEpisodesGrid = unstable_cache(
  async (limit: number = 10): Promise<LatestEpisodeCard[]> => {
    const db = createPublicClient();
    const { data } = await db
      .from("episodes")
      .select(
        "id, episode_number, poster_url, published_at, created_at, season:seasons(season_number, series:series(id, slug, title_mn, poster_url, rating, status, deleted_at))",
      )
      .eq("status", "published")
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(limit * 5);
    const rows = (data ?? []) as unknown as LatestEpisodeJoinRow[];

    const seen = new Set<string>();
    const cards: LatestEpisodeCard[] = [];
    for (const row of rows) {
      const series = row.season?.series;
      if (!row.season || !series) continue;
      if (series.status !== "published" || series.deleted_at) continue;
      if (seen.has(series.id)) continue;
      seen.add(series.id);
      cards.push({
        seriesSlug: series.slug,
        title: `${series.title_mn} S${row.season.season_number} A${row.episode_number}`,
        posterUrl: series.poster_url,
        rating: series.rating,
        date: row.published_at ?? row.created_at,
      });
      if (cards.length >= limit) break;
    }
    return cards;
  },
  ["catalog-latest-episodes-grid"],
  CACHE_OPTS,
);

export interface LatestMovieCard {
  id: string;
  slug: string;
  title: string;
  posterUrl: string | null;
  year: number | null;
  rating: number | null;
  isFree: boolean;
  /** "ХАДМАЛ" when the movie has at least one subtitle track, else null. */
  subtitleBadge: string | null;
}

/** Newest published movies with a subtitle badge for the landing grid. */
export const getLatestMoviesGrid = unstable_cache(
  async (limit: number = 12): Promise<LatestMovieCard[]> => {
    const db = createPublicClient();
    const movies = await fetchMovies(db, { sort: "newest", limit });
    if (movies.length === 0) return [];
    const { data: subs } = await db
      .from("subtitle_tracks")
      .select("content_id")
      .eq("content_type", "movie")
      .in(
        "content_id",
        movies.map((m) => m.id),
      );
    const withSubs = new Set(
      ((subs ?? []) as { content_id: string }[]).map((s) => s.content_id),
    );
    return movies.map((m) => ({
      id: m.id,
      slug: m.slug,
      title: m.title_mn,
      posterUrl: m.poster_url,
      year: m.release_year,
      rating: m.rating,
      isFree: m.is_free,
      subtitleBadge: withSubs.has(m.id) ? "ХАДМАЛ" : null,
    }));
  },
  ["catalog-latest-movies-grid"],
  CACHE_OPTS,
);

export interface CatalogCounts {
  movies: number;
  episodes: number;
}

/** Published movie and episode totals for the landing section headings. */
export const getCatalogCounts = unstable_cache(
  async (): Promise<CatalogCounts> => {
    const db = createPublicClient();
    const [moviesRes, episodesRes] = await Promise.all([
      db
        .from("movies")
        .select("id", { count: "exact", head: true })
        .eq("status", "published")
        .is("deleted_at", null),
      db
        .from("episodes")
        .select("id", { count: "exact", head: true })
        .eq("status", "published"),
    ]);
    return { movies: moviesRes.count ?? 0, episodes: episodesRes.count ?? 0 };
  },
  ["catalog-counts"],
  CACHE_OPTS,
);

export interface GenreCount {
  slug: string;
  name: string;
  /** Published movie + series titles in this genre. */
  count: number;
}

/** Genres with published movie+series counts (count desc, zero counts dropped). */
export const getGenreCounts = unstable_cache(
  async (): Promise<GenreCount[]> => {
    const db = createPublicClient();
    const [genresRes, movieGenresRes, seriesGenresRes] = await Promise.all([
      db.from("genres").select("*").order("name_mn"),
      db
        .from("movie_genres")
        .select("genre_id, movies!inner(id)")
        .eq("movies.status", "published")
        .is("movies.deleted_at", null)
        .limit(5000),
      db
        .from("series_genres")
        .select("genre_id, series!inner(id)")
        .eq("series.status", "published")
        .is("series.deleted_at", null)
        .limit(5000),
    ]);
    const genres = (genresRes.data ?? []) as unknown as Genre[];
    const counts = new Map<string, number>();
    const junctionRows = [
      ...((movieGenresRes.data ?? []) as unknown as { genre_id: string }[]),
      ...((seriesGenresRes.data ?? []) as unknown as { genre_id: string }[]),
    ];
    for (const row of junctionRows) {
      counts.set(row.genre_id, (counts.get(row.genre_id) ?? 0) + 1);
    }
    return genres
      .map((g) => ({ slug: g.slug, name: g.name_mn, count: counts.get(g.id) ?? 0 }))
      .filter((g) => g.count > 0)
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  },
  ["catalog-genre-counts"],
  CACHE_OPTS,
);

export interface TopRatedTitle {
  slug: string;
  type: "movie" | "series";
  title: string;
  year: number | null;
  rating: number;
  posterUrl: string | null;
}

interface RatedRow {
  slug: string;
  title_mn: string;
  release_year: number | null;
  rating: number | null;
  poster_url: string | null;
}

/**
 * Highest-rated published titles, movies + series mixed (rating desc, rows
 * without a rating excluded). Used by the footer widget and the landing grid.
 */
export const getTopRatedTitles = unstable_cache(
  async (limit: number = 10): Promise<TopRatedTitle[]> => {
    const db = createPublicClient();
    const cols = "slug, title_mn, release_year, rating, poster_url";
    const [moviesRes, seriesRes] = await Promise.all([
      db
        .from("movies")
        .select(cols)
        .eq("status", "published")
        .is("deleted_at", null)
        .not("rating", "is", null)
        .order("rating", { ascending: false })
        .limit(limit),
      db
        .from("series")
        .select(cols)
        .eq("status", "published")
        .is("deleted_at", null)
        .not("rating", "is", null)
        .order("rating", { ascending: false })
        .limit(limit),
    ]);
    const toItems = (rows: RatedRow[], type: "movie" | "series"): TopRatedTitle[] =>
      rows
        .filter((r): r is RatedRow & { rating: number } => typeof r.rating === "number")
        .map((r) => ({
          slug: r.slug,
          type,
          title: r.title_mn,
          year: r.release_year,
          rating: r.rating,
          posterUrl: r.poster_url,
        }));
    return [
      ...toItems((moviesRes.data ?? []) as unknown as RatedRow[], "movie"),
      ...toItems((seriesRes.data ?? []) as unknown as RatedRow[], "series"),
    ]
      .sort((a, b) => b.rating - a.rating)
      .slice(0, limit);
  },
  ["catalog-top-rated-titles"],
  CACHE_OPTS,
);

/** Distinct release years (movies + series, published), newest first. */
export const getReleaseYears = unstable_cache(
  async (): Promise<number[]> => {
    const db = createPublicClient();
    const [moviesRes, seriesRes] = await Promise.all([
      db
        .from("movies")
        .select("release_year")
        .eq("status", "published")
        .is("deleted_at", null)
        .not("release_year", "is", null)
        .order("release_year", { ascending: false })
        .limit(1000),
      db
        .from("series")
        .select("release_year")
        .eq("status", "published")
        .is("deleted_at", null)
        .not("release_year", "is", null)
        .order("release_year", { ascending: false })
        .limit(1000),
    ]);
    const years = new Set<number>();
    for (const row of [
      ...((moviesRes.data ?? []) as unknown as { release_year: number | null }[]),
      ...((seriesRes.data ?? []) as unknown as { release_year: number | null }[]),
    ]) {
      if (typeof row.release_year === "number") years.add(row.release_year);
    }
    return [...years].sort((a, b) => b - a);
  },
  ["catalog-release-years"],
  CACHE_OPTS,
);
