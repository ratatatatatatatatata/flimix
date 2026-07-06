import { requireRole, hasRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatMnt } from "@/lib/i18n";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { MiniBar, type MiniBarDatum } from "./_components/MiniBar";
import {
  humanizeSeconds,
  daysLeft,
  startOfMonthIso,
  monthsAgoIso,
  monthKey,
} from "./_lib/format";
import Link from "next/link";
import type { ContentStatus } from "@/types/db";

export const dynamic = "force-dynamic";

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="card-surface rounded-xl border border-ink-600 bg-ink-800 p-4">
      <p className="text-xs uppercase tracking-wide text-mist-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-mist-400">{hint}</p> : null}
    </div>
  );
}

interface TopTitle {
  title: string;
  href: string;
  seconds: number;
}

interface ExpiringRight {
  id: string;
  title: string;
  rightsOwner: string;
  daysLeft: number;
}

async function loadContentStats(db: ReturnType<typeof createAdminClient>) {
  const [movies, published, drafts, series, episodes] = await Promise.all([
    db.from("movies").select("id", { count: "exact", head: true }).is("deleted_at", null),
    db
      .from("movies")
      .select("id", { count: "exact", head: true })
      .eq("status", "published" satisfies ContentStatus)
      .is("deleted_at", null),
    db
      .from("movies")
      .select("id", { count: "exact", head: true })
      .eq("status", "draft" satisfies ContentStatus)
      .is("deleted_at", null),
    db.from("series").select("id", { count: "exact", head: true }).is("deleted_at", null),
    db.from("episodes").select("id", { count: "exact", head: true }),
  ]);
  return {
    movies: movies.count ?? 0,
    published: published.count ?? 0,
    drafts: drafts.count ?? 0,
    series: series.count ?? 0,
    episodes: episodes.count ?? 0,
  };
}

async function loadTopTitles(db: ReturnType<typeof createAdminClient>): Promise<TopTitle[]> {
  const { data: progress } = await db
    .from("watch_progress")
    .select("content_type,content_id,progress_seconds")
    .limit(10000);

  const rows = (progress ?? []) as {
    content_type: "movie" | "episode";
    content_id: string;
    progress_seconds: number;
  }[];

  const byContent = new Map<string, { type: "movie" | "episode"; id: string; seconds: number }>();
  for (const r of rows) {
    const key = `${r.content_type}:${r.content_id}`;
    const cur = byContent.get(key);
    if (cur) cur.seconds += r.progress_seconds;
    else byContent.set(key, { type: r.content_type, id: r.content_id, seconds: r.progress_seconds });
  }

  const movieIds = [...byContent.values()].filter((v) => v.type === "movie").map((v) => v.id);
  const episodeIds = [...byContent.values()].filter((v) => v.type === "episode").map((v) => v.id);

  const [moviesRes, episodesRes] = await Promise.all([
    movieIds.length
      ? db.from("movies").select("id,title_mn").in("id", movieIds)
      : Promise.resolve({ data: [] as { id: string; title_mn: string }[] }),
    episodeIds.length
      ? db.from("episodes").select("id,title_mn,season_id").in("id", episodeIds)
      : Promise.resolve({ data: [] as { id: string; title_mn: string; season_id: string }[] }),
  ]);

  const episodes = (episodesRes.data ?? []) as { id: string; title_mn: string; season_id: string }[];
  const seasonIds = [...new Set(episodes.map((e) => e.season_id))];
  const seasonsRes = seasonIds.length
    ? await db.from("seasons").select("id,series_id").in("id", seasonIds)
    : { data: [] as { id: string; series_id: string }[] };
  const seasons = (seasonsRes.data ?? []) as { id: string; series_id: string }[];
  const seriesIds = [...new Set(seasons.map((s) => s.series_id))];
  const seriesRes = seriesIds.length
    ? await db.from("series").select("id,title_mn").in("id", seriesIds)
    : { data: [] as { id: string; title_mn: string }[] };

  const movieTitle = new Map(((moviesRes.data ?? []) as { id: string; title_mn: string }[]).map((m) => [m.id, m.title_mn]));
  const seasonSeries = new Map(seasons.map((s) => [s.id, s.series_id]));
  const seriesTitle = new Map(((seriesRes.data ?? []) as { id: string; title_mn: string }[]).map((s) => [s.id, s.title_mn]));

  const titles: TopTitle[] = [];
  for (const v of byContent.values()) {
    if (v.type === "movie") {
      const title = movieTitle.get(v.id);
      if (title) titles.push({ title, href: `/admin/content/${v.id}/edit`, seconds: v.seconds });
    } else {
      const ep = episodes.find((e) => e.id === v.id);
      const sid = ep ? seasonSeries.get(ep.season_id) : undefined;
      const st = sid ? seriesTitle.get(sid) : undefined;
      if (ep && sid && st) {
        titles.push({ title: `${st} — ${ep.title_mn}`, href: `/admin/series/${sid}`, seconds: v.seconds });
      }
    }
  }
  return titles.sort((a, b) => b.seconds - a.seconds).slice(0, 5);
}

