"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  runAdminAction,
  must,
  AdminActionError,
  type ActionResult,
  type AdminDb,
} from "../_lib/adminAction";
import { RIGHTS_BLOCK_MESSAGE, contentRightsRequired } from "../_lib/messages";
import type { CastMember, CrewMember, Movie } from "@/types/db";

/* ------------------------------------------------------------------ */
/* Schemas                                                             */
/* ------------------------------------------------------------------ */

const optional = (v: FormDataEntryValue | null): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
};

const videoSchema = z.object({
  provider: z.enum(["bunny", "cloudflare", "aws", "mock", "r2"]),
  provider_video_id: z.string().min(1, "Провайдерын видео ID шаардлагатай"),
  hls_path: z.string().min(1, "HLS зам шаардлагатай"),
  qualities: z.array(z.string()).min(1, "Дор хаяж нэг чанар сонгоно уу"),
});

const subtitleSchema = z.object({
  language_id: z.string().uuid(),
  label: z.string().min(1),
  url: z.string().url("Хадмалын URL буруу байна"),
  is_default: z.boolean(),
});

const audioTrackSchema = z.object({
  language_id: z.string().uuid(),
  label: z.string().transform((v) => v.trim() || "Дубляж"),
  url: z.string().url("Дууны URL буруу байна"),
  is_default: z.boolean(),
});

const movieSchema = z.object({
  id: z.string().uuid().optional(),
  title_mn: z.string().min(1, "Монгол нэр шаардлагатай"),
  title_en: z.string().nullable(),
  original_title: z.string().nullable(),
  slug: z
    .string()
    .min(1, "Slug шаардлагатай")
    .regex(/^[a-z0-9-]+$/, "Slug зөвхөн латин жижиг үсэг, тоо, зураас"),
  description_mn: z.string().nullable(),
  description_en: z.string().nullable(),
  release_year: z.coerce.number().int().min(1900).max(2100).nullable(),
  duration_minutes: z.coerce.number().int().min(0).max(6000).nullable(),
  age_rating: z.enum(["G", "PG", "PG-13", "R", "NC-17"]).nullable(),
  country_id: z.string().uuid().nullable(),
  poster_url: z.string().url("Постерын URL буруу").nullable(),
  backdrop_url: z.string().url("Арын зургийн URL буруу").nullable(),
  trailer_url: z.string().url("Трейлерийн URL буруу").nullable(),
  is_free: z.boolean(),
  status: z.enum(["draft", "scheduled", "published"]),
  published_at: z.string().nullable(),
  genre_ids: z.array(z.string().uuid()),
  cast_ids: z.array(z.string().uuid()),
  crew_ids: z.array(z.string().uuid()),
  video: videoSchema.nullable(),
  subtitles: z.array(subtitleSchema),
  audio_tracks: z.array(audioTrackSchema),
});

export type MovieInput = z.infer<typeof movieSchema>;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

async function hasApprovedActiveRight(
  db: AdminDb,
  contentType: "movie" | "series",
  contentId: string,
): Promise<boolean> {
  const nowIso = new Date().toISOString();
  const { data } = await db
    .from("content_rights")
    .select("id")
    .eq("content_type", contentType)
    .eq("content_id", contentId)
    .eq("approval_status", "approved")
    .lte("rights_start", nowIso)
    .gt("rights_end", nowIso)
    .limit(1);
  return (data ?? []).length > 0;
}


/* ------------------------------------------------------------------ */
/* Save (create/update) movie with all relations                      */
/* ------------------------------------------------------------------ */

