"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { runAdminAction, AdminActionError, type ActionResult } from "../../_lib/adminAction";
import { parseCsv } from "../../_lib/csv";

export interface ImportRowResult {
  line: number;
  title: string;
  ok: boolean;
  error?: string;
}

export interface ImportReport {
  total: number;
  succeeded: number;
  failed: number;
  rows: ImportRowResult[];
}

const CSV_HEADERS = [
  "title_mn",
  "title_en",
  "original_title",
  "release_year",
  "duration_minutes",
  "age_rating",
  "country_code",
  "genres",
  "description_mn",
  "poster_url",
  "backdrop_url",
] as const;

const rowSchema = z.object({
  title_mn: z.string().min(1, "title_mn хоосон байна"),
  title_en: z.string().transform((s) => (s.trim() === "" ? null : s.trim())),
  original_title: z.string().transform((s) => (s.trim() === "" ? null : s.trim())),
  release_year: z
    .string()
    .transform((s) => s.trim())
    .pipe(
      z
        .string()
        .refine((s) => s === "" || /^\d{4}$/.test(s), "release_year буруу")
        .transform((s) => (s === "" ? null : Number(s))),
    ),
  duration_minutes: z
    .string()
    .transform((s) => s.trim())
    .pipe(
      z
        .string()
        .refine((s) => s === "" || /^\d+$/.test(s), "duration_minutes буруу")
        .transform((s) => (s === "" ? null : Number(s))),
    ),
  age_rating: z
    .string()
    .transform((s) => s.trim())
    .pipe(
      z
        .string()
        .refine((s) => s === "" || ["G", "PG", "PG-13", "R", "NC-17"].includes(s), "age_rating буруу")
        .transform((s) => (s === "" ? null : s)),
    ),
  country_code: z.string().transform((s) => (s.trim() === "" ? null : s.trim().toUpperCase())),
  genres: z
    .string()
    .transform((s) =>
      s
        .split("|")
        .map((g) => g.trim().toLowerCase())
        .filter(Boolean),
    ),
  description_mn: z.string().transform((s) => (s.trim() === "" ? null : s.trim())),
  poster_url: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().refine((s) => s === "" || /^https?:\/\//.test(s), "poster_url буруу").transform((s) => (s === "" ? null : s))),
  backdrop_url: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().refine((s) => s === "" || /^https?:\/\//.test(s), "backdrop_url буруу").transform((s) => (s === "" ? null : s))),
});

function slugify(text: string): string {
  const base = text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
  return base || `movie-${Date.now()}`;
}

export async function importMoviesCsv(
  _prev: ActionResult<ImportReport> | null,
  formData: FormData,
): Promise<ActionResult<ImportReport>> {
  const result = await runAdminAction<ImportReport>(
    "content_manager",
    "movie.csv_import",
    "movie",
    async ({ db }) => {
      let csvText = String(formData.get("csv_text") ?? "").trim();
      const file = formData.get("csv_file");
      if (file instanceof File && file.size > 0) {
        if (file.size > 2 * 1024 * 1024) throw new AdminActionError("CSV файл 2MB-аас хэтэрч болохгүй.");
        csvText = (await file.text()).trim();
      }
      if (!csvText) throw new AdminActionError("CSV өгөгдөл оруулна уу.");

      const table = parseCsv(csvText.replace(/^\uFEFF/, ""));
      if (table.length < 2) throw new AdminActionError("Толгой мөр + дор хаяж нэг өгөгдлийн мөр шаардлагатай.");

      const header = (table[0] ?? []).map((h) => h.trim().toLowerCase());
      for (const required of CSV_HEADERS) {
        if (!header.includes(required)) {
          throw new AdminActionError(`Толгой мөрөнд "${required}" багана дутуу байна.`);
        }
      }
      const idx = (name: string) => header.indexOf(name);

      // Lookup tables once.
      const [countriesRes, genresRes] = await Promise.all([
        db.from("countries").select("id,code"),
        db.from("genres").select("id,slug"),
      ]);
      const countryByCode = new Map(
        ((countriesRes.data ?? []) as { id: string; code: string }[]).map((c) => [c.code.toUpperCase(), c.id]),
      );
      const genreBySlug = new Map(
        ((genresRes.data ?? []) as { id: string; slug: string }[]).map((g) => [g.slug.toLowerCase(), g.id]),
      );

      const rows: ImportRowResult[] = [];
      let succeeded = 0;

      for (let i = 1; i < table.length; i++) {
        const line = i + 1;
        const cells = table[i] ?? [];
        const get = (name: string) => cells[idx(name)] ?? "";
        const titleForReport = get("title_mn") || `(мөр ${line})`;
        try {
          const parsed = rowSchema.parse({
            title_mn: get("title_mn"),
            title_en: get("title_en"),
            original_title: get("original_title"),
            release_year: get("release_year"),
            duration_minutes: get("duration_minutes"),
            age_rating: get("age_rating"),
            country_code: get("country_code"),
            genres: get("genres"),
            description_mn: get("description_mn"),
            poster_url: get("poster_url"),
            backdrop_url: get("backdrop_url"),
          });

          let countryId: string | null = null;
          if (parsed.country_code) {
            countryId = countryByCode.get(parsed.country_code) ?? null;
            if (!countryId) throw new Error(`Улсын код олдсонгүй: ${parsed.country_code}`);
          }
          const genreIds: string[] = [];
          for (const slug of parsed.genres) {
            const gid = genreBySlug.get(slug);
            if (!gid) throw new Error(`Төрлийн slug олдсонгүй: ${slug}`);
            genreIds.push(gid);
          }

          const slug = `${slugify(parsed.title_en ?? parsed.title_mn)}-${Math.random().toString(36).slice(2, 6)}`;
          const insertRes = await db
            .from("movies")
            .insert({
              slug,
              title_mn: parsed.title_mn,
              title_en: parsed.title_en,
              original_title: parsed.original_title,
              description_mn: parsed.description_mn,
              release_year: parsed.release_year,
              duration_seconds: parsed.duration_minutes === null ? null : parsed.duration_minutes * 60,
              age_rating: parsed.age_rating,
              country_id: countryId,
              poster_url: parsed.poster_url,
              backdrop_url: parsed.backdrop_url,
              status: "draft",
            })
            .select("id")
            .single();
          if (insertRes.error || !insertRes.data) {
            throw new Error(insertRes.error?.message ?? "insert алдаа");
          }
          const movieId = (insertRes.data as { id: string }).id;
          if (genreIds.length) {
            await db.from("movie_genres").insert(genreIds.map((genre_id) => ({ movie_id: movieId, genre_id })));
          }
          succeeded++;
          rows.push({ line, title: titleForReport, ok: true });
        } catch (err) {
          const msg =
            err instanceof z.ZodError
              ? err.issues.map((iss) => iss.message).join("; ")
              : err instanceof Error
                ? err.message
                : "Тодорхойгүй алдаа";
          rows.push({ line, title: titleForReport, ok: false, error: msg });
        }
      }

      return {
        data: { total: rows.length, succeeded, failed: rows.length - succeeded, rows },
        entityId: null,
        details: { total: rows.length, succeeded, failed: rows.length - succeeded },
      };
    },
  );

  if (result.ok) revalidatePath("/admin/content");
  return result;
}
