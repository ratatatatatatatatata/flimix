import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import { PosterCard } from "@/components/catalog/PosterCard";
import { ContentRow } from "@/components/catalog/ContentRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { HomepageSection, HomepageSectionItem, Movie, Series } from "@/types/db";
import type { AdminDb } from "../../../_lib/adminAction";

export const dynamic = "force-dynamic";

interface PreviewCard {
  key: string;
  href: string;
  title: string;
  posterUrl: string | null;
  year: number | null;
  ageRating: string | null;
  isFree: boolean;
}

type CardMovie = Pick<Movie, "id" | "slug" | "title_mn" | "poster_url" | "release_year" | "age_rating" | "is_free">;
type CardSeries = Pick<Series, "id" | "slug" | "title_mn" | "poster_url" | "release_year" | "age_rating">;

const movieCard = (m: CardMovie): PreviewCard => ({
  key: `movie:${m.id}`,
  href: `/movie/${m.slug}`,
  title: m.title_mn,
  posterUrl: m.poster_url,
  year: m.release_year,
  ageRating: m.age_rating,
  isFree: m.is_free,
});

const seriesCard = (s: CardSeries): PreviewCard => ({
  key: `series:${s.id}`,
  href: `/series/${s.slug}`,
  title: s.title_mn,
  posterUrl: s.poster_url,
  year: s.release_year,
  ageRating: s.age_rating,
  isFree: false,
});

/** Resolves an auto section the same way the public homepage renderer would. */
async function resolveAutoQuery(db: AdminDb, aq: Record<string, unknown>): Promise<PreviewCard[]> {
  const type = typeof aq.type === "string" ? aq.type : "newest";
  const limit = typeof aq.limit === "number" ? Math.min(Math.max(aq.limit, 1), 40) : 12;
  if (type === "series") {
    const { data } = await db
      .from("series")
      .select("id,slug,title_mn,poster_url,release_year,age_rating")
      .eq("status", "published")
      .is("deleted_at", null)
      .order("published_at", { ascending: false })
      .limit(limit);
    return ((data ?? []) as CardSeries[]).map(seriesCard);
  }

  let query = db
    .from("movies")
    .select("id,slug,title_mn,poster_url,release_year,age_rating,is_free,country:countries(code)")
    .eq("status", "published")
    .is("deleted_at", null)
    .limit(limit);

  if (type === "popular") query = query.order("popularity", { ascending: false });
  else query = query.order("published_at", { ascending: false });

  if (type === "genre" && typeof aq.genre === "string") {
    const { data: genre } = await db.from("genres").select("id").eq("slug", aq.genre).single();
    const genreId = (genre as { id: string } | null)?.id;
    if (!genreId) return [];
    const { data: mg } = await db.from("movie_genres").select("movie_id").eq("genre_id", genreId).limit(500);
    const ids = ((mg ?? []) as { movie_id: string }[]).map((r) => r.movie_id);
    if (ids.length === 0) return [];
    query = query.in("id", ids);
  }
  if (type === "country" && typeof aq.country === "string") {
    const { data: country } = await db.from("countries").select("id").eq("code", aq.country.toUpperCase()).single();
    const countryId = (country as { id: string } | null)?.id;
    if (!countryId) return [];
    query = query.eq("country_id", countryId);
  }

  const { data } = await query;
  return ((data ?? []) as CardMovie[]).map(movieCard);
}

export default async function SectionPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("content_manager");
  const { id } = await params;
  const db = createAdminClient();

  const sectionRes = await db.from("homepage_sections").select("*").eq("id", id).single();
  if (sectionRes.error || !sectionRes.data) notFound();
  const section = sectionRes.data as HomepageSection;

  let cards: PreviewCard[] = [];
  if (section.query_type === "auto" && section.auto_query) {
    cards = await resolveAutoQuery(db, section.auto_query);
  } else {
    const { data: itemsData } = await db
      .from("homepage_section_items")
      .select("*")
      .eq("section_id", id)
      .order("sort_order");
    const items = (itemsData ?? []) as HomepageSectionItem[];
    const movieIds = items.filter((i) => i.content_type === "movie").map((i) => i.content_id);
    const seriesIds = items.filter((i) => i.content_type === "series").map((i) => i.content_id);
    const [mv, sr] = await Promise.all([
      movieIds.length
        ? db.from("movies").select("id,slug,title_mn,poster_url,release_year,age_rating,is_free").in("id", movieIds)
        : Promise.resolve({ data: [] as CardMovie[] }),
      seriesIds.length
        ? db.from("series").select("id,slug,title_mn,poster_url,release_year,age_rating").in("id", seriesIds)
        : Promise.resolve({ data: [] as CardSeries[] }),
    ]);
    const cardMap = new Map<string, PreviewCard>();
    for (const m of (mv.data ?? []) as CardMovie[]) cardMap.set(`movie:${m.id}`, movieCard(m));
    for (const s of (sr.data ?? []) as CardSeries[]) cardMap.set(`series:${s.id}`, seriesCard(s));
    cards = items
      .map((it) => cardMap.get(`${it.content_type}:${it.content_id}`))
      .filter((c): c is PreviewCard => Boolean(c));
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <Link href={`/admin/homepage/${section.id}`} className="inline-flex items-center gap-1.5 text-sm text-mist-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Хэсэг рүү буцах
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-white">Урьдчилан харах</h1>
        <Badge tone="accent">{section.query_type === "auto" ? "Автомат" : "Гараар"}</Badge>
        <Badge>{section.layout}</Badge>
      </div>
      <p className="text-sm text-mist-500">
        Нүүр хуудсан дээр яг ийм байдлаар харагдана (нийтлэгдсэн контент л сайтад гарна).
      </p>

      <div className="rounded-xl border border-ink-600 bg-ink-900 p-6">
        {cards.length === 0 ? (
          <EmptyState title="Харуулах контент алга" description="Хэсэгт контент нэмэх эсвэл auto query-гээ шалгана уу." />
        ) : section.layout === "grid" ? (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-white">{section.title_mn}</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {cards.map((c) => (
                <PosterCard
                  key={c.key}
                  href={c.href}
                  title={c.title}
                  posterUrl={c.posterUrl}
                  year={c.year ?? undefined}
                  ageRating={c.ageRating ?? undefined}
                  isFree={c.isFree}
                />
              ))}
            </div>
          </div>
        ) : (
          <ContentRow title={section.title_mn}>
            {cards.map((c) => (
              <PosterCard
                key={c.key}
                href={c.href}
                title={c.title}
                posterUrl={c.posterUrl}
                year={c.year ?? undefined}
                ageRating={c.ageRating ?? undefined}
                isFree={c.isFree}
              />
            ))}
          </ContentRow>
        )}
      </div>
    </div>
  );
}