export async function saveMovie(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const result = await runAdminAction<{ id: string }>(
    "content_manager",
    "movie.save",
    "movie",
    async ({ db }) => {
      const parseJson = (name: string): unknown => {
        const raw = formData.get(name);
        if (typeof raw !== "string" || raw.trim() === "") return null;
        try {
          return JSON.parse(raw) as unknown;
        } catch {
          throw new AdminActionError(`Талбарын өгөгдөл эвдэрсэн байна (${name})`);
        }
      };

      const input = movieSchema.parse({
        id: optional(formData.get("id")) ?? undefined,
        title_mn: String(formData.get("title_mn") ?? ""),
        title_en: optional(formData.get("title_en")),
        original_title: optional(formData.get("original_title")),
        slug: String(formData.get("slug") ?? "").trim().toLowerCase(),
        description_mn: optional(formData.get("description_mn")),
        description_en: optional(formData.get("description_en")),
        release_year: optional(formData.get("release_year")),
        duration_minutes: optional(formData.get("duration_minutes")),
        age_rating: optional(formData.get("age_rating")),
        country_id: optional(formData.get("country_id")),
        poster_url: optional(formData.get("poster_url")),
        backdrop_url: optional(formData.get("backdrop_url")),
        trailer_url: optional(formData.get("trailer_url")),
        is_free: formData.get("is_free") === "on",
        status: String(formData.get("status") ?? "draft"),
        published_at: optional(formData.get("published_at")),
        genre_ids: formData.getAll("genre_ids").map(String),
        cast_ids: (parseJson("cast_ids_json") ?? []) as unknown,
        crew_ids: (parseJson("crew_ids_json") ?? []) as unknown,
        video: parseJson("video_json"),
        subtitles: (parseJson("subtitles_json") ?? []) as unknown,
        audio_tracks: (parseJson("audio_tracks_json") ?? []) as unknown,
      });

      // Publishing guard: only content with an approved, unexpired right goes live.
      if (input.status === "published" && contentRightsRequired()) {
        if (!input.id || !(await hasApprovedActiveRight(db, "movie", input.id))) {
          throw new AdminActionError(RIGHTS_BLOCK_MESSAGE);
        }
      }
      if (input.status === "scheduled" && !input.published_at) {
        throw new AdminActionError("Товлох огноог оруулна уу.");
      }

      const row = {
        slug: input.slug,
        title_mn: input.title_mn,
        title_en: input.title_en,
        original_title: input.original_title,
        description_mn: input.description_mn,
        description_en: input.description_en,
        release_year: input.release_year,
        duration_seconds: input.duration_minutes === null ? null : input.duration_minutes * 60,
        age_rating: input.age_rating,
        country_id: input.country_id,
        poster_url: input.poster_url,
        backdrop_url: input.backdrop_url,
        trailer_url: input.trailer_url,
        is_free: input.is_free,
        status: input.status,
        published_at:
          input.status === "published"
            ? (input.published_at ?? new Date().toISOString())
            : input.status === "scheduled"
              ? input.published_at
              : null,
        updated_at: new Date().toISOString(),
      };

      let movieId: string;
      if (input.id) {
        const updated = must(
          await db.from("movies").update(row).eq("id", input.id).select("id").single(),
          "Кино шинэчлэхэд алдаа",
        ) as { id: string };
        movieId = updated.id;
      } else {
        // Slug conflict: soft-deleted movies keep their row (and slug). If a
        // deleted movie holds this slug, rename its slug to free it up; if a
        // live movie holds it, surface a clear error instead of a raw
        // duplicate-key failure.
        const { data: slugHolder } = await db
          .from("movies")
          .select("id, deleted_at")
          .eq("slug", input.slug)
          .maybeSingle();
        const holder = slugHolder as { id: string; deleted_at: string | null } | null;
        if (holder) {
          if (holder.deleted_at) {
            await db
              .from("movies")
              .update({ slug: `${input.slug}-deleted-${Date.now()}` })
              .eq("id", holder.id);
          } else {
            throw new AdminActionError(
              "Энэ slug-тай кино аль хэдийн байна. Өөр slug сонгоно уу.",
            );
          }
        }
        const inserted = must(
          await db.from("movies").insert(row).select("id").single(),
          "Кино үүсгэхэд алдаа",
        ) as { id: string };
        movieId = inserted.id;
      }

      // Video asset: create or update, then link.
      if (input.video) {
        const { data: existing } = await db
          .from("movies")
          .select("playback_asset_id")
          .eq("id", movieId)
          .single();
        const assetRow = {
          provider: input.video.provider,
          provider_video_id: input.video.provider_video_id,
          hls_path: input.video.hls_path,
          qualities: input.video.qualities,
          duration_seconds: row.duration_seconds,
          status: "ready" as const,
        };
        const existingAssetId = (existing as { playback_asset_id: string | null } | null)
          ?.playback_asset_id;
        if (existingAssetId) {
          must(
            await db.from("video_assets").update(assetRow).eq("id", existingAssetId).select("id").single(),
            "Видео ассет шинэчлэхэд алдаа",
          );
        } else {
          const asset = must(
            await db.from("video_assets").insert(assetRow).select("id").single(),
            "Видео ассет үүсгэхэд алдаа",
          ) as { id: string };
          must(
            await db
              .from("movies")
              .update({ playback_asset_id: asset.id })
              .eq("id", movieId)
              .select("id")
              .single(),
            "Видео ассет холбоход алдаа",
          );
        }
      }

      // Sync junctions.
      await db.from("movie_genres").delete().eq("movie_id", movieId);
      if (input.genre_ids.length) {
        must(
          await db
            .from("movie_genres")
            .insert(input.genre_ids.map((genre_id) => ({ movie_id: movieId, genre_id })))
            .select("movie_id"),
          "Төрөл хадгалахад алдаа",
        );
      }
      await db.from("movie_cast").delete().eq("movie_id", movieId);
      if (input.cast_ids.length) {
        must(
          await db
            .from("movie_cast")
            .insert(input.cast_ids.map((cast_member_id) => ({ movie_id: movieId, cast_member_id })))
            .select("movie_id"),
          "Жүжигчид хадгалахад алдаа",
        );
      }
      await db.from("movie_crew").delete().eq("movie_id", movieId);
      if (input.crew_ids.length) {
        must(
          await db
            .from("movie_crew")
            .insert(input.crew_ids.map((crew_member_id) => ({ movie_id: movieId, crew_member_id })))
            .select("movie_id"),
          "Багийн гишүүд хадгалахад алдаа",
        );
      }

      // Sync subtitle tracks.
      await db
        .from("subtitle_tracks")
        .delete()
        .eq("content_type", "movie")
        .eq("content_id", movieId);
      if (input.subtitles.length) {
        must(
          await db
            .from("subtitle_tracks")
            .insert(
              input.subtitles.map((s) => ({
                content_type: "movie",
                content_id: movieId,
                language_id: s.language_id,
                label: s.label,
                url: s.url,
                is_default: s.is_default,
              })),
            )
            .select("id"),
          "Хадмал хадгалахад алдаа",
        );
      }

      // Sync dub audio tracks (replace-all, mirrors subtitles).
      await db
        .from("audio_tracks")
        .delete()
        .eq("content_type", "movie")
        .eq("content_id", movieId);
      if (input.audio_tracks.length) {
        must(
          await db
            .from("audio_tracks")
            .insert(
              input.audio_tracks.map((a) => ({
                content_type: "movie",
                content_id: movieId,
                language_id: a.language_id,
                label: a.label,
                url: a.url,
                is_default: a.is_default,
              })),
            )
            .select("id"),
          "Дубляжийн дуу хадгалахад алдаа",
        );
      }

      return {
        data: { id: movieId },
        entityId: movieId,
        details: { slug: input.slug, status: input.status, created: !input.id },
      };
    },
  );

  if (result.ok) {
    revalidatePath("/admin/content");
    revalidatePath("/");
    redirect(`/admin/content?message=${encodeURIComponent("Кино амжилттай хадгалагдлаа.")}`);
  }
  return result;
}

