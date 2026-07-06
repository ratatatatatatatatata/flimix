import Image from "next/image";
import Link from "next/link";
import { Play, Star } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { CardFavorite } from "@/components/catalog/CardFavorite";
import { t } from "@/lib/i18n";

export interface PosterFavoriteTarget {
  contentType: "movie" | "series";
  contentId: string;
  initialFavorited?: boolean;
}

export interface PosterCardProps {
  href: string;
  title: string;
  posterUrl: string | null;
  year?: number | null;
  ageRating?: string | null;
  progressPercent?: number;
  isFree?: boolean;
  /** Rating badge (top right, one decimal). Hidden when null/undefined/0. */
  rating?: number | null;
  /** Small top-left pill (e.g. "ХАДМАЛ"). Wins over the isFree badge. */
  cornerBadge?: string | null;
  /** Overrides the default "year · ageRating" line under the title. */
  subtitle?: string | null;
  /** Fill the parent (grid cell) instead of the fixed row width. */
  fluid?: boolean;
  /** Enables the hover heart (optimistic favorites toggle, desktop overlay). */
  favorite?: PosterFavoriteTarget;
}

/**
 * Vertical poster card used in rows and grids. On pointer devices (md+) the
 * poster zooms slightly (1.06, transform only — no layout shift) with a purple
 * glow, and a bottom info overlay fades in: play affordance, optional
 * favorites heart, title, year and age rating. On touch a tap simply
 * navigates — the overlay never renders below md.
 */
export function PosterCard({
  href,
  title,
  posterUrl,
  year,
  ageRating,
  progressPercent,
  isFree,
  rating,
  cornerBadge,
  subtitle,
  fluid,
  favorite,
}: PosterCardProps) {
  const meta = subtitle ?? [year, ageRating].filter(Boolean).join(" · ");
  const hasRating = typeof rating === "number" && rating > 0;
  return (
    <Link
      href={href}
      className={
        fluid
          ? "group relative block w-full snap-start md:hover:z-20"
          : "group relative block w-36 shrink-0 snap-start sm:w-44 md:hover:z-20"
      }
      title={title}
    >
      <div className="relative aspect-[2/3] origin-center overflow-hidden rounded-lg border border-ink-600/40 bg-ink-800 shadow-card transition duration-200 ease-out group-hover:border-royal-500/50 group-hover:shadow-accent md:group-hover:scale-[1.06]">
        {posterUrl ? (
          <Image
            src={posterUrl}
            alt={title}
            fill
            sizes={
              fluid
                ? "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                : "(max-width: 640px) 144px, 176px"
            }
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center p-3 text-center text-sm text-mist-500">
            {title}
          </div>
        )}
        {cornerBadge ? (
          <span className="absolute left-2 top-2 rounded-full bg-ink-950/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-mist-100 backdrop-blur-sm">
            {cornerBadge}
          </span>
        ) : isFree ? (
          <div className="absolute left-2 top-2">
            <Badge tone="accent">Үнэгүй</Badge>
          </div>
        ) : null}
        {hasRating ? (
          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-ink-950/80 px-1.5 py-0.5 text-[11px] font-semibold text-mist-100 backdrop-blur-sm">
            <Star size={11} className="text-royal-300" fill="currentColor" aria-hidden="true" />
            {rating.toFixed(1)}
          </span>
        ) : null}
        {/* Hover info overlay — desktop only. Clicks fall through to the
            card link except on the favorites heart. */}
        <div className="absolute inset-0 hidden flex-col justify-end bg-card-fade p-3 opacity-0 transition-opacity duration-200 md:flex md:group-hover:opacity-100">
          <p
            className="pointer-events-none line-clamp-2 text-sm font-semibold leading-snug text-white"
            aria-hidden="true"
          >
            {title}
          </p>
          {year || ageRating || hasRating ? (
            <p
              className="pointer-events-none mt-0.5 flex items-center gap-2 text-[11px] text-mist-300"
              aria-hidden="true"
            >
              {year ? <span>{year}</span> : null}
              {ageRating ? (
                <span className="rounded border border-mist-500/40 px-1 text-[10px] leading-4">
                  {ageRating}
                </span>
              ) : null}
              {hasRating ? (
                <span className="inline-flex items-center gap-0.5">
                  <Star
                    size={10}
                    className="text-royal-300"
                    fill="currentColor"
                    aria-hidden="true"
                  />
                  {rating.toFixed(1)}
                </span>
              ) : null}
            </p>
          ) : null}
          <div className="mt-2 flex items-center justify-between gap-2">
            <span
              className="pointer-events-none inline-flex items-center gap-2 text-xs font-semibold text-white"
              aria-hidden="true"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-gradient shadow-accent">
                <Play size={11} fill="currentColor" aria-hidden="true" />
              </span>
              {t.watchNow}
            </span>
            {favorite ? (
              <CardFavorite
                contentType={favorite.contentType}
                contentId={favorite.contentId}
                initialFavorited={favorite.initialFavorited}
              />
            ) : null}
          </div>
        </div>
        {typeof progressPercent === "number" && progressPercent > 0 ? (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-ink-700">
            <div
              className="h-full bg-royal-500"
              style={{ width: `${Math.min(progressPercent, 100)}%` }}
            />
          </div>
        ) : null}
      </div>
      <div className="mt-2 space-y-0.5">
        <p className="truncate text-sm font-medium text-mist-100 group-hover:text-white">
          {title}
        </p>
        {meta ? <p className="truncate text-xs text-mist-500">{meta}</p> : null}
      </div>
    </Link>
  );
}
