import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AgeRating, ContentType } from "@/types/db";

/** Normalized display item for history / continue-watching lists. */
export interface WatchItem {
  key: string;
  contentType: ContentType;
  contentId: string;
  title: string;
  subtitle: string | null;
  posterUrl: string | null;
  releaseYear: number | null;
  ageRating: AgeRating | null;
  detailHref: string;
  watchHref: string;
  progressPercent: number;
  completed: boolean;
  lastWatchedAt: string;
}

interface ProgressRow {
  id: string;
  content_type: ContentType;
  content_id: string;
  progress_seconds: number;
  duration_seconds: number;
  completed: boolean;
  last_watched_at: string;
}

interface MovieRow {
  id: string;
  slug: string;
  title_mn: string;
  poster_url: string | null;
  release_year: number | null;
  age_rating: AgeRating | null;
}

interface EpisodeRow {
  id: string;
  title_mn: string;
  episode_number: number;
  poster_url: string | null;
  season: {
    season_number: number;
    series: {
      slug: string;
      title_mn: string;
      poster_url: string | null;
      release_year: number | null;
      age_rating: AgeRating | null;
    } | null;
  } | null;
}

/**
 * Loads the user's watch progress joined to movie / episode titles.
 * `onlyIncomplete` limits to resumable (continue-watching) entries.
 */
export async function loadWatchItems(
  userId: string,
  options: { onlyIncomplete?: boolean; limit?: number } = {},
): Promise<WatchItem[]> {
  const supabase = await createClient();

  let query = supabase
    .from("watch_progress")
    .select(
      "id, content_type, content_id, progress_seconds, duration_seconds, completed, last_watched_at",
    )
    .eq("user_id", userId)
    .order("last_watched_at", { ascending: false })
    .limit(options.limit ?? 100);
  if (options.onlyIncomplete) {
    query = query.eq("completed", false).gt("progress_seconds", 0);
  }
  const { data: progressData } = await query;
  const rows = (progressData ?? []) as ProgressRow[];
  if (rows.length === 0) return [];

  const movieIds = rows
    .filter((r) => r.content_type === "movie")
    .map((r) => r.content_id);
  const episodeIds = rows
    .filter((r) => r.content_type === "episode")
    .map((r) => r.content_id);

  const [moviesRes, episodesRes] = await Promise.all([
    movieIds.length > 0
      ? supabase
          .from("movies")
          .select("id, slug, title_mn, poster_url, release_year, age_rating")
          .in("id", movieIds)
      : Promise.resolve({ data: [] }),
    episodeIds.length > 0
      ? supabase
          .from("episodes")
          .select(
            `id, title_mn, episode_number, poster_url,
             season:seasons(season_number,
               series:series(slug, title_mn, poster_url, release_year, age_rating))`,
          )
          .in("id", episodeIds)
      : Promise.resolve({ data: [] }),
  ]);

  const movies = new Map(
    ((moviesRes.data ?? []) as MovieRow[]).map((m) => [m.id, m]),
  );
  const episodes = new Map(
    ((episodesRes.data ?? []) as unknown as EpisodeRow[]).map((e) => [e.id, e]),
  );

  const items: WatchItem[] = [];
  for (const row of rows) {
    const percent =
      row.duration_seconds > 0
        ? Math.min(
            Math.round((row.progress_seconds / row.duration_seconds) * 100),
            100,
          )
        : 0;
    if (row.content_type === "movie") {
      const movie = movies.get(row.content_id);
      if (!movie) continue;
      items.push({
        key: row.id,
        contentType: "movie",
        contentId: row.content_id,
        title: movie.title_mn,
        subtitle: null,
        posterUrl: movie.poster_url,
        releaseYear: movie.release_year,
        ageRating: movie.age_rating,
        detailHref: `/movie/${movie.slug}`,
        watchHref: `/watch/movie/${row.content_id}`,
        progressPercent: percent,
        completed: row.completed,
        lastWatchedAt: row.last_watched_at,
      });
    } else {
      const episode = episodes.get(row.content_id);
      const series = episode?.season?.series ?? null;
      if (!episode || !series) continue;
      items.push({
        key: row.id,
        contentType: "episode",
        contentId: row.content_id,
        title: series.title_mn,
        subtitle: `Бүлэг ${episode.season?.season_number ?? 1} · Анги ${episode.episode_number}`,
        posterUrl: episode.poster_url ?? series.poster_url,
        releaseYear: series.release_year,
        ageRating: series.age_rating,
        detailHref: `/series/${series.slug}`,
        watchHref: `/watch/episode/${row.content_id}`,
        progressPercent: percent,
        completed: row.completed,
        lastWatchedAt: row.last_watched_at,
      });
    }
  }
  return items;
}
