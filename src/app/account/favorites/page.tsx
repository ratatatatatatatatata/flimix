import Link from "next/link";
import { X } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PosterCard } from "@/components/catalog/PosterCard";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { t } from "@/lib/i18n";
import type { AgeRating } from "@/types/db";
import { removeFavorite } from "./actions";

interface FavoriteTitle {
  slug: string;
  title_mn: string;
  poster_url: string | null;
  release_year: number | null;
  age_rating: AgeRating | null;
}

interface FavoriteMovie extends FavoriteTitle {
  is_free: boolean;
}

interface FavoriteRow {
  id: string;
  movie: FavoriteMovie | null;
  series: FavoriteTitle | null;
}

export default async function FavoritesPage() {
  const session = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("favorites")
    .select(
      `id,
       movie:movies(slug, title_mn, poster_url, release_year, age_rating, is_free),
       series:series(slug, title_mn, poster_url, release_year, age_rating)`,
    )
    .eq("user_id", session.userId)
    .order("created_at", { ascending: false });

  const favorites = ((data ?? []) as unknown as FavoriteRow[]).filter(
    (row) => row.movie !== null || row.series !== null,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">{t.favorites}</h1>
        <p className="mt-1 text-sm text-mist-400">
          Дуртай кино, цувралууд тань энд хадгалагдана.
        </p>
      </div>

      {favorites.length === 0 ? (
        <EmptyState
          title={t.emptyList}
          description="Кино, цувралын хуудсан дээрх зүрхэн товчоор дуртай жагсаалтаа бүрдүүлээрэй."
          action={
            <Link href="/browse">
              <Button variant="secondary">Контент үзэх</Button>
            </Link>
          }
        />
      ) : (
        <ul className="flex flex-wrap gap-4 sm:gap-5">
          {favorites.map((fav) => {
            const isMovie = fav.movie !== null;
            const item = (fav.movie ?? fav.series) as FavoriteTitle;
            return (
              <li key={fav.id} className="relative">
                <PosterCard
                  href={
                    isMovie ? `/movie/${item.slug}` : `/series/${item.slug}`
                  }
                  title={item.title_mn}
                  posterUrl={item.poster_url}
                  year={item.release_year}
                  ageRating={item.age_rating}
                  isFree={fav.movie?.is_free}
                />
                <form
                  action={removeFavorite}
                  className="absolute right-2 top-2 z-10"
                >
                  <input type="hidden" name="favorite_id" value={fav.id} />
                  <button
                    type="submit"
                    aria-label={`${item.title_mn} — ${t.removeFromList}`}
                    title={t.removeFromList}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-ink-950/80 text-mist-300 backdrop-blur transition hover:bg-red-600 hover:text-white"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
