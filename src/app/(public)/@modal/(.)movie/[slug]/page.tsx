import { notFound } from "next/navigation";
import { TitleModal } from "@/components/catalog/TitleModal";
import { getSession } from "@/lib/auth";
import { getMovieBySlug, getMovieCredits, getSimilarMovies } from "@/lib/catalog";
import { createClient } from "@/lib/supabase/server";

type Params = Promise<{ slug: string }>;

/**
 * Intercepted /movie/[slug] — soft navigations from cards/rows open a
 * quick-look modal over the current page; direct loads and hard navigations
 * still render the full movie detail page.
 */
export default async function MovieModalPage({ params }: { params: Params }) {
  const { slug } = await params;
  const movie = await getMovieBySlug(slug);
  if (!movie || movie.status !== "published") notFound();

  const genreIds = (movie.genres ?? []).map((g) => g.id);
  const [credits, similar, session] = await Promise.all([
    getMovieCredits(movie.id),
    getSimilarMovies(movie.id, genreIds),
    getSession(),
  ]);

  let isFavorited = false;
  if (session) {
    const db = await createClient();
    const { data } = await db
      .from("favorites")
      .select("id")
      .eq("user_id", session.userId)
      .eq("movie_id", movie.id)
      .maybeSingle();
    isFavorited = !!data;
  }

  return (
    <TitleModal
      key={movie.id}
      initialFavorited={isFavorited}
      data={{
        type: "movie",
        id: movie.id,
        slug: movie.slug,
        title: movie.title_mn,
        originalTitle: movie.original_title,
        description: movie.description_mn,
        year: movie.release_year,
        ageRating: movie.age_rating,
        durationSeconds: movie.duration_seconds,
        seasonSummary: null,
        genres: (movie.genres ?? []).map((g) => ({
          id: g.id,
          slug: g.slug,
          name: g.name_mn,
        })),
        backdropUrl: movie.backdrop_url,
        posterUrl: movie.poster_url,
        trailerUrl: movie.trailer_url,
        isFree: movie.is_free,
        cast: credits.cast.map((p) => ({
          id: p.id,
          name: p.name,
          photoUrl: p.photo_url,
        })),
        similar: similar.map((m) => ({
          id: m.id,
          slug: m.slug,
          type: "movie" as const,
          title: m.title_mn,
          posterUrl: m.poster_url,
        })),
      }}
    />
  );
}
