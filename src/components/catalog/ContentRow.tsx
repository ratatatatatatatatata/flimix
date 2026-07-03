import Link from "next/link";
import { t } from "@/lib/i18n";

/** Horizontally scrollable content row with a title and optional "see all". */
export function ContentRow({
  title,
  seeAllHref,
  children,
}: {
  title: string;
  seeAllHref?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-lg font-semibold text-white sm:text-xl">
          {title}
        </h2>
        {seeAllHref ? (
          <Link
            href={seeAllHref}
            className="text-sm text-royal-300 transition hover:text-royal-400"
          >
            {t.seeAll} →
          </Link>
        ) : null}
      </div>
      <div className="row-scroll -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:gap-4">
        {children}
      </div>
    </section>
  );
}
