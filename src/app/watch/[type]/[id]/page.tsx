import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Episode, Movie, Season, Series } from "@/types/db";
import { WatchClient } from "./WatchClient";

const paramsSchema = z.object({
  type: z.enum(["movie", "episode"]),
  id: z.string().uuid(),
});

interface WatchPageProps {
  params: Promise<{ type: string; id: string }>;
}

export const metadata: Metadata = { title: "FLIMIX — Тоглуулагч" };

type MovieMeta = Pick<Movie, "id" | "slug" | "title_mn">;
type EpisodeMeta = Pick<
  Episode,
  | "id"
  | "season_id"
  | "episode_number"
  | "title_mn"
  | "intro_start_seconds"
  | "intro_end_seconds"
>;
type SeasonMeta = Pick<Season, "id" | "series_id" | "season_number">;
type SeriesMeta = Pick<Series, "id" | "slug" | "title_mn">;
type NextEpisodeRow = Pick<Episode, "id">;

export default async function WatchPage({ params }: WatchPageProps) {
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) notFound();
  const { type, id } = parsed.data;

  await requireUser();
  const supabase = await createClient();

  if (type === "movie") {
    const { data } = await supabase
      .from("movies")
      .select("id, slug, title_mn")
      .eq("id", id)
      .eq("status", "published")
      .is("deleted_at", null)
      .maybeSingle();
    const movie = data as MovieMeta | null;
    if (!movie) notFound();

    return (
      <WatchClient
        contentType="movie"
        contentId={movie.id}
        title={movie.title_mn}
        backHref={`/movie/${movie.slug}`}
      />
    );
  }

  const { data: episodeRow } = await supabase
    .from("episodes")
    .select(
      "id, season_id, episode_number, title_mn, intro_start_seconds, intro_end_seconds",
    )
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();
  const episode = episodeRow as EpisodeMeta | null;
  if (!episode) notFound();

  const { data: seasonRow } = await supabase
    .from("seasons")
    .select("id, series_id, season_number")
    .eq("id", episode.season_id)
    .maybeSingle();
  const season = seasonRow as SeasonMeta | null;
  if (!season) notFound();

  const { data: seriesRow } = await supabase
    .from("series")
    .select("id, slug, title_mn")
    .eq("id", season.series_id)
    .eq("status", "published")
    .is("deleted_at", null)
    .maybeSingle();
  const series = seriesRow as SeriesMeta | null;
  if (!series) notFound();

  // Next episode: first the same season, then episode 1 of the next season.
  let nextHref: string | null = null;
  const { data: sameSeasonNext } = await supabase
    .from("episodes")
    .select("id")
    .eq("season_id", season.id)
    .eq("status", "published")
    .gt("episode_number", episode.episode_number)
    .order("episode_number", { ascending: true })
    .limit(1)
    .maybeSingle();
  const nextInSeason = sameSeasonNext as NextEpisodeRow | null;
  if (nextInSeason) {
    nextHref = `/watch/episode/${nextInSeason.id}`;
  } else {
    const { data: nextSeasonRow } = await supabase
      .from("seasons")
      .select("id")
      .eq("series_id", season.series_id)
      .gt("season_number", season.season_number)
      .order("season_number", { ascending: true })
      .limit(1)
      .maybeSingle();
    const nextSeason = nextSeasonRow as Pick<Season, "id"> | null;
    if (nextSeason) {
      const { data: firstEpisodeRow } = await supabase
        .from("episodes")
        .select("id")
        .eq("season_id", nextSeason.id)
        .eq("status", "published")
        .order("episode_number", { ascending: true })
        .limit(1)
        .maybeSingle();
      const firstEpisode = firstEpisodeRow as NextEpisodeRow | null;
      if (firstEpisode) nextHref = `/watch/episode/${firstEpisode.id}`;
    }
  }

  const title = `${series.title_mn} — Б${season.season_number} А${episode.episode_number}. ${episode.title_mn}`;

  return (
    <WatchClient
      contentType="episode"
      contentId={episode.id}
      title={title}
      backHref={`/series/${series.slug}`}
      introStart={episode.intro_start_seconds}
      introEnd={episode.intro_end_seconds}
      nextHref={nextHref}
    />
  );
}
