import Image from "next/image";
import Link from "next/link";
import { Star } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

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
}

/** Vertical poster card used in rows and grids. */
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
}: PosterCardProps) {
  const meta = subtitle ?? [year, ageRating].filter(Boolean).join(" · ");
  return (
    <Link
      href={href}
      className={
        fluid
          ? "group relative block w-full"
          : "group relative block w-36 shrink-0 sm:w-44"
      }
      title={title}
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-lg border border-ink-600/40 bg-ink-800 shadow-card transition duration-300 group-hover:border-royal-500/50 group-hover:shadow-accent">
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
            className="object-cover transition duration-300 group-hover:scale-[1.03]"
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
        {typeof rating === "number" && rating > 0 ? (
          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-ink-950/80 px-1.5 py-0.5 text-[11px] font-semibold text-mist-100 backdrop-blur-sm">
            <Star size={11} className="text-royal-300" fill="currentColor" aria-hidden="true" />
            {rating.toFixed(1)}
          </span>
        ) : null}
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
