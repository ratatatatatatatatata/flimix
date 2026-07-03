import { cache } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Play } from "lucide-react";
import { ContentRow } from "@/components/catalog/ContentRow";
import { PosterCard } from "@/components/catalog/PosterCard";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { getSession } from "@/lib/auth";
import { formatDuration, t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import type {
  CastMember,
  Episode,
  Season,
  Series,
  WatchProgress,
} from "@/types/db";
import { FavoriteButton } from "../../movie/FavoriteButton";

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/* ------------------------------ data loaders ------------------------------ */

const getSeries = cache(async (slug: string): Promise<Series | null> => {
  const db = await createClient();
  const { data } = await db
    .from("series")
    .select("*, genres(*), country:countries(*), seasons(*, episodes(*))")
    .eq("slug", slug)
    .is("deleted_at", null)
    .maybeSingle();
  return (data as unknown as Series | null) ?? null;
});

function excerpt(text: string | null, max = 160): string {
  if (!text) return "FLIMIX дээр үзээрэй.";
  return text.length <= max ? text : `${text.slice(0, max).trimEnd()}…`;
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  const series = await getSeries(slug);
  if (!series || series.status !== "published") return { title: t.notFound };
  return {
    title: `${series.title_mn}${series.release_year ? ` (${series.release_year})` : ""}`,
    description: excerpt(series.description_mn),
    openGraph: {
      title: series.title_mn,
      description: excerpt(series.description_mn),
      type: "video.tv_show",
      images: series.backdrop_url ?? series.poster_url ?? undefined,
    },
  };
}

/** Seasons sorted by number, each with published episodes sorted by number. */
function orderedSeasons(series: Series): (Season & { episodes: Episode[] })[] {
  return [...(series.seasons ?? [])]
    .sort((a, b) => a.season_number - b.season_number)
    .map((s) => ({
      ...s,
      episodes: [...(s.episodes ?? [])]
        .filter((e) => e.status === "published")
        .sort((a, b) => a.episode_number - b.episode_number),
    }))
    .filter((s) => s.episodes.length > 0);
}

interface EpisodeProgress {
  percent: number;
  completed: boolean;
}

function UnavailableNotice() {
  return (
    <div className="container-fx py-24">
      <EmptyState
        title={t.contentUnavailable}
        description="Энэ контентын үзэх эрх түр хугацаанд хаагдсан байна. Бусад олон мянган кино, цувралыг сонирхоорой."
        action={
          <Link
            href="/browse"
            className="rounded-lg bg-royal-500 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-royal-600"
          >
            {t.categories}
          </Link>
        }
      />
    </div>
  );
}

/* ---------------------------------- page ----------------------------------- */

export default async function SeriesDetailPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const series = await getSeries(slug);
  if (!series) notFound();
  if (series.status !== "published") return <UnavailableNotice />;

  const db = await createClient();
  const session = await getSession();
  const seasons = orderedSeasons(series);
  const allEpisodeIds = seasons.flatMap((s) => s.episodes.map((e) => e.id));
  const genreIds = (series.genres ?? []).map((g) => g.id);

  const [castRes, progressRes, similarRes, favRes] = await Promise.all([
    db.from("series_cast").select("cast_members(*)").eq("series_id", series.id),
    session && allEpisodeIds.length
      ? db
          .from("watch_progress")
          .select("*")
          .eq("user_id", session.userId)
          .eq("content_type", "episode")
          .in("content_id", allEpisodeIds)
      : Promise.resolve({ data: [] }),
    genreIds.length
      ? db
          .from("series")
          .select("*, series_genres!inner(genre_id)")
          .in("series_genres.genre_id", genreIds)
          .neq("id", series.id)
          .eq("status", "published")
          .is("deleted_at", null)
          .order("popularity", { ascending: false })
          .limit(12)
      : Promise.resolve({ data: [] }),
    session
      ? db
          .from("favorites")
          .select("id")
          .eq("user_id", session.userId)
          .eq("series_id", series.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const cast = ((castRes.data ?? []) as unknown as { cast_members: CastMember | null }[])
    .map((r) => r.cast_members)
    .filter((p): p is CastMember => p !== null);
  const progressRows = (progressRes.data ?? []) as unknown as WatchProgress[];
  const similar = (similarRes.data ?? []) as unknown as Series[];
  const isFavorited = !!favRes.data;

  const progressMap = new Map<string, EpisodeProgress>(
    progressRows.map((p) => [
      p.content_id,
      {
        percent:
          p.duration_seconds > 0
            ? Math.min(Math.round((p.progress_seconds / p.duration_seconds) * 100), 100)
            : 0,
        completed: p.completed,
      },
    ]),
  );

  // "Next episode": first episode (season/episode order) not yet completed.
  let nextEpisode: { episode: Episode; seasonNumber: number } | null = null;
  for (const season of seasons) {
    for (const ep of season.episodes) {
      if (!progressMap.get(ep.id)?.completed) {
        nextEpisode = { episode: ep, seasonNumber: season.season_number };
        break;
      }
    }
    if (nextEpisode) break;
  }
  const hasAnyProgress = progressRows.length > 0;

  // Season selector via ?season=N (server rendered).
  const seasonParam = Number(Array.isArray(sp.season) ? sp.season[0] : sp.season);
  const selectedSeason =
    seasons.find((s) => s.season_number === seasonParam) ?? seasons[0] ?? null;

  const detailPath = `/series/${series.slug}`;

  return (
    <div>
      {/* -------------------------------- hero ------------------------------- */}
      <section className="relative overflow-hidden">
        {series.backdrop_url ? (
          <Image
            src={series.backdrop_url}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-royal-700/20 via-ink-900 to-ink-950" />
        )}
        <div className="absolute inset-0 bg-hero-fade" aria-hidden="true" />

        <div className="container-fx relative z-10 flex flex-col gap-8 pb-12 pt-32 sm:pt-40 md:flex-row md:items-end">
          {series.poster_url ? (
            <div className="relative aspect-[2/3] w-40 shrink-0 overflow-hidden rounded-xl border border-ink-600/60 shadow-card sm:w-52">
              <Image
                src={series.poster_url}
                alt={series.title_mn}
                fill
                sizes="(max-width: 640px) 160px, 208px"
                className="object-cover"
              />
            </div>
          ) : null}

          <div className="max-w-2xl pb-1">
            <h1 className="font-display text-3xl font-bold leading-tight text-white sm:text-4xl">
              {series.title_mn}
            </h1>
            {series.original_title && series.original_title !== series.title_mn ? (
              <p className="mt-1.5 text-sm text-mist-400">{series.original_title}</p>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {series.release_year ? <Badge>{series.release_year}</Badge> : null}
              <Badge>
                {seasons.length} {t.season.toLowerCase()}
              </Badge>
              {series.age_rating ? <Badge tone="accent">{series.age_rating}</Badge> : null}
            </div>

            {(series.genres ?? []).length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {(series.genres ?? []).map((g) => (
                  <Link
                    key={g.id}
                    href={`/browse?genre=${g.slug}`}
                    className="rounded-full border border-ink-600 bg-ink-800/70 px-3 py-1 text-xs text-mist-300 transition hover:border-royal-500/50 hover:text-white"
                  >
                    {g.name_mn}
                  </Link>
                ))}
              </div>
            ) : null}

            {series.description_mn ? (
              <p className="mt-4 text-sm leading-relaxed text-mist-300 sm:text-base">
                {series.description_mn}
              </p>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-3">
              {session && nextEpisode ? (
                <Link
                  href={`/watch/episode/${nextEpisode.episode.id}`}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-royal-500 px-7 py-3 text-base font-medium text-white shadow-accent transition hover:bg-royal-600"
                >
                  <Play size={18} aria-hidden="true" />
                  {hasAnyProgress
                    ? `${t.continueWatching} S${nextEpisode.seasonNumber}A${nextEpisode.episode.episode_number}`
                    : t.watchNow}
                </Link>
              ) : (
                <Link
                  href="/subscribe"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-royal-500 px-7 py-3 text-base font-medium text-white shadow-accent transition hover:bg-royal-600"
                >
                  {t.choosePlan}
                </Link>
              )}
              {series.trailer_url ? (
                <a
                  href="#trailer"
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-ink-600 bg-ink-700/70 px-7 py-3 text-base font-medium text-mist-100 backdrop-blur transition hover:border-royal-500/60"
                >
                  {t.watchTrailer}
                </a>
              ) : null}
              <FavoriteButton
                contentType="series"
                contentId={series.id}
                path={detailPath}
                initialFavorited={isFavorited}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------ episodes ----------------------------- */}
      <section className="container-fx py-12">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="font-display text-lg font-semibold text-white sm:text-xl">
            {t.episode}
          </h2>
          {seasons.length > 1 ? (
            <nav className="row-scroll flex gap-2 overflow-x-auto" aria-label={t.season}>
              {seasons.map((s) => {
                const active = selectedSeason?.id === s.id;
                return (
                  <Link
                    key={s.id}
                    href={`${detailPath}?season=${s.season_number}`}
                    aria-current={active ? "page" : undefined}
                    className={`shrink-0 rounded-full border px-4 py-1.5 text-sm transition ${
                      active
                        ? "border-royal-500 bg-royal-500 font-medium text-white"
                        : "border-ink-600 bg-ink-800 text-mist-300 hover:border-royal-500/50 hover:text-white"
                    }`}
                  >
                    {t.season} {s.season_number}
                  </Link>
                );
              })}
            </nav>
          ) : null}
        </div>

        {selectedSeason ? (
          <ol className="mt-6 space-y-3">
            {selectedSeason.episodes.map((ep) => {
              const progress = progressMap.get(ep.id);
              return (
                <li key={ep.id}>
                  <Link
                    href={`/watch/episode/${ep.id}`}
                    className="card-surface group flex gap-4 p-3 transition hover:border-royal-500/50 sm:p-4"
                  >
                    <div className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-lg bg-ink-700 sm:w-44">
                      {ep.poster_url ? (
                        <Image
                          src={ep.poster_url}
                          alt=""
                          fill
                          sizes="(max-width: 640px) 128px, 176px"
                          className="object-cover"
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-lg font-semibold text-mist-500">
                          {ep.episode_number}
                        </span>
                      )}
                      <span className="absolute inset-0 flex items-center justify-center bg-ink-950/40 opacity-0 transition group-hover:opacity-100">
                        <Play size={28} className="text-white" aria-hidden="true" />
                      </span>
                      {progress && progress.percent > 0 ? (
                        <span className="absolute inset-x-0 bottom-0 h-1 bg-ink-700">
                          <span
                            className="block h-full bg-royal-500"
                            style={{ width: `${progress.percent}%` }}
                          />
                        </span>
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1 py-1">
                      <p className="truncate font-medium text-mist-100 group-hover:text-white">
                        <span className="mr-2 text-mist-500">{ep.episode_number}.</span>
                        {ep.title_mn}
                      </p>
                      {ep.description_mn ? (
                        <p className="mt-1.5 line-clamp-2 text-sm text-mist-400">
                          {ep.description_mn}
                        </p>
                      ) : null}
                      <p className="mt-2 text-xs text-mist-500">
                        {ep.duration_seconds ? formatDuration(ep.duration_seconds) : null}
                        {progress?.completed ? " · Үзсэн" : null}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="mt-6">
            <EmptyState title="Анги одоогоор нэмэгдээгүй байна" />
          </div>
        )}
      </section>

      {/* -------------------------------- cast ------------------------------- */}
      {cast.length > 0 ? (
        <section className="container-fx py-12">
          <h2 className="font-display text-lg font-semibold text-white sm:text-xl">
            {t.cast}
          </h2>
          <div className="row-scroll -mx-4 mt-5 flex gap-4 overflow-x-auto px-4 pb-2">
            {cast.map((p) => (
              <div key={p.id} className="w-24 shrink-0 text-center">
                <div className="relative mx-auto h-20 w-20 overflow-hidden rounded-full border border-ink-600 bg-ink-700">
                  {p.photo_url ? (
                    <Image
                      src={p.photo_url}
                      alt={p.name}
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  ) : (
                    <span
                      className="flex h-full w-full items-center justify-center text-lg font-semibold text-mist-400"
                      aria-hidden="true"
                    >
                      {p.name
                        .split(/\s+/)
                        .filter(Boolean)
                        .map((w) => w[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase()}
                    </span>
                  )}
                </div>
                <p className="mt-2 truncate text-sm text-mist-100" title={p.name}>
                  {p.name}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* ------------------------------ trailer ------------------------------ */}
      {series.trailer_url ? (
        <section id="trailer" className="container-fx scroll-mt-24 py-12">
          <h2 className="font-display text-lg font-semibold text-white sm:text-xl">
            {t.watchTrailer}
          </h2>
          <div className="mt-5 aspect-video overflow-hidden rounded-xl border border-ink-600/50 bg-ink-900">
            <video
              src={series.trailer_url}
              controls
              preload="metadata"
              poster={series.backdrop_url ?? undefined}
              className="h-full w-full"
            />
          </div>
        </section>
      ) : null}

      {/* --------------------------- similar series -------------------------- */}
      {similar.length > 0 ? (
        <div className="container-fx py-12">
          <ContentRow title={t.similarTitles}>
            {similar.map((s) => (
              <PosterCard
                key={s.id}
                href={`/series/${s.slug}`}
                title={s.title_mn}
                posterUrl={s.poster_url}
                year={s.release_year}
                ageRating={s.age_rating}
              />
            ))}
          </ContentRow>
        </div>
      ) : null}
    </div>
  );
}
