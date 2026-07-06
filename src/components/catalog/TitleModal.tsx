"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Play, X } from "lucide-react";
import { FavoriteButton } from "@/app/(public)/movie/FavoriteButton";
import { Badge } from "@/components/ui/Badge";
import { formatDuration, t } from "@/lib/i18n";

export interface TitleModalPerson {
  id: string;
  name: string;
  photoUrl: string | null;
}

export interface TitleModalSimilarItem {
  id: string;
  slug: string;
  type: "movie" | "series";
  title: string;
  posterUrl: string | null;
}

export interface TitleModalData {
  type: "movie" | "series";
  id: string;
  slug: string;
  title: string;
  originalTitle: string | null;
  description: string | null;
  year: number | null;
  ageRating: string | null;
  /** Movies only — runtime in seconds. */
  durationSeconds: number | null;
  /** Series only — e.g. "2 бүлэг · 16 анги". */
  seasonSummary: string | null;
  genres: { id: string; slug: string; name: string }[];
  backdropUrl: string | null;
  posterUrl: string | null;
  trailerUrl: string | null;
  isFree: boolean;
  cast: TitleModalPerson[];
  similar: TitleModalSimilarItem[];
}

const PANEL_TRANSITION = { duration: 0.25, ease: "easeOut" as const };

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

/**
 * Quick-look dialog for a movie/series, rendered by the intercepted
 * /movie/[slug] and /series/[slug] routes in the (public) @modal slot.
 * Closing (X, backdrop, Escape) plays a short exit animation, then
 * router.back() restores the underlying page URL.
 */
