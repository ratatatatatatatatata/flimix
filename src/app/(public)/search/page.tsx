import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { t } from "@/lib/i18n";
import type { Movie, Series } from "@/types/db";
import { SearchClient, type SuggestionItem } from "./SearchClient";

export const metadata: Metadata = {
  title: t.search,
  description: "FLIMIX-ээс кино, цуврал хайх.",
};

export default async function SearchPage() {
  const db = await createClient();

  const [moviesRes, seriesRes] = await Promise.all([
    db
      .from("movies")
      .select("id, slug, title_mn, poster_url, release_year, age_rating, popularity, is_free")
      .eq("status", "published")
      .is("deleted_at", null)
      .order("popularity", { ascending: false })
      .limit(12),
    db
      .from("series")
      .select("id, slug, title_mn, poster_url, release_year, age_rating, popularity")
      .eq("status", "published")
      .is("deleted_at", null)
      .order("popularity", { ascending: false })
      .limit(6),
  ]);

  type MovieRow = Pick<
    Movie,
    "id" | "slug" | "title_mn" | "poster_url" | "release_year" | "age_rating" | "popularity" | "is_free"
  >;
  type SeriesRow = Pick<
    Series,
    "id" | "slug" | "title_mn" | "poster_url" | "release_year" | "age_rating" | "popularity"
  >;

  const movies = (moviesRes.data ?? []) as unknown as MovieRow[];
  const series = (seriesRes.data ?? []) as unknown as SeriesRow[];

  const popular: SuggestionItem[] = [
    ...movies.map((m) => ({
      id: m.id,
      type: "movie" as const,
      href: `/movie/${m.slug}`,
      title: m.title_mn,
      posterUrl: m.poster_url,
      year: m.release_year,
      ageRating: m.age_rating,
      popularity: m.popularity,
    })),
    ...series.map((s) => ({
      id: s.id,
      type: "series" as const,
      href: `/series/${s.slug}`,
      title: s.title_mn,
      posterUrl: s.poster_url,
      year: s.release_year,
      ageRating: s.age_rating,
      popularity: s.popularity,
    })),
  ]
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, 12);

  const trending = popular.slice(0, 8).map((p) => p.title);

  return (
    <div className="container-fx py-10 sm:py-12">
      <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">
        {t.search}
      </h1>
      <SearchClient trending={trending} recommendations={popular} />
    </div>
  );
}
