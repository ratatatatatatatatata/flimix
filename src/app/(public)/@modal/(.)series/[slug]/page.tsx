import { notFound } from "next/navigation";
import { TitleModal } from "@/components/catalog/TitleModal";
import { getSession } from "@/lib/auth";
import { getSeriesBySlug, getSeriesCast, getSimilarSeries } from "@/lib/catalog";
import { createClient } from "@/lib/supabase/server";

type Params = Promise<{ slug: string }>;

/**
 * Intercepted /series/[slug] — soft navigations from cards/rows open a
 * quick-look modal over the current page; direct loads and hard navigations
 * still render the full series detail page.
 */
export default async function SeriesModalPage({ params }: { params: Params }) {
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug);
  const series = await getSeriesBySlug(slug);
  if (!series || series.status !== "published") notFound();

  const genreIds = (series.genres ?? []).map((g) => g.id);
  const [cast, similar, session] = await Promise.all([
    getSeriesCast(series.id),
    getSimilarSeries(series.id, genreIds),
    getSession(),
  ]);

  let isFavorited = false;
  if (session) {
    const db = await createClient();
    const { data } = await db
      .from("favorites")
      .select("id")
      .eq("user_id", session.userId)
      .eq("series_id", series.id)
      .maybeSingle();
    isFavorited = !!data;
  }

  // Season/episode summary from the already-joined seasons data.
  const seasonsWithEpisodes = (series.seasons ?? [])
    .map((s) => ({
      ...s,
      episodes: (s.episodes ?? []).filter((e) => e.status === "published"),
    }))
    .filter((s) => s.episodes.length > 0);
  const episodeCount = seasonsWithEpisodes.reduce((sum, s) => sum + s.episodes.length, 0);
  const seasonSummary =
    seasonsWithEpisodes.length > 0
      ? `${seasonsWithEpisodes.length} бүлэг · ${episodeCount} анги`
      : null;

  return (
    <TitleModal
      key={series.id}
      initialFavorited={isFavorited}
      data={{
        type: "series",
        id: series.id,
        slug: series.slug,
        title: series.title_mn,
        originalTitle: series.original_title,
        description: series.description_mn,
        year: series.release_year,
        ageRating: series.age_rating,
        durationSeconds: null,
        seasonSummary,
        genres: (series.genres ?? []).map((g) => ({
          id: g.id,
          slug: g.slug,
          name: g.name_mn,
        })),
        backdropUrl: series.backdrop_url,
        posterUrl: series.poster_url,
        trailerUrl: series.trailer_url,
        isFree: false,
        cast: cast.map((p) => ({ id: p.id, name: p.name, photoUrl: p.photo_url })),
        similar: similar.map((s) => ({
          id: s.id,
          slug: s.slug,
          type: "series" as const,
          title: s.title_mn,
          posterUrl: s.poster_url,
        })),
      }}
    />
  );
}