export function TitleModal({
  data,
  initialFavorited,
}: {
  data: TitleModalData;
  initialFavorited: boolean;
}) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [closing, setClosing] = useState(false);
  const [showTrailer, setShowTrailer] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    if (reduceMotion) {
      router.back();
      return;
    }
    setClosing(true);
  }, [reduceMotion, router]);

  // Focus the close button when the dialog opens.
  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  // Escape closes the dialog.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close]);

  // Lock body scroll while the dialog is open.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const detailPath = data.type === "movie" ? `/movie/${data.slug}` : `/series/${data.slug}`;
  const embedUrl = data.trailerUrl ? toEmbedUrl(data.trailerUrl) : null;
  const metaBadges = [
    data.year ? String(data.year) : null,
    data.type === "movie" && data.durationSeconds
      ? formatDuration(data.durationSeconds)
      : null,
    data.type === "series" ? data.seasonSummary : null,
  ].filter((v): v is string => v !== null);

  return (
    <motion.div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm sm:p-6"
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: closing ? 0 : 1 }}
      transition={PANEL_TRANSITION}
      onAnimationComplete={() => {
        if (closing) router.back();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={data.title}
        initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
        animate={closing ? { opacity: 0, scale: 0.96 } : { opacity: 1, scale: 1 }}
        transition={PANEL_TRANSITION}
        className="glass relative max-h-[90vh] w-full max-w-3xl overflow-y-auto overflow-x-hidden rounded-2xl shadow-card"
      >
        {/* ------------------------- backdrop / trailer ------------------------ */}
        <div className="relative aspect-video w-full bg-ink-900">
          {showTrailer && data.trailerUrl ? (
            embedUrl ? (
              <iframe
                src={embedUrl}
                title={`${data.title} — трейлер`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="h-full w-full"
              />
            ) : (
              <video
                src={data.trailerUrl}
                controls
                autoPlay
                preload="metadata"
                poster={data.backdropUrl ?? undefined}
                className="h-full w-full"
              />
            )
          ) : (
            <>
              {data.backdropUrl ? (
                <Image
                  src={data.backdropUrl}
                  alt=""
                  fill
                  sizes="(max-width: 768px) 100vw, 768px"
                  className="object-cover"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-royal-700/25 via-ink-900 to-ink-950" />
              )}
              <div className="absolute inset-0 bg-card-fade" aria-hidden="true" />
              {data.posterUrl ? (
                <div className="absolute bottom-4 left-5 hidden aspect-[2/3] w-24 overflow-hidden rounded-lg border border-ink-600/60 shadow-card sm:block">
                  <Image
                    src={data.posterUrl}
                    alt={data.title}
                    fill
                    sizes="96px"
                    className="object-cover"
                  />
                </div>
              ) : null}
            </>
          )}
          <button
            ref={closeRef}
            type="button"
            onClick={close}
            aria-label={t.cancel}
            className="glass absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full text-mist-100 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-royal-400"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* --------------------------------- body ------------------------------ */}
        <div className="px-5 pb-6 pt-5 sm:px-7">
          <h2 className="font-display text-2xl font-bold leading-tight text-white">
            {data.title}
          </h2>
          {data.originalTitle && data.originalTitle !== data.title ? (
            <p className="mt-1 text-sm text-mist-400">{data.originalTitle}</p>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {metaBadges.map((label) => (
              <Badge key={label}>{label}</Badge>
            ))}
            {data.ageRating ? <Badge tone="accent">{data.ageRating}</Badge> : null}
            {data.isFree ? <Badge tone="success">Үнэгүй</Badge> : null}
            {data.genres.map((g) => (
              <Badge key={g.id}>{g.name}</Badge>
            ))}
          </div>

          {data.description ? (
            <p className="mt-4 line-clamp-5 text-sm leading-relaxed text-mist-300">
              {data.description}
            </p>
          ) : null}

          {/* ------------------------------ actions ---------------------------- */}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {data.type === "movie" ? (
              <Link
                href={`/watch/movie/${data.id}`}
                className="btn-glow inline-flex items-center justify-center gap-2 rounded-lg bg-brand-gradient px-6 py-2.5 text-sm font-medium text-white"
              >
                <Play size={17} aria-hidden="true" />
                {t.watchNow}
              </Link>
            ) : (
              /* Plain <a> — a hard navigation bypasses the route interception
                 and lands on the full series page with the episode list. */
              <a
                href={detailPath}
                className="btn-glow inline-flex items-center justify-center gap-2 rounded-lg bg-brand-gradient px-6 py-2.5 text-sm font-medium text-white"
              >
                <Play size={17} aria-hidden="true" />
                {t.watchNow}
              </a>
            )}

            {data.trailerUrl ? (
              <button
                type="button"
                onClick={() => setShowTrailer((v) => !v)}
                aria-pressed={showTrailer}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-ink-600 bg-ink-700 px-5 py-2.5 text-sm font-medium text-mist-100 transition hover:border-royal-500/60"
              >
                {showTrailer ? t.back : t.watchTrailer}
              </button>
            ) : null}

            <FavoriteButton
              contentType={data.type}
              contentId={data.id}
              path={detailPath}
              initialFavorited={initialFavorited}
            />

            <a
              href={detailPath}
              className="inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium text-mist-300 transition hover:bg-ink-700/60 hover:text-white"
            >
              Дэлгэрэнгүй
            </a>
          </div>

          {/* -------------------------------- cast ----------------------------- */}
          {data.cast.length > 0 ? (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-white">{t.cast}</h3>
              <div className="row-scroll -mx-1 mt-3 flex gap-4 overflow-x-auto px-1 pb-1">
                {data.cast.map((p) => (
                  <div key={p.id} className="w-16 shrink-0 text-center">
                    <div className="relative mx-auto h-14 w-14 overflow-hidden rounded-full border border-ink-600 bg-ink-700">
                      {p.photoUrl ? (
                        <Image
                          src={p.photoUrl}
                          alt={p.name}
                          fill
                          sizes="56px"
                          className="object-cover"
                        />
                      ) : (
                        <span
                          className="flex h-full w-full items-center justify-center text-sm font-semibold text-mist-400"
                          aria-hidden="true"
                        >
                          {initials(p.name)}
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 truncate text-xs text-mist-300" title={p.name}>
                      {p.name}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* ------------------------------ similar ----------------------------- */}
          {data.similar.length > 0 ? (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-white">{t.similarTitles}</h3>
              <div className="row-scroll -mx-1 mt-3 flex gap-3 overflow-x-auto px-1 pb-1">
                {data.similar.map((s) => (
                  <Link
                    key={s.id}
                    href={`/${s.type}/${s.slug}`}
                    className="group w-24 shrink-0"
                  >
                    <div className="relative aspect-[2/3] overflow-hidden rounded-lg border border-ink-600/50 bg-ink-800">
                      {s.posterUrl ? (
                        <Image
                          src={s.posterUrl}
                          alt={s.title}
                          fill
                          sizes="96px"
                          className="object-cover transition group-hover:scale-105"
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center px-1 text-center text-[11px] text-mist-500">
                          {s.title}
                        </span>
                      )}
                    </div>
                    <p
                      className="mt-1.5 truncate text-xs text-mist-400 transition group-hover:text-white"
                      title={s.title}
                    >
                      {s.title}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </motion.div>
    </motion.div>
  );
}
