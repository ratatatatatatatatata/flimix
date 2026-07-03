import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";

export interface PosterCardProps {
  href: string;
  title: string;
  posterUrl: string | null;
  year?: number | null;
  ageRating?: string | null;
  progressPercent?: number;
  isFree?: boolean;
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
}: PosterCardProps) {
  return (
    <Link
      href={href}
      className="group relative block w-36 shrink-0 sm:w-44"
      title={title}
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-lg border border-ink-600/40 bg-ink-800 shadow-card transition duration-300 group-hover:border-royal-500/50 group-hover:shadow-accent">
        {posterUrl ? (
          <Image
            src={posterUrl}
            alt={title}
            fill
            sizes="(max-width: 640px) 144px, 176px"
            className="object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center p-3 text-center text-sm text-mist-500">
            {title}
          </div>
        )}
        {isFree ? (
          <div className="absolute left-2 top-2">
            <Badge tone="accent">Үнэгүй</Badge>
          </div>
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
        <p className="text-xs text-mist-500">
          {[year, ageRating].filter(Boolean).join(" · ")}
        </p>
      </div>
    </Link>
  );
}