/* ------------------------------------------------------------------ */
/* Row actions (list page)                                             */
/* ------------------------------------------------------------------ */

function returnPath(formData: FormData): string {
  const raw = formData.get("return");
  const path = typeof raw === "string" && raw.startsWith("/admin") ? raw : "/admin/content";
  return path;
}

function withParam(path: string, key: "message" | "error", value: string): string {
  const [base, qs] = path.split("?");
  const sp = new URLSearchParams(qs ?? "");
  sp.delete("message");
  sp.delete("error");
  sp.set(key, value);
  return `${base}?${sp.toString()}`;
}

export async function togglePublishMovie(formData: FormData): Promise<void> {
  const result = await runAdminAction<{ published: boolean }>(
    "content_manager",
    "movie.toggle_publish",
    "movie",
    async ({ db }) => {
      const id = z.string().uuid().parse(formData.get("id"));
      const movie = must(
        await db.from("movies").select("id,status,title_mn").eq("id", id).single(),
        "Кино олдсонгүй",
      ) as Pick<Movie, "id" | "status" | "title_mn">;

      if (movie.status === "published") {
        must(
          await db
            .from("movies")
            .update({ status: "unpublished", updated_at: new Date().toISOString() })
            .eq("id", id)
            .select("id")
            .single(),
          "Болиулахад алдаа",
        );
        return { data: { published: false }, entityId: id, details: { title: movie.title_mn } };
      }

      if (contentRightsRequired() && !(await hasApprovedActiveRight(db, "movie", id))) {
        throw new AdminActionError(RIGHTS_BLOCK_MESSAGE);
      }
      must(
        await db
          .from("movies")
          .update({
            status: "published",
            published_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", id)
          .select("id")
          .single(),
        "Нийтлэхэд алдаа",
      );
      return { data: { published: true }, entityId: id, details: { title: movie.title_mn } };
    },
  );

  revalidatePath("/admin/content");
  revalidatePath("/");
  const back = returnPath(formData);
  if (result.ok) {
    redirect(
      withParam(back, "message", result.data.published ? "Кино нийтлэгдлээ." : "Кино нийтлэлээс буцаагдлаа."),
    );
  }
  redirect(withParam(back, "error", result.error));
}

export async function archiveMovie(formData: FormData): Promise<void> {
  const result = await runAdminAction<null>(
    "content_manager",
    "movie.archive",
    "movie",
    async ({ db }) => {
      const id = z.string().uuid().parse(formData.get("id"));
      must(
        await db
          .from("movies")
          .update({ status: "archived", updated_at: new Date().toISOString() })
          .eq("id", id)
          .select("id")
          .single(),
        "Архивлахад алдаа",
      );
      return { data: null, entityId: id };
    },
  );
  revalidatePath("/admin/content");
  const back = returnPath(formData);
  redirect(
    result.ok ? withParam(back, "message", "Кино архивлагдлаа.") : withParam(back, "error", result.error),
  );
}

export async function softDeleteMovie(formData: FormData): Promise<void> {
  const result = await runAdminAction<null>(
    "content_manager",
    "movie.soft_delete",
    "movie",
    async ({ db }) => {
      const id = z.string().uuid().parse(formData.get("id"));
      must(
        await db
          .from("movies")
          .update({
            deleted_at: new Date().toISOString(),
            status: "archived",
            updated_at: new Date().toISOString(),
          })
          .eq("id", id)
          .select("id")
          .single(),
        "Устгахад алдаа",
      );
      return { data: null, entityId: id };
    },
  );
  revalidatePath("/admin/content");
  revalidatePath("/");
  const back = returnPath(formData);
  redirect(
    result.ok ? withParam(back, "message", "Кино устгагдлаа (сэргээх боломжтой).") : withParam(back, "error", result.error),
  );
}

/* ------------------------------------------------------------------ */
/* Image upload to Supabase Storage ("media" bucket)                   */
/* ------------------------------------------------------------------ */

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export async function uploadImage(
  formData: FormData,
): Promise<ActionResult<{ url: string; path: string }>> {
  return runAdminAction<{ url: string; path: string }>(
    "content_manager",
    "media.upload_image",
    "storage_object",
    async ({ db }) => {
      const kind = z.enum(["poster", "backdrop"]).parse(formData.get("kind"));
      const file = formData.get("file");
      if (!(file instanceof File) || file.size === 0) {
        throw new AdminActionError("Файл сонгоно уу.");
      }
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        throw new AdminActionError("Зөвхөн JPEG, PNG, WEBP зураг зөвшөөрөгдөнө.");
      }
      if (file.size > MAX_IMAGE_BYTES) {
        throw new AdminActionError("Зургийн хэмжээ 5MB-аас хэтэрч болохгүй.");
      }
      const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const path = `${kind === "poster" ? "posters" : "backdrops"}/${crypto.randomUUID()}.${ext}`;

      const { error } = await db.storage.from("media").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (error) throw new AdminActionError(`Байршуулахад алдаа: ${error.message}`);

      const { data } = db.storage.from("media").getPublicUrl(path);
      revalidatePath("/admin/content");
      return {
        data: { url: data.publicUrl, path },
        entityId: path,
        details: { size: file.size, type: file.type },
      };
    },
  );
}

/* ------------------------------------------------------------------ */
/* Dub audio upload to Supabase Storage ("media" bucket, audio/)       */
/* ------------------------------------------------------------------ */

const AUDIO_EXT_BY_TYPE: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/aac": "aac",
  "audio/ogg": "ogg",
};
const MAX_AUDIO_BYTES = 200 * 1024 * 1024;