export default async function AdminOverviewPage() {
  const session = await requireRole("content_manager");
  const isAdmin = hasRole(session, "admin");
  const db = createAdminClient();

  const contentStats = await loadContentStats(db);

  if (!isAdmin) {
    // Reduced view for content managers: content stats only.
    return (
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-2xl font-semibold text-white">Хяналтын самбар</h1>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <StatCard label="Нийт кино" value={String(contentStats.movies)} />
          <StatCard label="Нийтлэгдсэн" value={String(contentStats.published)} />
          <StatCard label="Ноорог" value={String(contentStats.drafts)} />
          <StatCard label="Цуврал" value={String(contentStats.series)} />
          <StatCard label="Анги" value={String(contentStats.episodes)} />
        </div>
        <p className="text-sm text-mist-500">
          Санхүү болон хэрэглэгчийн статистик зөвхөн админ эрхтэй хэрэглэгчид харагдана.
        </p>
      </div>
    );
  }

  // Full dashboard is admin-only.
  await requireRole("admin");

  const monthStart = startOfMonthIso();
  const nowIso = new Date().toISOString();
  const in30d = new Date(Date.now() + 30 * 86_400_000).toISOString();
  const min15ago = new Date(Date.now() - 15 * 60_000).toISOString();

  const [
    profilesRes,
    activeSubsRes,
    monthPaymentsRes,
    newSubsRes,
    cancelledRes,
    failedRes,
    concurrentRes,
    watchTimeRes,
    revenue6moRes,
    expiringRes,
    topTitles,
  ] = await Promise.all([
    db.from("profiles").select("id", { count: "exact", head: true }),
    db
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .in("status", ["active", "trial"])
      .gt("current_period_end", nowIso),
    db.from("payments").select("amount_mnt").eq("status", "paid").gte("paid_at", monthStart),
    db.from("subscriptions").select("id", { count: "exact", head: true }).gte("created_at", monthStart),
    db
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .not("cancelled_at", "is", null)
      .gte("cancelled_at", monthStart),
    db
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed")
      .gte("created_at", monthStart),
    db
      .from("watch_sessions")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .gte("started_at", min15ago),
    db.from("watch_progress").select("progress_seconds").limit(10000),
    db
      .from("payments")
      .select("amount_mnt,paid_at")
      .eq("status", "paid")
      .gte("paid_at", monthsAgoIso(5)),
    db
      .from("content_rights")
      .select("id,content_type,content_id,rights_owner,rights_end")
      .eq("approval_status", "approved")
      .gte("rights_end", nowIso)
      .lte("rights_end", in30d)
      .order("rights_end", { ascending: true }),
    loadTopTitles(db),
  ]);

  const monthRevenue = ((monthPaymentsRes.data ?? []) as { amount_mnt: number }[]).reduce(
    (sum, p) => sum + p.amount_mnt,
    0,
  );
  const totalWatchSeconds = ((watchTimeRes.data ?? []) as { progress_seconds: number }[]).reduce(
    (sum, p) => sum + p.progress_seconds,
    0,
  );

  // Revenue by last 6 calendar months for the MiniBar.
  const buckets = new Map<string, number>();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(monthsAgoIso(i));
    buckets.set(monthKey(d), 0);
  }
  for (const p of (revenue6moRes.data ?? []) as { amount_mnt: number; paid_at: string | null }[]) {
    if (!p.paid_at) continue;
    const key = monthKey(new Date(p.paid_at));
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + p.amount_mnt);
  }
  const revenueSeries: MiniBarDatum[] = [...buckets.entries()].map(([label, value]) => ({
    label: String(Number(label.slice(5))) + "-р сар",
    value,
  }));

  // Resolve titles for expiring rights.
  const rights = (expiringRes.data ?? []) as {
    id: string;
    content_type: "movie" | "series";
    content_id: string;
    rights_owner: string;
    rights_end: string;
  }[];
  const rMovieIds = rights.filter((r) => r.content_type === "movie").map((r) => r.content_id);
  const rSeriesIds = rights.filter((r) => r.content_type === "series").map((r) => r.content_id);
  const [rMovies, rSeries] = await Promise.all([
    rMovieIds.length
      ? db.from("movies").select("id,title_mn").in("id", rMovieIds)
      : Promise.resolve({ data: [] as { id: string; title_mn: string }[] }),
    rSeriesIds.length
      ? db.from("series").select("id,title_mn").in("id", rSeriesIds)
      : Promise.resolve({ data: [] as { id: string; title_mn: string }[] }),
  ]);
  const titleMap = new Map<string, string>();
  for (const m of (rMovies.data ?? []) as { id: string; title_mn: string }[]) titleMap.set(`movie:${m.id}`, m.title_mn);
  for (const s of (rSeries.data ?? []) as { id: string; title_mn: string }[]) titleMap.set(`series:${s.id}`, s.title_mn);
  const expiring: ExpiringRight[] = rights.map((r) => ({
    id: r.id,
    title: titleMap.get(`${r.content_type}:${r.content_id}`) ?? "(устгагдсан контент)",
    rightsOwner: r.rights_owner,
    daysLeft: daysLeft(r.rights_end),
  }));

  return (
    <div className="space-y-8 animate-fade-in">
      <h1 className="text-2xl font-semibold text-white">Хяналтын самбар</h1>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Нийт хэрэглэгч" value={(profilesRes.count ?? 0).toLocaleString("en-US")} />
        <StatCard label="Идэвхтэй захиалагч" value={(activeSubsRes.count ?? 0).toLocaleString("en-US")} />
        <StatCard label="Энэ сарын орлого" value={formatMnt(monthRevenue)} />
        <StatCard label="Шинэ захиалга (энэ сар)" value={String(newSubsRes.count ?? 0)} />
        <StatCard label="Цуцлалт (энэ сар)" value={String(cancelledRes.count ?? 0)} />
        <StatCard label="Амжилтгүй төлбөр" value={String(failedRes.count ?? 0)} hint="Энэ сар" />
        <StatCard
          label="Зэрэг үзэж буй"
          value={String(concurrentRes.count ?? 0)}
          hint="Сүүлийн 15 минут"
        />
        <StatCard label="Нийт үзсэн хугацаа" value={humanizeSeconds(totalWatchSeconds)} />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <StatCard label="Нийт кино" value={String(contentStats.movies)} />
        <StatCard label="Нийтлэгдсэн" value={String(contentStats.published)} />
        <StatCard label="Ноорог" value={String(contentStats.drafts)} />
        <StatCard label="Цуврал" value={String(contentStats.series)} />
        <StatCard label="Анги" value={String(contentStats.episodes)} />
      </div>

      <section className="card-surface rounded-xl border border-ink-600 bg-ink-800 p-5">
        <h2 className="mb-4 text-lg font-medium text-white">Орлого — сүүлийн 6 сар</h2>
        <MiniBar data={revenueSeries} height={140} formatValue={formatMnt} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card-surface rounded-xl border border-ink-600 bg-ink-800 p-5">
          <h2 className="mb-4 text-lg font-medium text-white">Хамгийн их үзсэн 5 контент</h2>
          {topTitles.length === 0 ? (
            <EmptyState title="Үзэлтийн өгөгдөл алга" description="Хэрэглэгчид контент үзэж эхэлмэгц энд харагдана." />
          ) : (
            <ol className="space-y-2">
              {topTitles.map((tt, i) => (
                <li key={tt.href + i} className="flex items-center justify-between gap-3 rounded-lg bg-ink-900/60 px-3 py-2">
                  <span className="flex items-center gap-3 truncate">
                    <span className="text-sm font-semibold text-royal-400">{i + 1}</span>
                    <Link href={tt.href} className="truncate text-sm text-mist-100 hover:text-royal-300">
                      {tt.title}
                    </Link>
                  </span>
                  <span className="shrink-0 text-xs text-mist-400">{humanizeSeconds(tt.seconds)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="card-surface rounded-xl border border-ink-600 bg-ink-800 p-5">
          <h2 className="mb-4 text-lg font-medium text-white">30 хоногт дуусах эрхүүд</h2>
          {expiring.length === 0 ? (
            <EmptyState title="Дуусах дөхсөн эрх алга" description="Ойрын 30 хоногт дуусах контентын эрх байхгүй байна." />
          ) : (
            <ul className="space-y-2">
              {expiring.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 rounded-lg bg-ink-900/60 px-3 py-2">
                  <span className="truncate">
                    <Link href={`/admin/rights/${r.id}`} className="text-sm text-mist-100 hover:text-royal-300">
                      {r.title}
                    </Link>
                    <span className="ml-2 text-xs text-mist-500">{r.rightsOwner}</span>
                  </span>
                  <Badge tone={r.daysLeft <= 7 ? "danger" : "warning"}>{r.daysLeft} хоног</Badge>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
