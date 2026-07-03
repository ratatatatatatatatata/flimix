import "server-only";
import type { AdminDb } from "../_lib/adminAction";
import { dayKey, monthKey, daysAgoIso, monthsAgoIso } from "../_lib/format";

/**
 * Report computations shared by the /admin/reports page and the CSV export
 * route. All aggregation happens in JS over bounded result sets (10k rows),
 * which is fine at FLIMIX's current scale.
 */

export interface KV {
  label: string;
  value: number;
}

export interface TopTitleRow {
  title: string;
  kind: "movie" | "series";
  seconds: number;
  viewers: number;
}

export interface PartnerPerfRow {
  partner: string;
  sharePercent: number;
  watchSeconds: number;
  watchShare: number; // 0..1 of tracked watch time
  attributedRevenue: number;
  partnerCut: number;
}

export async function revenueByDay(db: AdminDb, days = 30): Promise<KV[]> {
  const { data } = await db
    .from("payments")
    .select("amount_mnt,paid_at")
    .eq("status", "paid")
    .gte("paid_at", daysAgoIso(days))
    .limit(10000);
  const buckets = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) buckets.set(dayKey(new Date(Date.now() - i * 86_400_000)), 0);
  for (const p of (data ?? []) as { amount_mnt: number; paid_at: string | null }[]) {
    if (!p.paid_at) continue;
    const key = dayKey(new Date(p.paid_at));
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + p.amount_mnt);
  }
  return [...buckets.entries()].map(([label, value]) => ({ label, value }));
}