export async function uploadAudio(
  formData: FormData,
): Promise<ActionResult<{ url: string; path: string }>> {
  return runAdminAction<{ url: string; path: string }>(
    "content_manager",
    "media.upload_audio",
    "storage_object",
    async ({ db }) => {
      const file = formData.get("file");
      if (!(file instanceof File) || file.size === 0) {
        throw new AdminActionError("Файл сонгоно уу.");
      }
      const ext = AUDIO_EXT_BY_TYPE[file.type];
      if (!ext) {
        throw new AdminActionError("Зөвхөн MP3, M4A, AAC, OGG аудио файл зөвшөөрөгдөнө.");
      }
      if (file.size > MAX_AUDIO_BYTES) {
        throw new AdminActionError("Аудио файлын хэмжээ 200MB-аас хэтэрч болохгүй.");
      }
      const path = `audio/${crypto.randomUUID()}.${ext}`;

      const { error } = await db.storage.from("media").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (error) throw new AdminActionError(`Байршуулахад алдаа: ${error.message}`);

      const { data } = db.storage.from("media").getPublicUrl(path);
      revalidatePath("/admin/content");
      return {
        data: { url: data.publicUrl, path },
        entityId: path,
        details: { size: file.size, type: file.type },
      };
    },
  );
}

/* ------------------------------------------------------------------ */
/* Inline cast / crew creation                                         */
/* ------------------------------------------------------------------ */

