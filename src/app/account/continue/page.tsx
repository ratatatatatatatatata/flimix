import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { PosterCard } from "@/components/catalog/PosterCard";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { t } from "@/lib/i18n";
import { loadWatchItems } from "../watch-data";

export default async function ContinueWatchingPage() {
  const session = await requireUser();
  const items = await loadWatchItems(session.userId, { onlyIncomplete: true });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">{t.continueWatching}</h1>
        <p className="mt-1 text-sm text-mist-400">
          Хагас үзсэн контентоо тасалдсан газраас нь үргэлжлүүлээрэй.
        </p>
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="Үргэлжлүүлэн үзэх зүйл алга"
          description="Кино эсвэл цуврал үзэж эхэлбэл энд харагдана."
          action={
            <Link href="/browse">
              <Button variant="secondary">Контент үзэх</Button>
            </Link>
          }
        />
      ) : (
        <ul className="flex flex-wrap gap-4 sm:gap-5">
          {items.map((item) => (
            <li key={item.key}>
              <PosterCard
                href={item.watchHref}
                title={
                  item.subtitle ? `${item.title} — ${item.subtitle}` : item.title
                }
                posterUrl={item.posterUrl}
                year={item.releaseYear}
                ageRating={item.ageRating}
                progressPercent={item.progressPercent}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