export async function subscriberGrowthByMonth(db: AdminDb, months = 12): Promise<KV[]> {
  const { data } = await db
    .from("subscriptions")
    .select("created_at")
    .gte("created_at", monthsAgoIso(months - 1))
    .limit(10000);
  const buckets = new Map<string, number>();
  for (let i = months - 1; i >= 0; i--) buckets.set(monthKey(new Date(monthsAgoIso(i))), 0);
  for (const s of (data ?? []) as { created_at: string }[]) {
    const key = monthKey(new Date(s.created_at));
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return [...buckets.entries()].map(([label, value]) => ({ label, value }));
}

export interface ChurnRow {
  month: string;
  newSubs: number;
  cancelled: number;
}

export async function churnByMonth(db: AdminDb, months = 12): Promise<ChurnRow[]> {
  const [createdRes, cancelledRes] = await Promise.all([
    db.from("subscriptions").select("created_at").gte("created_at", monthsAgoIso(months - 1)).limit(10000),
    db
      .from("subscriptions")
      .select("cancelled_at")
      .not("cancelled_at", "is", null)
      .gte("cancelled_at", monthsAgoIso(months - 1))
      .limit(10000),
  ]);
  const rows = new Map<string, ChurnRow>();
  for (let i = months - 1; i >= 0; i--) {
    const key = monthKey(new Date(monthsAgoIso(i)));
    rows.set(key, { month: key, newSubs: 0, cancelled: 0 });
  }
  for (const s of (createdRes.data ?? []) as { created_at: string }[]) {
    const r = rows.get(monthKey(new Date(s.created_at)));
    if (r) r.newSubs++;
  }
  for (const s of (cancelledRes.data ?? []) as { cancelled_at: string }[]) {
    const r = rows.get(monthKey(new Date(s.cancelled_at)));
    if (r) r.cancelled++;
  }
  return [...rows.values()];
}

export interface WatchAggregates {
  totalSeconds: number;
  userCount: number;
  avgSecondsPerUser: number;
}

interface ProgressRow {
  user_id: string;
  content_type: "movie" | "episode";
  content_id: string;
  progress_seconds: number;
}

async function fetchProgress(db: AdminDb): Promise<ProgressRow[]> {
  const { data } = await db
    .from("watch_progress")
    .select("user_id,content_type,content_id,progress_seconds")
    .limit(10000);
  return (data ?? []) as ProgressRow[];
}

export async function watchAggregates(db: AdminDb): Promise<WatchAggregates> {
  const rows = await fetchProgress(db);
  const users = new Set(rows.map((r) => r.user_id));
  const total = rows.reduce((sum, r) => sum + r.progress_seconds, 0);
  return {
    totalSeconds: total,
    userCount: users.size,
    avgSecondsPerUser: users.size ? Math.round(total / users.size) : 0,
  };
}

interface ContentAgg {
  type: "movie" | "episode";
  id: string;
  seconds: number;
  viewers: Set<string>;
}

async function aggregateByContent(db: AdminDb): Promise<Map<string, ContentAgg>> {
  const rows = await fetchProgress(db);
  const map = new Map<string, ContentAgg>();
  for (const r of rows) {
    const key = `${r.content_type}:${r.content_id}`;
    const cur = map.get(key);
    if (cur) {
      cur.seconds += r.progress_seconds;
      cur.viewers.add(r.user_id);
    } else {
      map.set(key, { type: r.content_type, id: r.content_id, seconds: r.progress_seconds, viewers: new Set([r.user_id]) });
    }
  }
  return map;
}

/** Maps episode watch time up to its parent series. Returns top movies + series. */
export async function topTitles(db: AdminDb, limit = 20): Promise<TopTitleRow[]> {
  const byContent = await aggregateByContent(db);

  const movieIds = [...byContent.values()].filter((v) => v.type === "movie").map((v) => v.id);
  const episodeIds = [...byContent.values()].filter((v) => v.type === "episode").map((v) => v.id);

  const [moviesRes, episodesRes] = await Promise.all([
    movieIds.length
      ? db.from("movies").select("id,title_mn").in("id", movieIds)
      : Promise.resolve({ data: [] as { id: string; title_mn: string }[] }),
    episodeIds.length
      ? db.from("episodes").select("id,season_id").in("id", episodeIds)
      : Promise.resolve({ data: [] as { id: string; season_id: string }[] }),
  ]);
  const episodes = (episodesRes.data ?? []) as { id: string; season_id: string }[];
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
  const seasonToSeries = new Map(seasons.map((s) => [s.id, s.series_id]));
  const episodeToSeries = new Map(
    episodes.map((e) => [e.id, seasonToSeries.get(e.season_id) ?? null] as const),
  );
  const seriesTitle = new Map(((seriesRes.data ?? []) as { id: string; title_mn: string }[]).map((s) => [s.id, s.title_mn]));

  // Roll up: movies stay as-is; episodes fold into their series.
  const rolled = new Map<string, TopTitleRow & { viewerSet: Set<string> }>();
  for (const agg of byContent.values()) {
    let key: string;
    let title: string | undefined;
    let kind: "movie" | "series";
    if (agg.type === "movie") {
      key = `movie:${agg.id}`;
      title = movieTitle.get(agg.id);
      kind = "movie";
    } else {
      const sid = episodeToSeries.get(agg.id);
      if (!sid) continue;
      key = `series:${sid}`;
      title = seriesTitle.get(sid);
      kind = "series";
    }
    if (!title) continue;
    const cur = rolled.get(key);
    if (cur) {
      cur.seconds += agg.seconds;
      for (const v of agg.viewers) cur.viewerSet.add(v);
      cur.viewers = cur.viewerSet.size;
    } else {
      rolled.set(key, { title, kind, seconds: agg.seconds, viewers: agg.viewers.size, viewerSet: new Set(agg.viewers) });
    }
  }
  return [...rolled.values()]
    .map(({ title, kind, seconds, viewerSet }) => ({ title, kind, seconds, viewers: viewerSet.size }))
    .sort((a, b) => b.seconds - a.seconds)
    .slice(0, limit);
}

/** DAU approximation: distinct users with a watch session per day. */
export async function dauByDay(db: AdminDb, days = 30): Promise<KV[]> {
  const { data } = await db
    .from("watch_sessions")
    .select("user_id,started_at")
    .gte("started_at", daysAgoIso(days))
    .limit(10000);
  const buckets = new Map<string, Set<string>>();
  for (let i = days - 1; i >= 0; i--) buckets.set(dayKey(new Date(Date.now() - i * 86_400_000)), new Set());
  for (const s of (data ?? []) as { user_id: string; started_at: string }[]) {
    buckets.get(dayKey(new Date(s.started_at)))?.add(s.user_id);
  }
  return [...buckets.entries()].map(([label, set]) => ({ label, value: set.size }));
}

/**
 * Partner performance. ASSUMPTIONS (stated in the UI):
 * - Revenue attribution is proportional to each partner's share of total
 *   tracked watch time over ALL time vs. paid revenue of the last 30 days.
 * - A partner "owns" watch time on content covered by its approved rights.
 * - partnerCut = attributedRevenue x revenue_share_percent.
 */
export async function partnerPerformance(db: AdminDb): Promise<PartnerPerfRow[]> {
  const [byContent, rightsRes, partnersRes, revenue30] = await Promise.all([
    aggregateByContent(db),
    db
      .from("content_rights")
      .select("partner_id,content_type,content_id,revenue_share_percent")
      .eq("approval_status", "approved")
      .not("partner_id", "is", null),
    db.from("content_partners").select("id,name"),
    revenueByDay(db, 30),
  ]);
  const totalRevenue = revenue30.reduce((sum, r) => sum + r.value, 0);
  const partnerName = new Map(
    ((partnersRes.data ?? []) as { id: string; name: string }[]).map((p) => [p.id, p.name]),
  );

  // Map episodes to series for rights matching.
  const episodeIds = [...byContent.values()].filter((v) => v.type === "episode").map((v) => v.id);
  const episodesRes = episodeIds.length
    ? await db.from("episodes").select("id,season_id").in("id", episodeIds)
    : { data: [] as { id: string; season_id: string }[] };
  const episodes = (episodesRes.data ?? []) as { id: string; season_id: string }[];
  const seasonIds = [...new Set(episodes.map((e) => e.season_id))];
  const seasonsRes = seasonIds.length
    ? await db.from("seasons").select("id,series_id").in("id", seasonIds)
    : { data: [] as { id: string; series_id: string }[] };
  const seasonToSeries = new Map(
    ((seasonsRes.data ?? []) as { id: string; series_id: string }[]).map((s) => [s.id, s.series_id]),
  );
  const episodeToSeries = new Map(episodes.map((e) => [e.id, seasonToSeries.get(e.season_id) ?? null] as const));

  // rights key -> partner
  const rightByContent = new Map<string, { partnerId: string; percent: number }>();
  for (const r of (rightsRes.data ?? []) as {
    partner_id: string;
    content_type: "movie" | "series";
    content_id: string;
    revenue_share_percent: number | null;
  }[]) {
    rightByContent.set(`${r.content_type}:${r.content_id}`, {
      partnerId: r.partner_id,
      percent: r.revenue_share_percent ?? 0,
    });
  }

  let totalTracked = 0;
  const perPartner = new Map<string, { seconds: number; percent: number }>();
  for (const agg of byContent.values()) {
    totalTracked += agg.seconds;
    const key =
      agg.type === "movie"
        ? `movie:${agg.id}`
        : episodeToSeries.get(agg.id)
          ? `series:${episodeToSeries.get(agg.id)}`
          : null;
    if (!key) continue;
    const right = rightByContent.get(key);
    if (!right) continue;
    const cur = perPartner.get(right.partnerId);
    if (cur) cur.seconds += agg.seconds;
    else perPartner.set(right.partnerId, { seconds: agg.seconds, percent: right.percent });
  }

  return [...perPartner.entries()]
    .map(([partnerId, v]) => {
      const watchShare = totalTracked > 0 ? v.seconds / totalTracked : 0;
      const attributedRevenue = Math.round(totalRevenue * watchShare);
      return {
        partner: partnerName.get(partnerId) ?? "(устгагдсан түнш)",
        sharePercent: v.percent,
        watchSeconds: v.seconds,
        watchShare,
        attributedRevenue,
        partnerCut: Math.round((attributedRevenue * v.percent) / 100),
      };
    })
    .sort((a, b) => b.watchSeconds - a.watchSeconds);
}