export async function createCastMember(name: string): Promise<ActionResult<CastMember>> {
  return runAdminAction<CastMember>(
    "content_manager",
    "cast_member.create",
    "cast_member",
    async ({ db }) => {
      const clean = z.string().min(1, "Нэр шаардлагатай").max(200).parse(name.trim());
      const created = must(
        await db.from("cast_members").insert({ name: clean }).select("*").single(),
        "Жүжигчин нэмэхэд алдаа",
      ) as CastMember;
      revalidatePath("/admin/content");
      return { data: created, entityId: created.id, details: { name: clean } };
    },
  );
}

export async function createCrewMember(
  name: string,
  role: string,
): Promise<ActionResult<CrewMember>> {
  return runAdminAction<CrewMember>(
    "content_manager",
    "crew_member.create",
    "crew_member",
    async ({ db }) => {
      const clean = z.string().min(1, "Нэр шаардлагатай").max(200).parse(name.trim());
      const cleanRole = z.string().min(1, "Үүрэг шаардлагатай").max(100).parse(role.trim());
      const created = must(
        await db.from("crew_members").insert({ name: clean, role: cleanRole }).select("*").single(),
        "Багийн гишүүн нэмэхэд алдаа",
      ) as CrewMember;
      revalidatePath("/admin/content");
      return { data: created, entityId: created.id, details: { name: clean, role: cleanRole } };
    },
  );
}
