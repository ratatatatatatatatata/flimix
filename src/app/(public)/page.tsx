import { Suspense } from "react";
import Link from "next/link";
import { Monitor, Smartphone, Tablet, Tv } from "lucide-react";
import { ContentRow } from "@/components/catalog/ContentRow";
import { PosterCard } from "@/components/catalog/PosterCard";
import { BillboardSkeleton, RowSkeleton } from "@/components/ui/Skeletons";
import { getSession } from "@/lib/auth";
import {
  AUTO_SEE_ALL,
  getAutoSectionContent,
  getBillboard,
  getCatalogCounts,
  getLandingFallbackRows,
  getLatestEpisodesGrid,
  getLatestMoviesGrid,
  getPublishedSections,
  getTopRatedTitles,
  manualSectionItems,
  parseAutoSource,
  type CatalogCard,
} from "@/lib/catalog";
import { formatMnt, formatShortDateMn, t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import type { HomepageSection, Movie, WatchProgress } from "@/types/db";
import { Billboard } from "./Billboard";

type Db = Awaited<ReturnType<typeof createClient>>;

// The landing page always contains the per-user "Үргэлжлүүлэн үзэх" row
// (cookie-bound), so it renders per request — exactly as before. Section data
// itself comes from the shared 60s "catalog" cache, so those renders stay
// DB-free within the revalidate window.
export const dynamic = "force-dynamic";

/* ------------------------------ section access ----------------------------- */

/**
 * Published sections visible right now on web. The list itself comes from the
 * shared "catalog" cache; the time-window check runs per request.
 */
async function getVisibleSections(): Promise<HomepageSection[]> {
  const sections = await getPublishedSections();
  const now = Date.now();
  return sections.filter((s) => {
    const fromOk = !s.visible_from || Date.parse(s.visible_from) <= now;
    const untilOk = !s.visible_until || Date.parse(s.visible_until) >= now;
    const deviceOk =
      !s.device_visibility ||
      s.device_visibility.length === 0 ||
      s.device_visibility.includes("web");
    return fromOk && untilOk && deviceOk;
  });
}

/* -------------------------------- billboard --------------------------------- */

/**
 * Streams independently: the newest trailered title auto-plays muted in a
 * full-bleed billboard under the fixed transparent header. Empty catalog →
 * the original marketing hero.
 */
async function BillboardSection() {
  const data = await getBillboard();

  if (!data) {
    return (
      <section className="relative overflow-hidden bg-gradient-to-b from-ink-900 to-ink-950">
        <div className="container-fx animate-fade-in pb-28 pt-44 text-center">
          <h1 className="mx-auto max-w-2xl font-display text-3xl font-bold text-white sm:text-5xl">
            Монгол болон дэлхийн шилдэг кино нэг дор
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-mist-300">
            Хадмал орчуулгатай, өндөр чанартай стриминг — сард ердөө {formatMnt(14900)}.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link
              href="/subscribe"
              className="rounded-lg bg-brand-gradient px-7 py-3.5 font-medium text-white shadow-accent transition hover:brightness-110"
            >
              {t.choosePlan}
            </Link>
            <Link
              href="/browse"
              className="rounded-lg border border-ink-600 bg-ink-700/70 px-7 py-3.5 font-medium text-mist-100 transition hover:border-royal-500/60"
            >
              {t.categories}
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return <Billboard data={data} />;
}

/* ------------------------------- catalog rows ------------------------------- */

/** ШИНЭ АНГИ — newest episodes grouped per series. */
async function LatestEpisodesRow() {
  const [cards, counts] = await Promise.all([
    getLatestEpisodesGrid(12),
    getCatalogCounts(),
  ]);
  if (cards.length === 0) return null;
  return (
    <ContentRow
      title="ШИНЭ АНГИ"
      count={counts.episodes}
      seeAllHref="/browse?type=series&sort=newest"
    >
      {cards.map((c) => (
        <PosterCard
          key={`ep-${c.seriesSlug}`}
          href={`/series/${c.seriesSlug}`}
          title={c.title}
          posterUrl={c.posterUrl}
          rating={c.rating}
          subtitle={formatShortDateMn(c.date)}
        />
      ))}
    </ContentRow>
  );
}

/** ШИНЭ КИНО — newest movies with subtitle badge. */
async function LatestMoviesRow() {
  const [cards, counts] = await Promise.all([
    getLatestMoviesGrid(12),
    getCatalogCounts(),
  ]);
  if (cards.length === 0) return null;
  return (
    <ContentRow
      title="ШИНЭ КИНО"
      count={counts.movies}
      seeAllHref="/browse?type=movie&sort=newest"
    >
      {cards.map((m) => (
        <PosterCard
          key={`mv-${m.id}`}
          href={`/movie/${m.slug}`}
          title={m.title}
          posterUrl={m.posterUrl}
          year={m.year}
          rating={m.rating}
          isFree={m.isFree}
          cornerBadge={m.subtitleBadge}
        />
      ))}
    </ContentRow>
  );
}

/** ШИЛДЭГ КИНОНУУД — highest-rated titles. */
async function TopRatedRow() {
  const cards = await getTopRatedTitles(10);
  if (cards.length === 0) return null;
  return (
    <ContentRow title="ШИЛДЭГ КИНОНУУД" seeAllHref="/browse?sort=rating">
      {cards.map((c) => (
        <PosterCard
          key={`top-${c.type}-${c.slug}`}
          href={`/${c.type}/${c.slug}`}
          title={c.title}
          posterUrl={c.posterUrl}
          year={c.year}
          rating={c.rating}
        />
      ))}
    </ContentRow>
  );
}

/* ---------------------------- continue watching ---------------------------- */

interface EpisodeJoinRow {
  id: string;
  title_mn: string;
  episode_number: number;
  poster_url: string | null;
  season: {
    season_number: number;
    series: { slug: string; title_mn: string; poster_url: string | null } | null;
  } | null;
}

async function fetchContinueWatching(db: Db, userId: string): Promise<CatalogCard[]> {
  const { data: progressData } = await db
    .from("watch_progress")
    .select("*")
    .eq("user_id", userId)
    .eq("completed", false)
    .gt("progress_seconds", 0)
    .order("last_watched_at", { ascending: false })
    .limit(12);
  const rows = (progressData ?? []) as unknown as WatchProgress[];
  if (rows.length === 0) return [];

  const movieIds = rows.filter((r) => r.content_type === "movie").map((r) => r.content_id);
  const episodeIds = rows.filter((r) => r.content_type === "episode").map((r) => r.content_id);

  const [moviesRes, episodesRes] = await Promise.all([
    movieIds.length
      ? db
          .from("movies")
          .select("*")
          .in("id", movieIds)
          .eq("status", "published")
          .is("deleted_at", null)
      : Promise.resolve({ data: [] }),
    episodeIds.length
      ? db
          .from("episodes")
          .select(
            "id, title_mn, episode_number, poster_url, season:seasons(season_number, series:series(slug, title_mn, poster_url))",
          )
          .in("id", episodeIds)
      : Promise.resolve({ data: [] }),
  ]);

  const movies = new Map(
    ((moviesRes.data ?? []) as unknown as Movie[]).map((m) => [m.id, m]),
  );
  const episodes = new Map(
    ((episodesRes.data ?? []) as unknown as EpisodeJoinRow[]).map((e) => [e.id, e]),
  );

  const cards: CatalogCard[] = [];
  for (const row of rows) {
    const percent =
      row.duration_seconds > 0
        ? Math.min(Math.round((row.progress_seconds / row.duration_seconds) * 100), 100)
        : 0;
    if (row.content_type === "movie") {
      const m = movies.get(row.content_id);
      if (!m) continue;
      cards.push({
        key: `cw-movie-${m.id}`,
        href: `/watch/movie/${m.id}`,
        title: m.title_mn,
        posterUrl: m.poster_url,
        year: m.release_year,
        ageRating: m.age_rating,
        progressPercent: percent,
      });
    } else {
      const e = episodes.get(row.content_id);
      if (!e || !e.season?.series) continue;
      cards.push({
        key: `cw-episode-${e.id}`,
        href: `/watch/episode/${e.id}`,
        title: `${e.season.series.title_mn} · S${e.season.season_number}A${e.episode_number}`,
        posterUrl: e.poster_url ?? e.season.series.poster_url,
        year: null,
        ageRating: null,
        progressPercent: percent,
      });
    }
  }
  return cards;
}

/**
 * Per-user row — the only landing query bound to cookies. Lives in its own
 * Suspense boundary so it never blocks the shell or the catalog rows.
 */
async function ContinueWatchingRow() {
  const session = await getSession();
  if (!session) return null;
  const db = await createClient();
  const cards = await fetchContinueWatching(db, session.userId);
  if (cards.length === 0) return null;
  return (
    <ContentRow title={t.continueWatching} seeAllHref="/account/history">
      {cards.map((c) => (
        <PosterCard
          key={c.key}
          href={c.href}
          title={c.title}
          posterUrl={c.posterUrl}
          year={c.year}
          ageRating={c.ageRating}
          progressPercent={c.progressPercent}
        />
      ))}
    </ContentRow>
  );
}

/* ------------------------------ CMS sections ------------------------------- */

/** One CMS section — resolves its own content so each row streams on its own. */
async function SectionRow({ section }: { section: HomepageSection }) {
  let items: CatalogCard[];
  let seeAllHref: string | undefined;
  if (section.query_type === "auto") {
    const source = parseAutoSource(section.auto_query);
    seeAllHref = AUTO_SEE_ALL[source];
    items = await getAutoSectionContent(source);
  } else {
    items = manualSectionItems(section);
  }
  if (items.length === 0) return null;
  return (
    <ContentRow title={section.title_mn} seeAllHref={seeAllHref}>
      {items.map((c) => (
        <PosterCard
          key={c.key}
          href={c.href}
          title={c.title}
          posterUrl={c.posterUrl}
          year={c.year}
          ageRating={c.ageRating}
          isFree={c.isFree}
        />
      ))}
    </ContentRow>
  );
}

/** Graceful fallback: no CMS sections → rows built straight from the catalog. */
async function FallbackRows() {
  const rows = await getLandingFallbackRows();
  return (
    <>
      {rows.map((row) => (
        <ContentRow key={row.id} title={row.title} seeAllHref={row.seeAllHref}>
          {row.items.map((c) => (
            <PosterCard
              key={c.key}
              href={c.href}
              title={c.title}
              posterUrl={c.posterUrl}
              year={c.year}
              ageRating={c.ageRating}
              isFree={c.isFree}
            />
          ))}
        </ContentRow>
      ))}
    </>
  );
}

/** Section list (cached) → one independent Suspense boundary per row. */
async function CatalogSections() {
  const sections = await getVisibleSections();
  const rowSections = sections.filter((s) => s.layout !== "hero");
  if (rowSections.length === 0) return <FallbackRows />;
  return (
    <>
      {rowSections.map((section) => (
        <Suspense key={section.id} fallback={<RowSkeleton />}>
          <SectionRow section={section} />
        </Suspense>
      ))}
    </>
  );
}

/* ---------------------------------- page ----------------------------------- */

const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: "FLIMIX-ийн үнэ хэд вэ?",
    a: "Сарын багц 14,900₮. Нэг багцаар бүх кино, цувралыг хязгааргүй үзнэ — нэмэлт төлбөр, далд хураамж байхгүй.",
  },
  {
    q: "Ямар төхөөрөмж дээр үзэж болох вэ?",
    a: "Вэб хөтөч, гар утас, таблет болон ухаалаг ТВ-ийн хөтчөөр үзэх боломжтой. iOS, Android аппликэйшн тун удахгүй гарна.",
  },
  {
    q: "Бичлэгийн чанар ямар байх вэ?",
    a: "Контентоос хамааран 360p-ээс 1080p Full HD хүртэл чанараар цацна. Интернэтийн хурдад тохируулан чанар автоматаар солигдоно.",
  },
  {
    q: "Хадмал орчуулгатай юу?",
    a: "Гадаад кино, цувралын дийлэнх нь монгол хадмалтай. Тоглуулагч дээрээс хадмалын хэлийг чөлөөтэй сонгож болно.",
  },
  {
    q: "Багцаа хэрхэн цуцлах вэ?",
    a: "Хүссэн үедээ бүртгэлийн тохиргооноос нэг товшилтоор цуцална. Төлсөн хугацааныхаа эцэс хүртэл үзэх эрх тань хадгалагдана.",
  },
  {
    q: "Ямар аргаар төлбөр төлөх вэ?",
    a: "QPay, SocialPay болон банкны шилжүүлгээр төлөх боломжтой. Төлбөр баталгаажмагц багц шууд идэвхжинэ.",
  },
];

const DEVICES: { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; desc: string }[] = [
  { icon: Monitor, label: "Вэб", desc: "Chrome, Safari, Edge, Firefox" },
  { icon: Smartphone, label: "Гар утас", desc: "iOS болон Android хөтөч" },
  { icon: Tablet, label: "Таблет", desc: "iPad болон Android таблет" },
  { icon: Tv, label: "Ухаалаг ТВ", desc: "WebOS, Tizen, Android TV хөтөч" },
];

/**
 * Landing page — pure streaming-app flow: full-bleed trailer billboard under
 * the fixed header, then full-width horizontal content rows (the first one
 * overlapping the billboard's bottom gradient), then the marketing sections
 * (app promo, devices, FAQ, CTA). Every data-driven piece streams into its
 * own Suspense boundary. Genre/year discovery lives in the header "Ангилал"
 * menu, /browse and the footer.
 */
export default function LandingPage() {
  return (
    <div className="-mt-16">
      {/* --------------------------- TRAILER BILLBOARD ---------------------- */}
      <Suspense fallback={<BillboardSkeleton />}>
        <BillboardSection />
      </Suspense>

      {/* ----------------------------- CONTENT ROWS ------------------------- */}
      <div className="relative z-10 -mt-10 sm:-mt-20">
        <div className="container-fx space-y-10 pb-16">
          <Suspense fallback={<RowSkeleton />}>
            <ContinueWatchingRow />
          </Suspense>

          <Suspense fallback={<RowSkeleton />}>
            <LatestEpisodesRow />
          </Suspense>

          <Suspense fallback={<RowSkeleton />}>
            <LatestMoviesRow />
          </Suspense>

          <Suspense fallback={<RowSkeleton />}>
            <TopRatedRow />
          </Suspense>

          <Suspense
            fallback={
              <>
                <RowSkeleton />
                <RowSkeleton />
              </>
            }
          >
            <CatalogSections />
          </Suspense>
        </div>
      </div>

      {/* --------------------------- MARKETING SECTIONS --------------------- */}
      <div className="container-fx space-y-16 pb-8">
        {/* --------------------------- APP PROMO ---------------------------- */}
        <section className="overflow-hidden rounded-2xl border border-ink-600/40 bg-ink-900">
          <div className="grid items-center gap-12 px-6 py-14 sm:px-10 md:grid-cols-2">
            <div>
              <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">
                FLIMIX хаана ч, хэзээ ч
              </h2>
              <p className="mt-4 max-w-md leading-relaxed text-mist-300">
                Гар утасны аппликэйшн дээр татаж авах, оффлайн үзэх, үргэлжлүүлэн
                үзэх боломжууд бүгд нэг дор. Аппликэйшн тун удахгүй.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <span className="inline-flex flex-col rounded-xl border border-ink-600 bg-ink-800 px-5 py-2.5">
                  <span className="text-[10px] uppercase tracking-widest text-mist-500">
                    {t.comingSoon}
                  </span>
                  <span className="text-sm font-semibold text-mist-100">App Store</span>
                </span>
                <span className="inline-flex flex-col rounded-xl border border-ink-600 bg-ink-800 px-5 py-2.5">
                  <span className="text-[10px] uppercase tracking-widest text-mist-500">
                    {t.comingSoon}
                  </span>
                  <span className="text-sm font-semibold text-mist-100">Google Play</span>
                </span>
              </div>
            </div>

            {/* CSS phone mockup */}
            <div className="flex justify-center" aria-hidden="true">
              <div className="relative h-[420px] w-[210px] rounded-[2.4rem] border border-ink-600 bg-ink-800 p-2 shadow-card">
                <div className="absolute left-1/2 top-2 z-10 h-5 w-24 -translate-x-1/2 rounded-b-2xl bg-ink-950" />
                <div className="flex h-full w-full flex-col overflow-hidden rounded-[1.9rem] bg-gradient-to-b from-royal-700/30 via-ink-900 to-ink-950 p-4 pt-10">
                  <span className="font-display text-sm font-bold tracking-wide text-white">
                    FLIMIX
                  </span>
                  <div className="mt-3 h-20 rounded-lg bg-gradient-to-br from-royal-600/50 to-ink-700" />
                  <div className="mt-3 h-2 w-24 rounded bg-ink-700" />
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="aspect-[2/3] rounded-md bg-ink-700/80" />
                    ))}
                  </div>
                  <div className="mt-auto flex justify-around border-t border-ink-700 pt-3">
                    <div className="h-2 w-8 rounded bg-royal-500/70" />
                    <div className="h-2 w-8 rounded bg-ink-700" />
                    <div className="h-2 w-8 rounded bg-ink-700" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ----------------------------- DEVICES ---------------------------- */}
        <section>
          <h2 className="text-center font-display text-2xl font-bold text-white sm:text-3xl">
            Дуртай төхөөрөмж дээрээ үзээрэй
          </h2>
          <div className="mt-10 grid grid-cols-2 gap-4 xl:grid-cols-4">
            {DEVICES.map((d) => (
              <div
                key={d.label}
                className="card-surface flex flex-col items-center gap-3 px-4 py-8 text-center"
              >
                <d.icon size={32} className="text-royal-400" aria-hidden="true" />
                <p className="font-medium text-white">{d.label}</p>
                <p className="text-xs text-mist-400">{d.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ------------------------------- FAQ ------------------------------ */}
        <div id="zaavar" className="scroll-mt-20">
          <section id="faq" className="mx-auto max-w-3xl scroll-mt-20">
            <h2 className="text-center font-display text-2xl font-bold text-white sm:text-3xl">
              {t.faq}
            </h2>
            <div className="mt-10 space-y-3">
              {FAQ_ITEMS.map((item) => (
                <details key={item.q} className="card-surface group px-5 py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-mist-100 [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <span
                      className="text-royal-400 transition group-open:rotate-45"
                      aria-hidden="true"
                    >
                      +
                    </span>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-mist-300">{item.a}</p>
                </details>
              ))}
            </div>
          </section>
        </div>

        {/* ----------------------------- CTA BAND --------------------------- */}
        <section className="relative overflow-hidden rounded-2xl border border-royal-600/30 bg-gradient-to-r from-royal-700/25 via-ink-800 to-ink-900 px-6 py-14 text-center sm:px-12">
          <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">
            Өнөөдөр эхлээрэй
          </h2>
          <p className="mx-auto mt-3 max-w-md text-mist-300">
            Сарын багц {formatMnt(14900)}{t.perMonth} — хүссэн үедээ цуцална.
          </p>
          <Link
            href="/subscribe"
            className="mt-7 inline-flex items-center justify-center rounded-lg bg-brand-gradient px-8 py-3.5 text-base font-medium text-white shadow-accent transition hover:brightness-110"
          >
            {t.choosePlan}
          </Link>
        </section>
      </div>
    </div>
  );
}
