import Image from "next/image";
import Link from "next/link";
import { Star } from "lucide-react";

export interface LandscapeCardProps {
  href: string;
  title: string;
  /** Backdrop preferred — the caller passes the poster as a fallback. */
  imageUrl: string | null;
  /** Brand pill bottom-left over the gradient (e.g. "ШИНЭ АНГИ", "ШИНЭ", "ХАДМАЛ"). */
  badge?: string | null;
  /** Neutral pill rendered next to the badge (e.g. "Одоо үзэх"). */
  actionLabel?: string | null;
  /** Rating chip top-right (★ n.n). Hidden when null/undefined/0. */
  rating?: number | null;
  /** Watch progress bar along the bottom edge (0..100). */
  progressPercent?: number;
  /** Small secondary line under the title (date, year …). */
  subtitle?: string | null;
  /** "row" = fixed width for horizontal scrollers, "fluid" = fill the grid cell. */
  width?: "row" | "fluid";
}

/**
 * Wide 16:9 backdrop-style card — the standard streaming row/grid format.
 * Title + subtitle sit bottom-left over a readability gradient, badges in the
 * bottom-left corner above them, rating chip top-right, progress bar along
 * the bottom edge. Desktop hover lifts the card (transform-only, 200ms).
 */
export function LandscapeCard({
  href,
  title,
  imageUrl,
  badge,
  actionLabel,
  rating,
  progressPercent,
  subtitle,
  width = "row",
}: LandscapeCardProps) {
  const pills =
    badge || actionLabel ? (
      <div className="flex flex-wrap items-center gap-1.5">
        {badge ? (
          <span className="rounded bg-brand-gradient px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-accent">
            {badge}
          </span>
        ) : null}
        {actionLabel ? (
          <span className="rounded bg-ink-950/80 px-1.5 py-0.5 text-[10px] font-semibold text-mist-100 backdrop-blur-sm">
            {actionLabel}
          </span>
        ) : null}
      </div>
    ) : null;

  return (
    <Link
      href={href}
      title={title}
      className={
        width === "fluid"
          ? "group relative block w-full snap-start md:hover:z-20"
          : "group relative block w-64 shrink-0 snap-start sm:w-72 md:hover:z-20"
      }
    >
      <div className="relative aspect-video origin-center overflow-hidden rounded-lg border border-ink-600/40 bg-ink-800 transition duration-200 ease-out group-hover:border-royal-500/50 md:group-hover:scale-105 md:group-hover:brightness-110 md:group-hover:shadow-card">
        {imageUrl ? (
          <>
            <Image
              src={imageUrl}
              alt={title}
              fill
              sizes={
                width === "fluid"
                  ? "(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  : "(max-width: 640px) 256px, 288px"
              }
              className="object-cover"
            />
            <div className="absolute inset-0 flex flex-col justify-end gap-1 bg-card-fade p-3">
              {pills}
              <p className="line-clamp-1 text-sm font-semibold leading-snug text-white">
                {title}
              </p>
              {subtitle ? (
                <p className="line-clamp-1 text-xs text-mist-400">{subtitle}</p>
              ) : null}
            </div>
          </>
        ) : (
          <>
            {/* No artwork: centered title on ink-800 with a subtle brand tint. */}
            <div className="absolute inset-0 bg-brand-gradient opacity-10" aria-hidden="true" />
            <div className="flex h-full items-center justify-center p-4 text-center">
              <p className="line-clamp-2 text-sm font-semibold text-mist-200">{title}</p>
            </div>
            {pills ? <div className="absolute bottom-2 left-3">{pills}</div> : null}
          </>
        )}
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
    </Link>
  );
}
