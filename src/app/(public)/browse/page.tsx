import Link from "next/link";
import type { Metadata } from "next";
import { PosterCard } from "@/components/catalog/PosterCard";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  PAGE_SIZE,
  parseBrowseFilters,
  type BrowseSearchParams,
} from "@/lib/browse";
import { browseCatalog, getBrowseTaxonomies, getReleaseYears } from "@/lib/catalog";
import { t } from "@/lib/i18n";
import { FilterBar } from "./FilterBar";

export const metadata: Metadata = {
  title: "Ангилал",
  description: "FLIMIX-ийн бүх кино, цувралыг төрөл, улс, оноор шүүж үзээрэй.",
};

interface CardItem {
  key: string;
  href: string;
  title: string;
  posterUrl: string | null;
  year: number | null;
  ageRating: string | null;
  isFree?: boolean;
}

/**
 * Server-rendered from searchParams (URLs stay shareable); all data comes from
 * the shared "catalog" cache, so filter/sort/page renders are DB-free within
 * the revalidate window. Pending-state feedback lives in the client FilterBar.
 */
export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<BrowseSearchParams>;
}) {
  const sp = await searchParams;
  const f = parseBrowseFilters(sp);

  const [{ genres, countries, languages }, years, result] = await Promise.all([
    getBrowseTaxonomies(),
    getReleaseYears(),
    browseCatalog(f),
  ]);

  const cards: CardItem[] = [
    ...result.movies.items.map((m) => ({
      key: `movie-${m.id}`,
      href: `/movie/${m.slug}`,
      title: m.title_mn,
      posterUrl: m.poster_url,
      year: m.release_year,
      ageRating: m.age_rating,
      isFree: m.is_free,
    })),
    ...result.series.items.map((s) => ({
      key: `series-${s.id}`,
      href: `/series/${s.slug}`,
      title: s.title_mn,
      posterUrl: s.poster_url,
      year: s.release_year,
      ageRating: s.age_rating,
    })),
  ];

  const perTable = f.type === "all" ? PAGE_SIZE / 2 : PAGE_SIZE;
  const totalCount = result.movies.count + result.series.count;
  const hasPrev = f.page > 1;
  const hasNext =
    f.page * perTable < result.movies.count || f.page * perTable < result.series.count;

  return (
    <div className="container-fx py-10 sm:py-12">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">
          {t.categories}
        </h1>
        <p className="text-sm text-mist-500">Нийт {totalCount} контент</p>
      </div>

      <FilterBar
        filters={f}
        genres={genres.map((g) => ({ key: g.id, label: g.name_mn, value: g.slug }))}
        countries={countries.map((c) => ({ key: c.id, label: c.name_mn, value: c.code }))}
        languages={languages.map((l) => ({ key: l.id, label: l.name_mn, value: l.code }))}
        years={years}
        pagination={cards.length > 0 ? { page: f.page, hasPrev, hasNext } : null}
      >
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
        )}
      </FilterBar>
    </div>
  );
}
