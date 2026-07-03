import Image from "next/image";
import Link from "next/link";
import { Monitor, Play, Smartphone, Tablet, Tv } from "lucide-react";
import { ContentRow } from "@/components/catalog/ContentRow";
import { PosterCard } from "@/components/catalog/PosterCard";
import { Badge } from "@/components/ui/Badge";
import { getSession } from "@/lib/auth";
import { formatMnt, t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import type {
  HomepageSection,
  HomepageSectionItem,
  Movie,
  Series,
  WatchProgress,
} from "@/types/db";

type Db = Awaited<ReturnType<typeof createClient>>;

/* ---------------------------------- cards ---------------------------------- */

interface CardItem {
  key: string;
  href: string;
  title: string;
  posterUrl: string | null;
  year: number | null;
  ageRating: string | null;
  isFree?: boolean;
  progressPercent?: number;
}

interface RowData {
  id: string;
  title: string;
  seeAllHref?: string;
  items: CardItem[];
}

function isLive(x: Pick<Movie, "status" | "deleted_at"> | null | undefined): boolean {
  return !!x && x.status === "published" && !x.deleted_at;
}

function movieToCard(m: Movie): CardItem {
  return {
    key: `movie-${m.id}`,
    href: `/movie/${m.slug}`,
    title: m.title_mn,
    posterUrl: m.poster_url,
    year: m.release_year,
    ageRating: m.age_rating,
    isFree: m.is_free,
  };
}

function seriesToCard(s: Series): CardItem {
  return {
    key: `series-${s.id}`,
    href: `/series/${s.slug}`,
    title: s.title_mn,
    posterUrl: s.poster_url,
    year: s.release_year,
    ageRating: s.age_rating,
  };
}

/* ------------------------------- data loaders ------------------------------ */

async function fetchMovies(
  db: Db,
  opts: { sort: "newest" | "popular"; countryCode?: string; limit?: number },
): Promise<Movie[]> {
  const select = opts.countryCode ? "*, countries!inner(code)" : "*";
  let query = db
    .from("movies")
    .select(select)
    .eq("status", "published")
    .is("deleted_at", null);
  if (opts.countryCode) query = query.eq("countries.code", opts.countryCode);
  const ordered =
    opts.sort === "newest"
      ? query.order("published_at", { ascending: false, nullsFirst: false })
      : query.order("popularity", { ascending: false });
  const { data } = await ordered.limit(opts.limit ?? 14);
  return (data ?? []) as unknown as Movie[];
}

async function fetchSeries(
  db: Db,
  opts: { sort: "newest" | "popular"; limit?: number },
): Promise<Series[]> {
  const query = db
    .from("series")
    .select("*")
    .eq("status", "published")
    .is("deleted_at", null);
  const ordered =
    opts.sort === "newest"
      ? query.order("published_at", { ascending: false, nullsFirst: false })
      : query.order("popularity", { ascending: false });
  const { data } = await ordered.limit(opts.limit ?? 14);
  return (data ?? []) as unknown as Series[];
}

type AutoSource = "newest" | "popular" | "mongolian" | "series";

function parseAutoSource(aq: Record<string, unknown> | null): AutoSource {
  const raw = aq ? (aq.source ?? aq.kind ?? aq.type ?? aq.query) : null;
  switch (raw) {
    case "newest":
    case "new":
    case "latest":
      return "newest";
    case "mongolian":
    case "mn":
      return "mongolian";
    case "series":
      return "series";
    default:
      return "popular";
  }
}

const AUTO_SEE_ALL: Record<AutoSource, string> = {
  newest: "/browse?type=movie&sort=newest",
  popular: "/browse?sort=popular",
  mongolian: "/browse?country=MN",
  series: "/browse?type=series",
};

async function runAutoQuery(db: Db, source: AutoSource): Promise<CardItem[]> {
  switch (source) {
    case "newest":
      return (await fetchMovies(db, { sort: "newest" })).map(movieToCard);
    case "mongolian":
      return (await fetchMovies(db, { sort: "popular", countryCode: "MN" })).map(movieToCard);
    case "series":
      return (await fetchSeries(db, { sort: "popular" })).map(seriesToCard);
    default:
      return (await fetchMovies(db, { sort: "popular" })).map(movieToCard);
  }
}

function manualItems(section: HomepageSection): CardItem[] {
  const items: HomepageSectionItem[] = [...(section.items ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order,
  );
  const cards: CardItem[] = [];
  for (const item of items) {
    if (item.content_type === "movie" && isLive(item.movie)) {
      cards.push(movieToCard(item.movie as Movie));
    } else if (item.content_type === "series" && isLive(item.series)) {
      cards.push(seriesToCard(item.series as Series));
    }
  }
  return cards;
}

async function resolveSection(db: Db, section: HomepageSection): Promise<RowData> {
  if (section.query_type === "auto") {
    const source = parseAutoSource(section.auto_query);
    return {
      id: section.id,
      title: section.title_mn,
      seeAllHref: AUTO_SEE_ALL[source],
      items: await runAutoQuery(db, source),
    };
  }
  return { id: section.id, title: section.title_mn, items: manualItems(section) };
}

/* ----------------------------------- hero ---------------------------------- */

interface HeroData {
  title: string;
  originalTitle: string | null;
  description: string | null;
  backdropUrl: string | null;
  href: string;
  year: number | null;
  ageRating: string | null;
  genres: string[];
  isFree: boolean;
}

function heroFromMovie(m: Movie): HeroData {
  return {
    title: m.title_mn,
    originalTitle: m.original_title,
    description: m.description_mn,
    backdropUrl: m.backdrop_url,
    href: `/movie/${m.slug}`,
    year: m.release_year,
    ageRating: m.age_rating,
    genres: (m.genres ?? []).map((g) => g.name_mn).slice(0, 3),
    isFree: m.is_free,
  };
}

function heroFromSeries(s: Series): HeroData {
  return {
    title: s.title_mn,
    originalTitle: s.original_title,
    description: s.description_mn,
    backdropUrl: s.backdrop_url,
    href: `/series/${s.slug}`,
    year: s.release_year,
    ageRating: s.age_rating,
    genres: (s.genres ?? []).map((g) => g.name_mn).slice(0, 3),
    isFree: false,
  };
}

async function pickHero(db: Db, heroSection: HomepageSection | undefined): Promise<HeroData | null> {
  if (heroSection) {
    const items = [...(heroSection.items ?? [])].sort((a, b) => a.sort_order - b.sort_order);
    for (const item of items) {
      if (item.content_type === "movie" && isLive(item.movie)) {
        return heroFromMovie(item.movie as Movie);
      }
      if (item.content_type === "series" && isLive(item.series)) {
        return heroFromSeries(item.series as Series);
      }
    }
  }
  const { data } = await db
    .from("movies")
    .select("*, genres(*)")
    .eq("status", "published")
    .is("deleted_at", null)
    .not("backdrop_url", "is", null)
    .order("popularity", { ascending: false })
    .limit(1);
  const movie = ((data ?? []) as unknown as Movie[])[0];
  return movie ? heroFromMovie(movie) : null;
}

function excerpt(text: string | null, max = 220): string | null {
  if (!text) return null;
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}…`;
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

async function fetchContinueWatching(db: Db, userId: string): Promise<CardItem[]> {
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

  const cards: CardItem[] = [];
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

export default async function LandingPage() {
  const db = await createClient();
  const session = await getSession();

  const { data: sectionsData } = await db
    .from("homepage_sections")
    .select("*, items:homepage_section_items(*, movie:movies(*, genres(*)), series:series(*, genres(*)))")
    .eq("status", "published")
    .order("sort_order", { ascending: true });

  const now = Date.now();
  const sections = ((sectionsData ?? []) as unknown as HomepageSection[]).filter((s) => {
    const fromOk = !s.visible_from || Date.parse(s.visible_from) <= now;
    const untilOk = !s.visible_until || Date.parse(s.visible_until) >= now;
    const deviceOk =
      !s.device_visibility || s.device_visibility.length === 0 || s.device_visibility.includes("web");
    return fromOk && untilOk && deviceOk;
  });

  const heroSection = sections.find((s) => s.layout === "hero");
  const rowSections = sections.filter((s) => s.layout !== "hero");

  const [hero, continueWatching, sectionRows] = await Promise.all([
    pickHero(db, heroSection),
    session ? fetchContinueWatching(db, session.userId) : Promise.resolve([] as CardItem[]),
    Promise.all(rowSections.map((s) => resolveSection(db, s))),
  ]);

  let rows: RowData[] = sectionRows.filter((r) => r.items.length > 0);

  // Graceful fallback: no CMS sections → build rows straight from the catalog.
  if (rows.length === 0) {
    const [newest, popular, mongolian, seriesList] = await Promise.all([
      fetchMovies(db, { sort: "newest" }),
      fetchMovies(db, { sort: "popular" }),
      fetchMovies(db, { sort: "popular", countryCode: "MN" }),
      fetchSeries(db, { sort: "popular" }),
    ]);
    rows = [
      { id: "fb-newest", title: t.newReleases, seeAllHref: AUTO_SEE_ALL.newest, items: newest.map(movieToCard) },
      { id: "fb-popular", title: t.trending, seeAllHref: AUTO_SEE_ALL.popular, items: popular.map(movieToCard) },
      { id: "fb-mn", title: t.mongolianCinema, seeAllHref: AUTO_SEE_ALL.mongolian, items: mongolian.map(movieToCard) },
      { id: "fb-series", title: t.series, seeAllHref: AUTO_SEE_ALL.series, items: seriesList.map(seriesToCard) },
    ].filter((r) => r.items.length > 0);
  }

  const heroDescription = hero ? excerpt(hero.description) : null;

  return (
    <div>
      {/* ------------------------------- HERO ------------------------------- */}
      {hero ? (
        <section className="relative flex min-h-[72vh] items-end overflow-hidden">
          {hero.backdropUrl ? (
            <Image
              src={hero.backdropUrl}
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-royal-700/25 via-ink-900 to-ink-950" />
          )}
          <div className="absolute inset-0 bg-hero-fade" aria-hidden="true" />
          <div className="container-fx relative z-10 animate-fade-in pb-14 pt-44">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-royal-300">
              FLIMIX онцолж байна
            </p>
            <h1 className="max-w-2xl font-display text-3xl font-bold leading-tight text-white sm:text-5xl">
              {hero.title}
            </h1>
            {hero.originalTitle && hero.originalTitle !== hero.title ? (
              <p className="mt-2 text-sm text-mist-400">{hero.originalTitle}</p>
            ) : null}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {hero.year ? <Badge>{hero.year}</Badge> : null}
              {hero.ageRating ? <Badge tone="accent">{hero.ageRating}</Badge> : null}
              {hero.genres.map((g) => (
                <Badge key={g}>{g}</Badge>
              ))}
              {hero.isFree ? <Badge tone="success">Үнэгүй</Badge> : null}
            </div>
            {heroDescription ? (
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-mist-300 sm:text-base">
                {heroDescription}
              </p>
            ) : null}
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href={hero.href}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-gradient px-7 py-3.5 text-base font-medium text-white shadow-accent transition hover:brightness-110"
              >
                <Play size={18} aria-hidden="true" />
                {t.watchNow}
              </Link>
              <Link
                href={`${hero.href}#trailer`}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-ink-600 bg-ink-700/70 px-7 py-3.5 text-base font-medium text-mist-100 backdrop-blur transition hover:border-royal-500/60"
              >
                {t.watchTrailer}
              </Link>
            </div>
          </div>
        </section>
      ) : (
        <section className="relative overflow-hidden bg-gradient-to-b from-ink-900 to-ink-950">
          <div className="container-fx animate-fade-in py-28 text-center">
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
      )}

      {/* --------------------------- CONTENT ROWS --------------------------- */}
      <div className="container-fx space-y-12 py-12">
        {session && continueWatching.length > 0 ? (
          <ContentRow title={t.continueWatching} seeAllHref="/account/history">
            {continueWatching.map((c) => (
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
        ) : null}

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
      </div>

      {/* ---------------------------- APP PROMO ----------------------------- */}
      <section className="border-y border-ink-600/40 bg-ink-900">
        <div className="container-fx grid items-center gap-12 py-16 md:grid-cols-2">
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

      {/* ----------------------------- DEVICES ------------------------------ */}
      <section className="container-fx py-16">
        <h2 className="text-center font-display text-2xl font-bold text-white sm:text-3xl">
          Дуртай төхөөрөмж дээрээ үзээрэй
        </h2>
        <div className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
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

      {/* ------------------------------- FAQ -------------------------------- */}
      <section id="faq" className="container-fx max-w-3xl py-16">
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

      {/* ----------------------------- CTA BAND ------------------------------ */}
      <section className="container-fx pb-4 pt-8">
        <div className="relative overflow-hidden rounded-2xl border border-royal-600/30 bg-gradient-to-r from-royal-700/25 via-ink-800 to-ink-900 px-6 py-14 text-center sm:px-12">
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
        </div>
      </section>
    </div>
  );
}
