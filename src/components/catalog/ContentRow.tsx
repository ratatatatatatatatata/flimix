import Link from "next/link";
import { RowScroller } from "@/components/catalog/RowScroller";
import { t } from "@/lib/i18n";

/**
 * Streaming-style content row: heading (+ optional catalog count and
 * "see all" link) above a horizontally scrolling card strip with desktop
 * hover arrows handled by RowScroller.
 */
export function ContentRow({
  title,
  count,
  seeAllHref,
  children,
}: {
  title: string;
  count?: number;
  seeAllHref?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-3">
          <h2 className="font-display text-lg font-bold tracking-wide text-white sm:text-xl">
            {title}
          </h2>
          {typeof count === "number" && count > 0 ? (
            <span className="text-xs font-medium text-mist-500">
              {count.toLocaleString("en-US")}
            </span>
          ) : null}
        </div>
        {seeAllHref ? (
          <Link
            href={seeAllHref}
            className="text-sm text-royal-300 transition hover:text-royal-200"
          >
            {t.seeAll} →
          </Link>
        ) : null}
      </div>
      <RowScroller>{children}</RowScroller>
    </section>
  );
}
