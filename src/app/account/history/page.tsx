import Link from "next/link";
import Image from "next/image";
import { Play } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { t } from "@/lib/i18n";
import { loadWatchItems, type WatchItem } from "../watch-data";

type GroupKey = "today" | "week" | "earlier";

const groupTitles: Record<GroupKey, string> = {
  today: "Өнөөдөр",
  week: "Энэ долоо хоног",
  earlier: "Өмнөх",
};

function groupOf(iso: string): GroupKey {
  const then = new Date(iso);
  const now = new Date();
  const sameDay =
    then.getFullYear() === now.getFullYear() &&
    then.getMonth() === now.getMonth() &&
    then.getDate() === now.getDate();
  if (sameDay) return "today";
  const diffDays = (now.getTime() - then.getTime()) / 86_400_000;
  return diffDays <= 7 ? "week" : "earlier";
}

function HistoryRow({ item }: { item: WatchItem }) {
  return (
    <li className="flex items-center gap-4 rounded-xl border border-ink-600 bg-ink-800 p-3 sm:p-4">
      <Link
        href={item.detailHref}
        className="relative block h-20 w-14 shrink-0 overflow-hidden rounded-md bg-ink-700"
      >
        {item.posterUrl ? (
          <Image
            src={item.posterUrl}
            alt={item.title}
            fill
            sizes="56px"
            className="object-cover"
          />
        ) : (
          <span className="flex h-full items-center justify-center p-1 text-center text-[10px] text-mist-500">
            {item.title}
          </span>
        )}
      </Link>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={item.detailHref}
            className="truncate font-medium text-mist-100 hover:text-white"
          >
            {item.title}
          </Link>
          {item.completed ? <Badge tone="success">Үзсэн</Badge> : null}
        </div>
        {item.subtitle ? (
          <p className="text-xs text-mist-400">{item.subtitle}</p>
        ) : null}
        <div
          className="h-1 w-full max-w-xs overflow-hidden rounded-full bg-ink-600"
          role="progressbar"
          aria-valuenow={item.progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${item.title} — ${item.progressPercent}% үзсэн`}
        >
          <div
            className="h-full bg-royal-500"
            style={{ width: `${item.progressPercent}%` }}
          />
        </div>
      </div>
      <Link href={item.watchHref} className="shrink-0">
        <Button variant="secondary" size="sm">
          <Play className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">
            {item.completed ? "Дахин үзэх" : "Үргэлжлүүлэх"}
          </span>
        </Button>
      </Link>
    </li>
  );
}

export default async function HistoryPage() {
  const session = await requireUser();
  const items = await loadWatchItems(session.userId);

  const groups: Record<GroupKey, WatchItem[]> = {
    today: [],
    week: [],
    earlier: [],
  };
  for (const item of items) groups[groupOf(item.lastWatchedAt)].push(item);
  const order: GroupKey[] = ["today", "week", "earlier"];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">{t.watchHistory}</h1>
        <p className="mt-1 text-sm text-mist-400">
          Сүүлд үзсэн кино, ангиуд тань энд харагдана.
        </p>
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="Үзсэн түүх хоосон байна"
          description="Кино үзэж эхэлмэгц таны түүх энд бүртгэгдэнэ."
          action={
            <Link href="/browse">
              <Button variant="secondary">Контент үзэх</Button>
            </Link>
          }
        />
      ) : (
        order.map((key) =>
          groups[key].length > 0 ? (
            <section key={key} className="space-y-3">
              <h2 className="text-sm font-medium uppercase tracking-wide text-mist-400">
                {groupTitles[key]}
              </h2>
              <ul className="space-y-3">
                {groups[key].map((item) => (
                  <HistoryRow key={item.key} item={item} />
                ))}
              </ul>
            </section>
          ) : null,
        )
      )}
    </div>
  );
}
