/**
 * FLIMIX seed script — demo users, catalog, subscriptions, homepage.
 * Idempotent: lookup tables are upserted by natural key; content groups
 * are deleted and re-inserted as a whole.
 *
 * Usage:
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed.mjs
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.");
  process.exit(1);
}

const db = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEMO_HLS = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";
const NIL = "00000000-0000-0000-0000-000000000000";
const now = new Date();
const daysFromNow = (d) => new Date(now.getTime() + d * 86400000).toISOString();
const daysAgo = (d) => new Date(now.getTime() - d * 86400000).toISOString();
const poster = (slug) => `https://picsum.photos/seed/${slug}-p/400/600`;
const backdrop = (slug) => `https://picsum.photos/seed/${slug}-b/1280/720`;

function fail(step, error) {
  console.error(`FAILED [${step}]:`, error.message ?? error);
  process.exit(1);
}

async function must(step, promise) {
  const { data, error } = await promise;
  if (error) fail(step, error);
  console.log(`  ok: ${step}`);
  return data;
}

async function wipe(step, table) {
  const { error } = await db.from(table).delete().neq("id", NIL);
  if (error) fail(`wipe ${table}`, error);
  console.log(`  wiped: ${table}`);
}

// ------------------------------------------------------------------
// 1. Demo auth users
// ------------------------------------------------------------------

async function ensureUser(email, password, displayName, roles) {
  let userId = null;
  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });
  if (error) {
    // already exists -> find it
    const { data: list, error: listErr } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listErr) fail(`listUsers for ${email}`, listErr);
    const existing = list.users.find((u) => u.email === email);
    if (!existing) fail(`ensureUser ${email}`, error);
    userId = existing.id;
  } else {
    userId = data.user.id;
  }

  // handle_new_user trigger grants 'user'; add extra roles here
  const rows = roles.map((role) => ({ user_id: userId, role }));
  const { error: roleErr } = await db
    .from("user_roles")
    .upsert(rows, { onConflict: "user_id,role", ignoreDuplicates: true });
  if (roleErr) fail(`roles for ${email}`, roleErr);
  console.log(`  ok: user ${email} (${roles.join(", ")})`);
  return userId;
}

// ------------------------------------------------------------------
// Static seed data
// ------------------------------------------------------------------

const GENRES = [
  { slug: "action",      name_mn: "Тулаант",              name_en: "Action" },
  { slug: "drama",       name_mn: "Драм",                 name_en: "Drama" },
  { slug: "comedy",      name_mn: "Инээдмийн",            name_en: "Comedy" },
  { slug: "thriller",    name_mn: "Триллер",              name_en: "Thriller" },
  { slug: "romance",     name_mn: "Романтик",             name_en: "Romance" },
  { slug: "sci-fi",      name_mn: "Уран зөгнөлт",         name_en: "Sci-Fi" },
  { slug: "documentary", name_mn: "Баримтат",             name_en: "Documentary" },
  { slug: "family",      name_mn: "Гэр бүлийн",           name_en: "Family" },
];

const COUNTRIES = [
  { code: "MN", name_mn: "Монгол",         name_en: "Mongolia" },
  { code: "US", name_mn: "АНУ",            name_en: "United States" },
  { code: "KR", name_mn: "Өмнөд Солонгос", name_en: "South Korea" },
  { code: "JP", name_mn: "Япон",           name_en: "Japan" },
  { code: "CN", name_mn: "Хятад",          name_en: "China" },
  { code: "RU", name_mn: "Орос",           name_en: "Russia" },
  { code: "FR", name_mn: "Франц",          name_en: "France" },
  { code: "DE", name_mn: "Герман",         name_en: "Germany" },
  { code: "GB", name_mn: "Их Британи",     name_en: "United Kingdom" },
  { code: "IN", name_mn: "Энэтхэг",        name_en: "India" },
];

const LANGUAGES = [
  { code: "mn", name_mn: "Монгол",   name_en: "Mongolian" },
  { code: "en", name_mn: "Англи",    name_en: "English" },
  { code: "ko", name_mn: "Солонгос", name_en: "Korean" },
  { code: "ja", name_mn: "Япон",     name_en: "Japanese" },
  { code: "zh", name_mn: "Хятад",    name_en: "Chinese" },
  { code: "ru", name_mn: "Орос",     name_en: "Russian" },
];

const CAST = [
  "Б. Тэмүүлэн", "С. Ануужин", "Д. Ганзориг", "Ц. Номин-Эрдэнэ", "Э. Билгүүн",
  "Г. Сарнай", "Х. Мөнх-Оргил", "О. Хулан", "Ж. Батсүх", "Н. Мишээл",
  "Т. Идэрбат", "Л. Энхжин", "П. Тэргэл", "Р. Сайнбаяр", "У. Марал",
  "Ч. Даваацэрэн", "Я. Оюунгэрэл", "Ш. Тулга", "К. Ариунзул", "В. Мэндбаяр",
];

const CREW = [
  { name: "З. Баттөмөр",   role: "director" },
  { name: "М. Оюунчимэг",  role: "director" },
  { name: "Д. Нямсүрэн",   role: "producer" },
  { name: "С. Энхтуяа",    role: "producer" },
  { name: "Б. Ганбат",     role: "writer" },
  { name: "Ц. Сэлэнгэ",    role: "writer" },
];

// 24 original, invented demo titles (not real films)
const MOVIES = [
  { slug: "talyn-salhi",        mn: "Талын салхи",             en: "Wind of the Steppe",      year: 2021, c: "MN", g: ["drama"],                min: 108, age: "PG",    pop: 74, rate: 8.1 },
  { slug: "goviin-nuuts",       mn: "Говийн нууц",             en: "Secret of the Gobi",      year: 2019, c: "MN", g: ["action", "thriller"],   min: 116, age: "PG-13", pop: 88, rate: 7.9 },
  { slug: "har-sarnai",         mn: "Хар сарнай",              en: "Black Rose",              year: 2022, c: "MN", g: ["thriller"],             min: 121, age: "R",     pop: 95, rate: 8.4 },
  { slug: "mongon-shono",       mn: "Мөнгөн шөнө",             en: "Silver Night",            year: 2020, c: "MN", g: ["romance", "drama"],     min: 102, age: "PG-13", pop: 67, rate: 7.2 },
  { slug: "altan-urga",         mn: "Алтан урга",              en: "The Golden Lasso",        year: 2018, c: "MN", g: ["drama"],                min: 111, age: "PG",    pop: 59, rate: 7.6 },
  { slug: "suulchiin-nuudel",   mn: "Сүүлчийн нүүдэл",         en: "The Last Migration",      year: 2023, c: "MN", g: ["documentary"],          min:  94, age: "G",     pop: 71, rate: 8.7 },
  { slug: "hotyn-gerel",        mn: "Хотын гэрэл",             en: "City Lights",             year: 2022, c: "MN", g: ["comedy"],               min:  98, age: "PG",    pop: 83, rate: 7.4, free: true },
  { slug: "tengeriin-hulguud",  mn: "Тэнгэрийн хүлгүүд",       en: "Horses of the Sky",       year: 2021, c: "MN", g: ["family", "drama"],      min: 101, age: "G",     pop: 64, rate: 7.8, free: true },
  { slug: "zuud-shig-amidral",  mn: "Зүүд шиг амьдрал",        en: "A Life Like a Dream",     year: 2017, c: "MN", g: ["drama", "romance"],     min: 117, age: "PG-13", pop: 48, rate: 7.0 },
  { slug: "tsagaan-shonhor",    mn: "Цагаан шонхор",           en: "White Falcon",            year: 2024, c: "MN", g: ["action"],               min: 124, age: "PG-13", pop: 91, rate: 8.2 },
  { slug: "ijii-min",           mn: "Ижий минь",               en: "My Dear Mother",          year: 2016, c: "MN", g: ["family", "drama"],      min:  96, age: "G",     pop: 55, rate: 8.9, free: true },
  { slug: "uuliin-suuder",      mn: "Уулын сүүдэр",            en: "Mountain Shadow",         year: 2023, c: "MN", g: ["thriller", "drama"],    min: 113, age: "R",     pop: 77, rate: 7.7 },
  { slug: "hangain-duu",        mn: "Хангайн дуу",             en: "Song of Khangai",         year: 2020, c: "MN", g: ["documentary"],          min:  88, age: "G",     pop: 42, rate: 8.0 },
  { slug: "shine-jiliin-udesh", mn: "Шинэ жилийн үдэш",        en: "New Year's Eve in UB",    year: 2022, c: "MN", g: ["comedy", "romance"],    min: 105, age: "PG",    pop: 69, rate: 6.9 },
  { slug: "midnight-courier",   mn: "Шөнийн элч",              en: "Midnight Courier",        year: 2021, c: "US", g: ["action", "thriller"],   min: 118, age: "R",     pop: 86, rate: 7.5, orig: "Midnight Courier" },
  { slug: "quantum-garden",     mn: "Квант цэцэрлэг",          en: "The Quantum Garden",      year: 2023, c: "US", g: ["sci-fi", "drama"],      min: 132, age: "PG-13", pop: 93, rate: 8.5, orig: "The Quantum Garden" },
  { slug: "seoul-rain",         mn: "Сөүлийн бороо",           en: "Rain over Seoul",         year: 2022, c: "KR", g: ["romance"],              min: 109, age: "PG-13", pop: 81, rate: 8.0, orig: "서울의 비" },
  { slug: "tokyo-circuit",      mn: "Токиогийн тойрог",        en: "Tokyo Circuit",           year: 2020, c: "JP", g: ["action"],               min: 114, age: "PG-13", pop: 72, rate: 7.3, orig: "東京サーキット" },
  { slug: "red-planet-diaries", mn: "Улаан гаригийн тэмдэглэл", en: "Red Planet Diaries",     year: 2024, c: "US", g: ["sci-fi"],               min: 127, age: "PG-13", pop: 89, rate: 8.3, orig: "Red Planet Diaries", status: "scheduled" },
  { slug: "baker-street-heist", mn: "Лондонгийн дээрэм",       en: "The Baker Street Heist",  year: 2019, c: "GB", g: ["thriller", "comedy"],   min: 106, age: "PG-13", pop: 78, rate: 7.6, orig: "The Baker Street Heist" },
  { slug: "siberian-express",   mn: "Сибирийн галт тэрэг",     en: "Siberian Express",        year: 2018, c: "RU", g: ["action", "thriller"],   min: 119, age: "R",     pop: 61, rate: 7.1, orig: "Сибирский экспресс" },
  { slug: "derniere-valse",     mn: "Сүүлчийн вальс",          en: "The Last Waltz in Paris", year: 2021, c: "FR", g: ["drama", "romance"],     min: 104, age: "PG-13", pop: 57, rate: 7.8, orig: "La Dernière Valse" },
  { slug: "mumbai-melody",      mn: "Мумбайн аялгуу",          en: "Mumbai Melody",           year: 2022, c: "IN", g: ["family", "comedy"],     min: 138, age: "G",     pop: 66, rate: 7.4, orig: "Mumbai Melody", free: true },
  { slug: "berlin-code",        mn: "Берлиний код",            en: "Berlin Code",             year: 2023, c: "DE", g: ["thriller", "sci-fi"],   min: 122, age: "PG-13", pop: 84, rate: 7.9, orig: "Berlin Code", status: "draft" },
];

const SERIES = [
  {
    slug: "nuudelchid", mn: "Нүүдэлчид", en: "The Nomads", year: 2022, c: "MN",
    g: ["drama"], age: "PG-13", pop: 92, rate: 8.6,
    seasons: [
      { n: 1, title: "1-р бүлэг", eps: 8 },
      { n: 2, title: "2-р бүлэг", eps: 6 },
    ],
  },
  {
    slug: "hotyn-domog", mn: "Хотын домог", en: "City Legends", year: 2023, c: "MN",
    g: ["thriller", "drama"], age: "R", pop: 85, rate: 8.1,
    seasons: [{ n: 1, title: "1-р бүлэг", eps: 6 }],
  },
  {
    slug: "sansryn-zam", mn: "Сансрын зам", en: "Starpath", year: 2021, c: "US",
    g: ["sci-fi"], age: "PG-13", pop: 79, rate: 8.2, orig: "Starpath",
    seasons: [{ n: 1, title: "Season 1", eps: 8 }],
  },
  {
    slug: "ailyn-huuhduud", mn: "Айлын хүүхдүүд", en: "Kids Next Door", year: 2020, c: "MN",
    g: ["family", "comedy"], age: "G", pop: 62, rate: 7.5,
    seasons: [{ n: 1, title: "1-р бүлэг", eps: 4 }],
  },
];

// ------------------------------------------------------------------
// Main
// ------------------------------------------------------------------

async function main() {
  console.log(`FLIMIX seed -> ${url}`);

  console.log("\n[1/9] demo users");
  const adminId = await ensureUser("admin@flimix.mn", "Admin123!", "Админ", ["super_admin", "admin"]);
  await ensureUser("manager@flimix.mn", "Manager123!", "Контент менежер", ["content_manager"]);
  const demoId = await ensureUser("demo@flimix.mn", "Demo123!", "Демо хэрэглэгч", ["user"]);

  console.log("\n[2/9] lookup tables (upsert)");
  const genres = await must("genres", db.from("genres").upsert(GENRES, { onConflict: "slug" }).select());
  const countries = await must("countries", db.from("countries").upsert(COUNTRIES, { onConflict: "code" }).select());
  const languages = await must("languages", db.from("languages").upsert(LANGUAGES, { onConflict: "code" }).select());
  await must("subscription plan", db.from("subscription_plans").upsert([{
    slug: "monthly",
    name_mn: "Сарын багц",
    name_en: "Monthly",
    price_mnt: 14900,
    duration_days: 30,
    device_limit: 4,
    stream_limit: 2,
    trial_days: 0,
    features_mn: ["Бүх кино, цуврал", "HD ба Full HD чанар", "4 төхөөрөмж", "2 зэрэг үзэлт"],
    is_active: true,
  }], { onConflict: "slug" }).select());

  const genreId = Object.fromEntries(genres.map((g) => [g.slug, g.id]));
  const countryId = Object.fromEntries(countries.map((c) => [c.code, c.id]));
  const langId = Object.fromEntries(languages.map((l) => [l.code, l.id]));
  const { data: plans } = await db.from("subscription_plans").select().eq("slug", "monthly");
  const planId = plans[0].id;

  console.log("\n[3/9] wipe re-seedable content groups");
  await wipe("sections", "homepage_sections");        // items cascade
  await wipe("rights", "content_rights");             // documents cascade
  await wipe("partners", "content_partners");         // revenue shares cascade
  await wipe("subtitles", "subtitle_tracks");
  await wipe("audio", "audio_tracks");
  await wipe("movies", "movies");                     // junctions/favorites cascade
  await wipe("series", "series");                     // seasons/episodes cascade
  await wipe("cast", "cast_members");
  await wipe("crew", "crew_members");
  await wipe("assets", "video_assets");

  console.log("\n[4/9] people & shared demo video asset");
  const cast = await must("cast_members", db.from("cast_members").insert(
    CAST.map((name, i) => ({ name, photo_url: `https://picsum.photos/seed/cast-${i}/300/300` })),
  ).select());
  await must("crew_members", db.from("crew_members").insert(
    CREW.map((c, i) => ({ ...c, photo_url: `https://picsum.photos/seed/crew-${i}/300/300` })),
  ).select());

  // One shared mock asset referenced by every published title
  const assets = await must("video_asset", db.from("video_assets").insert([{
    provider: "mock",
    provider_video_id: "demo",
    hls_path: DEMO_HLS,
    qualities: ["360p", "480p", "720p", "1080p"],
    duration_seconds: 634,
    status: "ready",
  }]).select());
  const assetId = assets[0].id;

  console.log("\n[5/9] movies");
  const movieRows = MOVIES.map((m, i) => {
    const status = m.status ?? "published";
    return {
      slug: m.slug,
      title_mn: m.mn,
      title_en: m.en,
      original_title: m.orig ?? null,
      description_mn: `«${m.mn}» — ${m.year} онд нээлтээ хийсэн уран бүтээл. Хүний хувь заяа, итгэл найдвар, сорилтын тухай сэтгэл хөдөлгөм түүхийг өгүүлнэ.`,
      description_en: `"${m.en}" (${m.year}) — an original FLIMIX demo title.`,
      release_year: m.year,
      duration_seconds: m.min * 60,
      age_rating: m.age,
      country_id: countryId[m.c],
      poster_url: poster(m.slug),
      backdrop_url: backdrop(m.slug),
      trailer_url: null,
      playback_asset_id: status === "published" ? assetId : null,
      popularity: m.pop,
      rating: m.rate,
      is_free: !!m.free,
      status,
      published_at: status === "published" ? daysAgo(3 + i * 11) : status === "scheduled" ? daysFromNow(14) : null,
    };
  });
  const movies = await must("movies", db.from("movies").insert(movieRows).select());
  const movieId = Object.fromEntries(movies.map((m) => [m.slug, m.id]));

  const mg = [];
  const mc = [];
  MOVIES.forEach((m, i) => {
    for (const g of m.g) mg.push({ movie_id: movieId[m.slug], genre_id: genreId[g] });
    for (let k = 0; k < 4; k++) {
      mc.push({
        movie_id: movieId[m.slug],
        cast_member_id: cast[(i * 3 + k) % cast.length].id,
        character_name: null,
        sort_order: k,
      });
    }
  });
  await must("movie_genres", db.from("movie_genres").insert(mg));
  await must("movie_cast", db.from("movie_cast").insert(mc));

  console.log("\n[6/9] series, seasons, episodes");
  const seriesRows = SERIES.map((s, i) => ({
    slug: s.slug,
    title_mn: s.mn,
    title_en: s.en,
    original_title: s.orig ?? null,
    description_mn: `«${s.mn}» — олон ангит уран бүтээл. Анги бүр үзэгчдийг шинэ эргэлтээр угтана.`,
    description_en: `"${s.en}" (${s.year}) — an original FLIMIX demo series.`,
    release_year: s.year,
    age_rating: s.age,
    country_id: countryId[s.c],
    poster_url: poster(s.slug),
    backdrop_url: backdrop(s.slug),
    trailer_url: null,
    popularity: s.pop,
    rating: s.rate,
    status: "published",
    published_at: daysAgo(10 + i * 25),
  }));
  const seriesRes = await must("series", db.from("series").insert(seriesRows).select());
  const seriesId = Object.fromEntries(seriesRes.map((s) => [s.slug, s.id]));

  const sg = [];
  const sc = [];
  SERIES.forEach((s, i) => {
    for (const g of s.g) sg.push({ series_id: seriesId[s.slug], genre_id: genreId[g] });
    for (let k = 0; k < 5; k++) {
      sc.push({
        series_id: seriesId[s.slug],
        cast_member_id: cast[(i * 5 + k + 7) % cast.length].id,
        character_name: null,
        sort_order: k,
      });
    }
  });
  await must("series_genres", db.from("series_genres").insert(sg));
  await must("series_cast", db.from("series_cast").insert(sc));

  for (const s of SERIES) {
    for (const season of s.seasons) {
      const seasonRes = await must(
        `season ${s.slug} S${season.n}`,
        db.from("seasons").insert([{
          series_id: seriesId[s.slug],
          season_number: season.n,
          title: season.title,
          description: null,
        }]).select(),
      );
      const epRows = Array.from({ length: season.eps }, (_, k) => ({
        season_id: seasonRes[0].id,
        episode_number: k + 1,
        title_mn: `${k + 1}-р анги`,
        title_en: `Episode ${k + 1}`,
        description_mn: `«${s.mn}» цувралын ${season.n}-р бүлгийн ${k + 1}-р анги.`,
        duration_seconds: 2400 + (k % 4) * 180,
        poster_url: `https://picsum.photos/seed/${s.slug}-s${season.n}e${k + 1}/640/360`,
        playback_asset_id: assetId,
        intro_start_seconds: 5,
        intro_end_seconds: 65,
        status: "published",
        published_at: daysAgo(9),
      }));
      await must(`episodes ${s.slug} S${season.n}`, db.from("episodes").insert(epRows));
    }
  }

  console.log("\n[7/9] subtitle tracks");
  const subtitled = ["har-sarnai", "quantum-garden", "seoul-rain", "goviin-nuuts"];
  const subRows = subtitled.flatMap((slug) => [
    { content_type: "movie", content_id: movieId[slug], language_id: langId.mn, label: "Монгол", url: `https://cdn.flimix.mn/subtitles/${slug}.mn.vtt`, is_default: true },
    { content_type: "movie", content_id: movieId[slug], language_id: langId.en, label: "English", url: `https://cdn.flimix.mn/subtitles/${slug}.en.vtt`, is_default: false },
  ]);
  await must("subtitle_tracks", db.from("subtitle_tracks").insert(subRows));

  console.log("\n[8/9] partners, rights, homepage, promo");
  const partners = await must("content_partners", db.from("content_partners").insert([
    { name: "Steppe Vision Pictures", contact_email: "license@steppevision.mn", contact_phone: "+976 7011 0011" },
    { name: "Nomad Films Distribution", contact_email: "rights@nomadfilms.mn", contact_phone: "+976 7011 0022" },
  ]).select());

  const rightsMovies = ["talyn-salhi", "goviin-nuuts", "har-sarnai", "mongon-shono", "suulchiin-nuudel", "hotyn-gerel", "quantum-garden", "seoul-rain"];
  const rightRows = rightsMovies.map((slug, i) => ({
    content_type: "movie",
    content_id: movieId[slug],
    partner_id: partners[i % 2].id,
    rights_owner: partners[i % 2].name,
    contract_number: `FLX-2024-${String(i + 1).padStart(3, "0")}`,
    rights_start: "2024-01-01",
    // one licence expiring within 30 days -> feeds the admin expiry warning
    rights_end: i === 0 ? daysFromNow(20).slice(0, 10) : "2027-12-31",
    allowed_countries: ["MN"],
    allowed_platforms: ["web", "mobile", "tv"],
    is_exclusive: i % 3 === 0,
    revenue_share_percent: 40,
    approval_status: "approved",
    admin_notes: i === 0 ? "Гэрээний хугацаа удахгүй дуусна — сунгалт шаардлагатай." : null,
  }));
  rightRows.push(
    {
      content_type: "series", content_id: seriesId["nuudelchid"], partner_id: partners[0].id,
      rights_owner: partners[0].name, contract_number: "FLX-2024-101",
      rights_start: "2024-01-01", rights_end: "2028-06-30",
      allowed_countries: ["MN"], allowed_platforms: ["web", "mobile", "tv"],
      is_exclusive: true, revenue_share_percent: 45, approval_status: "approved", admin_notes: null,
    },
    {
      content_type: "series", content_id: seriesId["hotyn-domog"], partner_id: partners[1].id,
      rights_owner: partners[1].name, contract_number: "FLX-2024-102",
      rights_start: "2024-06-01", rights_end: "2027-05-31",
      allowed_countries: ["MN"], allowed_platforms: ["web", "mobile"],
      is_exclusive: false, revenue_share_percent: 35, approval_status: "approved", admin_notes: null,
    },
  );
  await must("content_rights", db.from("content_rights").insert(rightRows));

  const sections = await must("homepage_sections", db.from("homepage_sections").insert([
    { slug: "hero",         title_mn: "Онцлох",             layout: "hero", query_type: "manual", auto_query: null,                              sort_order: 0, status: "published" },
    { slug: "new",          title_mn: "Шинээр нэмэгдсэн",   layout: "row",  query_type: "auto",   auto_query: { type: "newest" },                sort_order: 1, status: "published" },
    { slug: "popular",      title_mn: "Түгээмэл",           layout: "row",  query_type: "auto",   auto_query: { type: "popular" },               sort_order: 2, status: "published" },
    { slug: "mongolian",    title_mn: "Монгол кино",        layout: "row",  query_type: "auto",   auto_query: { type: "country", country: "MN" }, sort_order: 3, status: "published" },
    { slug: "series",       title_mn: "Цуврал",             layout: "row",  query_type: "auto",   auto_query: { type: "series" },                sort_order: 4, status: "published" },
    { slug: "coming-soon",  title_mn: "Тун удахгүй",        layout: "row",  query_type: "auto",   auto_query: { type: "upcoming" },              sort_order: 5, status: "draft" },
  ]).select());
  const heroId = sections.find((s) => s.slug === "hero").id;
  await must("hero items", db.from("homepage_section_items").insert([
    { section_id: heroId, content_type: "movie",  content_id: movieId["har-sarnai"],     sort_order: 0 },
    { section_id: heroId, content_type: "movie",  content_id: movieId["quantum-garden"], sort_order: 1 },
    { section_id: heroId, content_type: "series", content_id: seriesId["nuudelchid"],    sort_order: 2 },
  ]));

  await must("promo code", db.from("promo_codes").upsert([{
    code: "WELCOME30",
    discount_percent: 30,
    bonus_days: null,
    max_uses: 1000,
    used_count: 0,
    valid_from: daysAgo(1),
    valid_until: daysFromNow(365),
    is_active: true,
  }], { onConflict: "code" }));

  console.log("\n[9/9] demo subscription + payment");
  // delete-then-insert: payments (provider, external_id) uses a PARTIAL
  // unique index, which PostgREST upsert cannot target via on_conflict
  await must("clear demo payments", db.from("payments").delete().eq("user_id", demoId));
  await must("clear demo subs", db.from("subscriptions").delete().eq("user_id", demoId));
  const subs = await must("subscription", db.from("subscriptions").insert([{
    user_id: demoId,
    plan_id: planId,
    status: "active",
    started_at: daysAgo(2),
    current_period_end: daysFromNow(28),
  }]).select());
  await must("payment", db.from("payments").insert([{
    user_id: demoId,
    subscription_id: subs[0].id,
    provider: "qpay",
    external_id: "SEED-DEMO-0001",
    amount_mnt: 14900,
    status: "paid",
    paid_at: daysAgo(2),
    receipt_number: "R-2026-000001",
  }]));

  await must("audit log", db.from("audit_logs").insert([{
    actor_id: adminId,
    action: "seed.run",
    entity_type: "system",
    entity_id: null,
    details: { movies: MOVIES.length, series: SERIES.length },
    ip_hash: null,
  }]));

  console.log("\nSeed complete.");
  console.log("  admin@flimix.mn   / Admin123!   (super_admin, admin)");
  console.log("  manager@flimix.mn / Manager123! (content_manager)");
  console.log("  demo@flimix.mn    / Demo123!    (user, active subscription)");
}

main().catch((e) => fail("main", e));
