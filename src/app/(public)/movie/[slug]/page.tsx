import { Suspense, cache } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Play } from "lucide-react";
import { ContentRow } from "@/components/catalog/ContentRow";
import { PosterCard } from "@/components/catalog/PosterCard";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { RowSkeleton } from "@/components/ui/Skeletons";
import { getSession } from "@/lib/auth";
import { getMovieBySlug, getMovieCredits, getSimilarMovies } from "@/lib/catalog";
import { formatDuration, t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import type { Movie } from "@/types/db";
import { FavoriteButton } from "../FavoriteButton";

type Params = Promise<{ slug: string }>;

/* ------------------------------ data loaders ------------------------------ */

/** Public movie data — shared "catalog" cache; deduped per request. */
const getMovie = cache((slug: string): Promise<Movie | null> => getMovieBySlug(slug));

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
  const movie = await getMovie(slug);
  if (!movie || movie.status !== "published") return { title: t.notFound };
  return {
    title: `${movie.title_mn}${movie.release_year ? ` (${movie.release_year})` : ""}`,
    description: excerpt(movie.description_mn),
    openGraph: {
      title: movie.title_mn,
      description: excerpt(movie.description_mn),
      type: "video.movie",
      images: movie.backdrop_url ?? movie.poster_url ?? undefined,
    },
  };
}

/** Convert known video-page URLs to embeddable player URLs; null → use <video>. */
function toEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.endsWith("youtube.com") || u.hostname.endsWith("youtube-nocookie.com")) {
      if (u.pathname.startsWith("/embed/")) return url;
      const id = u.searchParams.get("v");
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
    if (u.hostname === "youtu.be") {
      return `https://www.youtube-nocookie.com/embed${u.pathname}`;
    }
    if (u.hostname.endsWith("vimeo.com") && !u.hostname.startsWith("player.")) {
      return `https://player.vimeo.com/video${u.pathname}`;
    }
    if (u.hostname === "player.vimeo.com") return url;
    return null;
  } catch {
    return null;
  }
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/* -------------------------------- sub-views -------------------------------- */

function PersonAvatar({
  name,
  role,
  photoUrl,
}: {
  name: string;
  role: string | null;
  photoUrl: string | null;
}) {
  return (
    <div className="w-24 shrink-0 text-center">
      <div className="relative mx-auto h-20 w-20 overflow-hidden rounded-full border border-ink-600 bg-ink-700">
        {photoUrl ? (
          <Image src={photoUrl} alt={name} fill sizes="80px" className="object-cover" />
        ) : (
          <span
            className="flex h-full w-full items-center justify-center text-lg font-semibold text-mist-400"
            aria-hidden="true"
          >
            {initials(name)}
          </span>
        )}
      </div>
      <p className="mt-2 truncate text-sm text-mist-100" title={name}>
        {name}
      </p>
      {role ? <p className="truncate text-xs text-mist-500">{role}</p> : null}
    </div>
  );
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

function ActionsSkeleton() {
  return (
    <>
      <div className="skeleton h-[50px] w-44 rounded-lg" />
      <div className="skeleton h-[42px] w-36 rounded-lg" />
    </>
  );
}

/**
 * Watch CTA + favorites — the user-specific part of the hero. Streams inside
 * its own Suspense boundary so the page shell paints without waiting for the
 * cookie-bound session and favorites queries.
 */
async function MovieActions({
  movie,
  detailPath,
}: {
  movie: Pick<Movie, "id" | "is_free" | "trailer_url">;
  detailPath: string;
}) {
  const session = await getSession();
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
  const canWatchDirectly = !!session || movie.is_free;

  return (
    <>
      {canWatchDirectly ? (
        <Link
          href={`/watch/movie/${movie.id}`}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-royal-500 px-7 py-3 text-base font-medium text-white shadow-accent transition hover:bg-royal-600"
        >
          <Play size={18} aria-hidden="true" />
          {t.watchNow}
        </Link>
      ) : (
        <Link
          href="/subscribe"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-royal-500 px-7 py-3 text-base font-medium text-white shadow-accent transition hover:bg-royal-600"
        >
          {t.choosePlan}
        </Link>
      )}
      {movie.trailer_url ? (
        <a
          href="#trailer"
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-ink-600 bg-ink-700/70 px-7 py-3 text-base font-medium text-mist-100 backdrop-blur transition hover:border-royal-500/60"
        >
          {t.watchTrailer}
        </a>
      ) : null}
      <FavoriteButton
        contentType="movie"
        contentId={movie.id}
        path={detailPath}
        initialFavorited={isFavorited}
      />
    </>
  );
}

async function SimilarMoviesRow({
  movieId,
  genreIds,
}: {
  movieId: string;
  genreIds: string[];
}) {
  const similar = await getSimilarMovies(movieId, genreIds);
  if (similar.length === 0) return null;
  return (
    <div className="container-fx py-12">
      <ContentRow title={t.similarTitles}>
        {similar.map((m) => (
          <PosterCard
            key={m.id}
            href={`/movie/${m.slug}`}
            title={m.title_mn}
            posterUrl={m.poster_url}
            year={m.release_year}
            ageRating={m.age_rating}
            isFree={m.is_free}
          />
        ))}
      </ContentRow>
    </div>
  );
}

/* ---------------------------------- page ----------------------------------- */

export default async function MovieDetailPage({ params }: { params: Params }) {
  const { slug } = await params;
  const movie = await getMovie(slug);
  if (!movie) notFound();
  if (movie.status !== "published") return <UnavailableNotice />;

  // Public metadata (cast, crew, subtitle languages) — shared "catalog" cache.
  const { cast, crew, subtitles } = await getMovieCredits(movie.id);
  const genreIds = (movie.genres ?? []).map((g) => g.id);

  const detailPath = `/movie/${movie.slug}`;
  const embedUrl = movie.trailer_url ? toEmbedUrl(movie.trailer_url) : null;
  const directors = crew.filter((c) => c.role.toLowerCase() === "director");

  return (
    <div>
      {/* -------------------------------- hero ------------------------------- */}
      <section className="relative overflow-hidden">
        {movie.backdrop_url ? (
          <Image
            src={movie.backdrop_url}
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
          {movie.poster_url ? (
            <div className="relative aspect-[2/3] w-40 shrink-0 overflow-hidden rounded-xl border border-ink-600/60 shadow-card sm:w-52">
              <Image
                src={movie.poster_url}
                alt={movie.title_mn}
                fill
                sizes="(max-width: 640px) 160px, 208px"
                className="object-cover"
              />
            </div>
          ) : null}

          <div className="max-w-2xl pb-1">
            <h1 className="font-display text-3xl font-bold leading-tight text-white sm:text-4xl">
              {movie.title_mn}
            </h1>
            {movie.original_title && movie.original_title !== movie.title_mn ? (
              <p className="mt-1.5 text-sm text-mist-400">{movie.original_title}</p>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {movie.release_year ? <Badge>{movie.release_year}</Badge> : null}
              {movie.duration_seconds ? (
                <Badge>{formatDuration(movie.duration_seconds)}</Badge>
              ) : null}
              {movie.age_rating ? <Badge tone="accent">{movie.age_rating}</Badge> : null}
              {movie.country ? <Badge>{movie.country.name_mn}</Badge> : null}
              {movie.is_free ? <Badge tone="success">Үнэгүй</Badge> : null}
            </div>

            {(movie.genres ?? []).length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {(movie.genres ?? []).map((g) => (
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

            {movie.description_mn ? (
              <p className="mt-4 text-sm leading-relaxed text-mist-300 sm:text-base">
                {movie.description_mn}
              </p>
            ) : null}

            {directors.length > 0 ? (
              <p className="mt-3 text-sm text-mist-400">
                <span className="text-mist-500">{t.director}:</span>{" "}
                {directors.map((d) => d.name).join(", ")}
              </p>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-3">
              <Suspense fallback={<ActionsSkeleton />}>
                <MovieActions
                  movie={{
                    id: movie.id,
                    is_free: movie.is_free,
                    trailer_url: movie.trailer_url,
                  }}
                  detailPath={detailPath}
                />
              </Suspense>
            </div>

            {subtitles.length > 0 ? (
              <p className="mt-5 text-sm text-mist-400">
                <span className="text-mist-500">{t.subtitles}:</span>{" "}
                {subtitles
                  .map((s) => s.language?.name_mn ?? s.label)
                  .filter(Boolean)
                  .join(", ")}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {/* ---------------------------- cast & crew ---------------------------- */}
      {cast.length > 0 || crew.length > 0 ? (
        <section className="container-fx py-12">
          <h2 className="font-display text-lg font-semibold text-white sm:text-xl">
            {t.cast}
          </h2>
          <div className="row-scroll -mx-4 mt-5 flex gap-4 overflow-x-auto px-4 pb-2">
            {cast.map((p) => (
              <PersonAvatar key={p.id} name={p.name} role={null} photoUrl={p.photo_url} />
            ))}
            {crew.map((p) => (
              <PersonAvatar
                key={`crew-${p.id}`}
                name={p.name}
                role={p.role}
                photoUrl={p.photo_url}
              />
            ))}
          </div>
        </section>
      ) : null}

      {/* ------------------------------ trailer ------------------------------ */}
      {movie.trailer_url ? (
        <section id="trailer" className="container-fx scroll-mt-24 py-12">
          <h2 className="font-display text-lg font-semibold text-white sm:text-xl">
            {t.watchTrailer}
          </h2>
          <div className="mt-5 aspect-video overflow-hidden rounded-xl border border-ink-600/50 bg-ink-900">
            {embedUrl ? (
              <iframe
                src={embedUrl}
                title={`${movie.title_mn} — трейлер`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="h-full w-full"
              />
            ) : (
              <video
                src={movie.trailer_url}
                controls
                preload="metadata"
                poster={movie.backdrop_url ?? undefined}
                className="h-full w-full"
              />
            )}
          </div>
        </section>
      ) : null}

      {/* --------------------------- similar titles -------------------------- */}
      <Suspense
        fallback={
          <div className="container-fx py-12">
            <RowSkeleton />
          </div>
        }
      >
        <SimilarMoviesRow movieId={movie.id} genreIds={genreIds} />
      </Suspense>
    </div>
  );
}
